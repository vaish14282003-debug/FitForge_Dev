const env = require('../src/config/env');
const Exercise = require('../src/models/Exercise');
const IntegrationConnection = require('../src/models/IntegrationConnection');
const registry = require('../src/integrations/registry');
const WorkoutSession = require('../src/models/WorkoutSession');
const { loadExerciseLibrary } = require('../src/data/loadExercises');
const { seal, open } = require('../src/utils/secretBox');
const { app, startDb, clearDb, stopDb, registerOwner, registerMember, createAndLogin } = require('./helpers');
const request = require('supertest');

beforeAll(startDb);
afterEach(async () => {
  jest.restoreAllMocks();
  await clearDb();
});
afterAll(stopDb);

const KEY = 'a1'.repeat(32);
const enableStrava = () => {
  jest.replaceProperty(env, 'strava', { clientId: '12345', clientSecret: 'shh-secret' });
  jest.replaceProperty(env, 'tokenEncryptionKey', KEY);
};

const reply = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const tokenReply = (overrides = {}) =>
  reply(200, {
    token_type: 'Bearer',
    access_token: 'access-1',
    refresh_token: 'refresh-1',
    expires_at: Math.floor(Date.now() / 1000) + 6 * 3600,
    scope: 'read,activity:write',
    athlete: { id: 987, firstname: 'Vaishnavi', lastname: 'Rao' },
    ...overrides,
  });

/** Routes mocked Strava calls by URL; records what FitForge sent. */
function mockStrava(handlers) {
  const calls = [];
  jest.spyOn(global, 'fetch').mockImplementation(async (url, init = {}) => {
    const call = { url: String(url), headers: init.headers || {}, form: Object.fromEntries(new URLSearchParams(init.body?.toString() || '')) };
    calls.push(call);
    const handler = Object.entries(handlers).find(([prefix]) => call.url.startsWith(prefix));
    if (!handler) throw new Error(`Unexpected request to ${call.url}`);
    return handler[1](call);
  });
  return calls;
}

let member, trainer, plan, bench;

beforeEach(async () => {
  await loadExerciseLibrary();
  bench = await Exercise.findOne({ name: 'Barbell Bench Press' });
  const owner = await registerOwner();
  trainer = await createAndLogin(owner.agent, 'TRAINER', 'trainer@example.com');
  member = await registerMember(owner.gym.joinCode, { email: 'member@example.com' });
  await owner.agent.patch(`/api/users/${member.user.id}/trainer`).send({ trainerId: trainer.user.id });
  plan = (
    await trainer.agent.post('/api/plans').send({ name: 'Strength', days: [{ name: 'Push', exercises: [{ exercise: bench.id, sets: 3, reps: '8', weight: 40 }] }] })
  ).body.plan;
  await trainer.agent.put(`/api/plans/${plan.id}/assignees`).send({ memberIds: [member.user.id] });
});

const workout = () => ({
  planId: plan.id,
  dayIndex: 0,
  startedAt: new Date(Date.now() - 50 * 60 * 1000).toISOString(),
  entries: [{ exercise: bench.id, sets: [{ reps: 8, weight: 60, done: true }, { reps: 8, weight: 62.5, done: true }, { reps: 8, weight: 65, done: false }] }],
});

async function connectedMember({ expiresInSeconds = 6 * 3600, autoUpload = true } = {}) {
  await IntegrationConnection.create({
    user: member.user.id,
    provider: 'strava',
    externalId: '987',
    displayName: 'Vaishnavi Rao',
    scope: 'read,activity:write',
    accessToken: seal('access-1', KEY),
    refreshToken: seal('refresh-1', KEY),
    expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
    autoUpload,
  });
}

describe('secret box', () => {
  it('round-trips and detects tampering', () => {
    const sealed = seal('token-value', KEY);
    expect(sealed).not.toContain('token-value');
    expect(open(sealed, KEY)).toBe('token-value');
    const parts = sealed.split('.');
    parts[3] = Buffer.from('forged').toString('base64url');
    expect(() => open(parts.join('.'), KEY)).toThrow();
    expect(() => open(sealed, 'b2'.repeat(32))).toThrow();
  });
});

describe('Strava availability and access', () => {
  it('is hidden when the server has no Strava app', async () => {
    const res = await member.agent.get('/api/integrations');
    expect(res.body).toEqual({ integrations: [] });
    expect((await member.agent.post('/api/integrations/strava/connect')).status).toBe(503);
    expect((await member.agent.post('/api/integrations/nosuchthing/connect')).status).toBe(404);
  });

  it('is for people who log workouts', async () => {
    enableStrava();
    expect((await trainer.agent.get('/api/integrations')).status).toBe(403);
    expect((await request(app).get('/api/integrations')).status).toBe(401);
  });
});

describe('connecting', () => {
  beforeEach(enableStrava);

  it('sends the athlete to Strava and stores encrypted tokens on return', async () => {
    const start = await member.agent.post('/api/integrations/strava/connect');
    expect(start.status).toBe(200);
    const url = new URL(start.body.url);
    expect(url.origin + url.pathname).toBe('https://www.strava.com/oauth/authorize');
    expect(url.searchParams.get('client_id')).toBe('12345');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('scope')).toBe('read,activity:write');
    expect(url.searchParams.get('redirect_uri')).toBe(`${env.appUrl.replace(/\/$/, '')}/api/integrations/strava/callback`);
    expect(start.headers['set-cookie'].join()).toMatch(/ff_oauth_state=.*HttpOnly/);

    const calls = mockStrava({ 'https://www.strava.com/oauth/token': () => tokenReply() });
    const back = await member.agent
      .get('/api/integrations/strava/callback')
      .query({ code: 'one-time-code', scope: 'read,activity:write', state: url.searchParams.get('state') });
    expect(back.status).toBe(303);
    expect(back.headers.location).toBe(`${env.appUrl.replace(/\/$/, '')}/profile?integration=strava&result=connected`);
    expect(calls[0].form).toMatchObject({ client_id: '12345', client_secret: 'shh-secret', code: 'one-time-code', grant_type: 'authorization_code' });

    const stored = await IntegrationConnection.findOne({ user: member.user.id, provider: 'strava' });
    expect(stored.displayName).toBe('Vaishnavi Rao');
    expect(stored.accessToken).not.toContain('access-1');
    expect(open(stored.refreshToken, KEY)).toBe('refresh-1');

    const status = await member.agent.get('/api/integrations');
    expect(status.body.integrations).toEqual([
      { provider: 'strava', name: 'Strava', connection: expect.objectContaining({ displayName: 'Vaishnavi Rao', autoUpload: true }) },
    ]);
    expect(JSON.stringify(status.body)).not.toMatch(/access-1|refresh-1|accessToken|refreshToken/);
  });

  it('only completes in the browser that started it', async () => {
    const state = new URL((await member.agent.post('/api/integrations/strava/connect')).body.url).searchParams.get('state');
    const calls = mockStrava({ 'https://www.strava.com/oauth/token': () => tokenReply() });
    // Another browser (no state cookie) following the same link.
    const res = await request(app).get('/api/integrations/strava/callback').query({ code: 'c', scope: 'activity:write', state });
    expect(res.headers.location).toMatch(/result=expired$/);
    expect(calls).toHaveLength(0);
    expect(await IntegrationConnection.countDocuments()).toBe(0);
  });

  it('handles a decline, a forged state and a missing upload permission', async () => {
    await member.agent.post('/api/integrations/strava/connect');
    expect((await member.agent.get('/api/integrations/strava/callback').query({ error: 'access_denied' })).headers.location).toMatch(/result=denied$/);

    await member.agent.post('/api/integrations/strava/connect');
    expect((await member.agent.get('/api/integrations/strava/callback').query({ code: 'c', state: 'forged' })).headers.location).toMatch(/result=expired$/);

    const state = new URL((await member.agent.post('/api/integrations/strava/connect')).body.url).searchParams.get('state');
    const res = await member.agent.get('/api/integrations/strava/callback').query({ code: 'c', scope: 'read', state });
    expect(res.headers.location).toMatch(/result=missing-permission$/);
    expect(await IntegrationConnection.countDocuments()).toBe(0);
  });
});

describe('uploading workouts', () => {
  beforeEach(enableStrava);

  it('posts a finished workout as a Weight Training activity', async () => {
    await connectedMember();
    const calls = mockStrava({ 'https://www.strava.com/api/v3/activities': () => reply(201, { id: 12345678987 }) });
    const res = await member.agent.post('/api/sessions').send(workout());

    expect(res.status).toBe(201);
    expect(res.body.session.exports).toEqual([
      expect.objectContaining({ provider: 'strava', status: 'uploaded', externalId: '12345678987', url: 'https://www.strava.com/activities/12345678987', error: null }),
    ]);
    const [call] = calls;
    expect(call.headers.Authorization).toBe('Bearer access-1');
    expect(call.form).toMatchObject({ name: 'Push · Strength', sport_type: 'WeightTraining', trainer: '1' });
    expect(Number(call.form.elapsed_time)).toBeGreaterThanOrEqual(50 * 60);
    expect(call.form.description).toContain('Barbell Bench Press: 8×60 kg, 8×62.5 kg');
    expect(call.form.description).toContain('Logged with FitForge');
    expect(call.form.description).not.toContain('65 kg');
  });

  it('refreshes an expired token first and keeps the newest refresh token', async () => {
    await connectedMember({ expiresInSeconds: -60 });
    const calls = mockStrava({
      'https://www.strava.com/oauth/token': () => tokenReply({ access_token: 'access-2', refresh_token: 'refresh-2', athlete: undefined }),
      'https://www.strava.com/api/v3/activities': () => reply(201, { id: 1 }),
    });
    await member.agent.post('/api/sessions').send(workout());
    expect(calls[0].form).toMatchObject({ grant_type: 'refresh_token', refresh_token: 'refresh-1' });
    expect(calls[1].headers.Authorization).toBe('Bearer access-2');
    const stored = await IntegrationConnection.findOne({ user: member.user.id, provider: 'strava' });
    expect(open(stored.refreshToken, KEY)).toBe('refresh-2');
  });

  it('still saves the workout when Strava fails, and it can be sent again later', async () => {
    await connectedMember();
    mockStrava({ 'https://www.strava.com/api/v3/activities': () => reply(500, { message: 'Server error' }) });
    const res = await member.agent.post('/api/sessions').send(workout());
    expect(res.status).toBe(201);
    expect(res.body.session.exports).toEqual([expect.objectContaining({ provider: 'strava', status: 'failed', externalId: null })]);

    jest.restoreAllMocks();
    enableStrava();
    mockStrava({ 'https://www.strava.com/api/v3/activities': () => reply(201, { id: 55 }) });
    const retry = await member.agent.post(`/api/integrations/strava/sessions/${res.body.session.id}`);
    expect(retry.body.session.exports).toEqual([expect.objectContaining({ provider: 'strava', status: 'uploaded', externalId: '55' })]);
  });

  it('forgets a connection the athlete revoked on Strava', async () => {
    await connectedMember();
    mockStrava({ 'https://www.strava.com/api/v3/activities': () => reply(401, { message: 'Authorization Error' }) });
    const res = await member.agent.post('/api/sessions').send(workout());
    expect(res.status).toBe(201);
    expect(res.body.session.exports[0].error).toMatch(/Connect Strava again/);
    expect(await IntegrationConnection.countDocuments()).toBe(0);
  });

  it('respects auto-upload being off, and only sends your own workouts', async () => {
    await connectedMember({ autoUpload: false });
    const calls = mockStrava({});
    const res = await member.agent.post('/api/sessions').send(workout());
    expect(res.body.session.exports).toEqual([]);
    expect(calls).toHaveLength(0);

    const other = await WorkoutSession.create({ ...(await WorkoutSession.findById(res.body.session.id)).toObject(), _id: undefined, member: trainer.user.id, clientId: null });
    expect((await member.agent.post(`/api/integrations/strava/sessions/${other.id}`)).status).toBe(404);
  });

  it('turns auto-upload off and on', async () => {
    await connectedMember();
    const res = await member.agent.patch('/api/integrations/strava').send({ autoUpload: false });
    expect(res.body.connection.autoUpload).toBe(false);
    expect(res.body.connection.accessToken).toBeUndefined();
  });
});

describe('disconnecting', () => {
  it('revokes access on Strava and deletes the tokens', async () => {
    enableStrava();
    await connectedMember();
    const calls = mockStrava({ 'https://www.strava.com/oauth/revoke': () => new Response(null, { status: 200 }) });
    expect((await member.agent.delete('/api/integrations/strava')).status).toBe(204);
    expect(calls[0].headers.Authorization).toBe(`Basic ${Buffer.from('12345:shh-secret').toString('base64')}`);
    expect(calls[0].form).toEqual({ token: 'refresh-1', token_type_hint: 'refresh_token' });
    expect(await IntegrationConnection.countDocuments()).toBe(0);
  });
});

describe('adding another provider', () => {
  // A stand-in for a future service (Garmin, Google Health…), built only from the provider contract.
  const uploads = [];
  const fakeFit = {
    id: 'fakefit',
    name: 'FakeFit',
    isConfigured: () => true,
    authorizeUrl: ({ redirectUri, state }) => `https://fakefit.example/authorize?${new URLSearchParams({ redirect_uri: redirectUri, state })}`,
    hasRequiredScope: (scope) => scope === 'workouts:write',
    exchangeCode: async ({ code }) => ({
      externalId: 'ff-1',
      displayName: 'Fake Athlete',
      scope: 'workouts:write',
      accessToken: `token-for-${code}`,
      refreshToken: 'fake-refresh',
      expiresAt: new Date(Date.now() + 3600_000),
    }),
    refresh: async () => ({ accessToken: 'fresh', refreshToken: 'fake-refresh-2', expiresAt: new Date(Date.now() + 3600_000) }),
    uploadWorkout: async ({ accessToken, session }) => {
      uploads.push({ accessToken, name: session.dayName });
      return { externalId: 'w-1', url: null };
    },
    revoke: async () => {},
  };
  let unregister;
  beforeEach(() => {
    enableStrava();
    uploads.length = 0;
    unregister = registry.register(fakeFit);
  });
  afterEach(() => unregister());

  it('plugs in without changing anything shared', async () => {
    const list = await member.agent.get('/api/integrations');
    expect(list.body.integrations.map((i) => i.provider)).toEqual(['strava', 'fakefit']);

    const url = new URL((await member.agent.post('/api/integrations/fakefit/connect')).body.url);
    expect(url.searchParams.get('redirect_uri')).toBe(`${env.appUrl.replace(/\/$/, '')}/api/integrations/fakefit/callback`);
    const back = await member.agent
      .get('/api/integrations/fakefit/callback')
      .query({ code: 'abc', scope: 'workouts:write', state: url.searchParams.get('state') });
    expect(back.headers.location).toMatch(/integration=fakefit&result=connected$/);
  });

  it("won't let one provider's approval complete another's sign-in", async () => {
    const state = new URL((await member.agent.post('/api/integrations/strava/connect')).body.url).searchParams.get('state');
    const res = await member.agent.get('/api/integrations/fakefit/callback').query({ code: 'abc', scope: 'workouts:write', state });
    expect(res.headers.location).toMatch(/result=expired$/);
  });

  it('sends a workout to every connected service, and one failing does not affect the other', async () => {
    await connectedMember();
    const url = new URL((await member.agent.post('/api/integrations/fakefit/connect')).body.url);
    await member.agent.get('/api/integrations/fakefit/callback').query({ code: 'abc', scope: 'workouts:write', state: url.searchParams.get('state') });

    mockStrava({ 'https://www.strava.com/api/v3/activities': () => reply(500, { message: 'down' }) });
    const res = await member.agent.post('/api/sessions').send(workout());
    expect(res.status).toBe(201);
    expect(res.body.session.exports).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ provider: 'strava', status: 'failed' }),
        expect.objectContaining({ provider: 'fakefit', status: 'uploaded', externalId: 'w-1' }),
      ])
    );
    expect(uploads).toEqual([{ accessToken: 'token-for-abc', name: 'Push' }]);

    expect((await member.agent.delete('/api/integrations/fakefit')).status).toBe(204);
    expect(await IntegrationConnection.countDocuments({ provider: 'fakefit' })).toBe(0);
    expect(await IntegrationConnection.countDocuments({ provider: 'strava' })).toBe(1);
  });

  it('rejects providers that miss part of the contract', () => {
    expect(() => registry.register({ ...fakeFit, id: 'broken', uploadWorkout: undefined })).toThrow(/uploadWorkout/);
  });
});
