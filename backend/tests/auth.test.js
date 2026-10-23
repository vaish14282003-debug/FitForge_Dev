const request = require('supertest');
const { app, startDb, clearDb, stopDb, PASSWORD, registerOwner, registerMember } = require('./helpers');

beforeAll(startDb);
afterEach(clearDb);
afterAll(stopDb);

const cookieNamed = (res, name) => (res.headers['set-cookie'] || []).find((c) => c.startsWith(`${name}=`));

describe('register', () => {
  it('creates an owner with a new gym and starts a session', async () => {
    const { res, gym, agent } = await registerOwner();

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ email: 'owner@example.com', role: 'GYM_OWNER' });
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(res.body.permissions).toContain('gym:settings');
    expect(cookieNamed(res, 'ff_access')).toMatch(/HttpOnly/);
    expect(cookieNamed(res, 'ff_refresh')).toMatch(/Path=\/api\/auth/);
    expect(gym.joinCode).toHaveLength(8);
    expect((await agent.get('/api/auth/me')).status).toBe(200);
  });

  it('lets a member join with the gym code', async () => {
    const { gym } = await registerOwner();
    const { res } = await registerMember(gym.joinCode);

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ role: 'MEMBER', gym: gym.id });
    expect(res.body.permissions).toEqual(['profile:read:own', 'profile:update:own', 'workout:log']);
  });

  it('rejects an unknown gym code', async () => {
    const { res } = await registerMember('ZZZZZZZZ');
    expect(res.status).toBe(400);
  });

  it('does not allow self-registering as a trainer or admin', async () => {
    const { gym } = await registerOwner();
    for (const role of ['TRAINER', 'STAFF', 'SUPER_ADMIN']) {
      const { res } = await registerMember(gym.joinCode, { role });
      expect(res.status).toBe(400);
    }
  });

  it('rejects duplicate emails and weak passwords', async () => {
    await registerOwner();
    expect((await registerOwner()).res.status).toBe(409);
    expect((await registerOwner({ email: 'other@example.com', password: 'short' })).res.status).toBe(400);
  });
});

describe('login', () => {
  it('logs in with correct credentials, case-insensitive on email', async () => {
    await registerOwner();
    const res = await request(app).post('/api/auth/login').send({ email: 'OWNER@example.com', password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('GYM_OWNER');
  });

  it('gives the same error for a wrong password and an unknown email', async () => {
    await registerOwner();
    const wrong = await request(app).post('/api/auth/login').send({ email: 'owner@example.com', password: 'nope-nope' });
    const unknown = await request(app).post('/api/auth/login').send({ email: 'ghost@example.com', password: PASSWORD });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.message).toBe(unknown.body.message);
  });
});

describe('session', () => {
  it('rejects /me without a session or with a tampered token', async () => {
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
    const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer not.a.token');
    expect(res.status).toBe(401);
  });

  it('rotates the refresh token and rejects the old one', async () => {
    const { res } = await registerOwner();
    const oldRefresh = cookieNamed(res, 'ff_refresh').split(';')[0];

    const first = await request(app).post('/api/auth/refresh').set('Cookie', oldRefresh);
    expect(first.status).toBe(200);
    const newRefresh = cookieNamed(first, 'ff_refresh').split(';')[0];
    expect(newRefresh).not.toBe(oldRefresh);

    // Replaying the rotated token fails and also kills the token that replaced it.
    expect((await request(app).post('/api/auth/refresh').set('Cookie', oldRefresh)).status).toBe(401);
    expect((await request(app).post('/api/auth/refresh').set('Cookie', newRefresh)).status).toBe(401);
  });

  it('logout revokes the refresh token and clears cookies', async () => {
    const { agent, res } = await registerOwner();
    const refresh = cookieNamed(res, 'ff_refresh').split(';')[0];

    expect((await agent.post('/api/auth/logout')).status).toBe(204);
    expect((await agent.get('/api/auth/me')).status).toBe(401);
    expect((await request(app).post('/api/auth/refresh').set('Cookie', refresh)).status).toBe(401);
  });
});
