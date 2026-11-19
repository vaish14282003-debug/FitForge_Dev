const request = require('supertest');
const Exercise = require('../src/models/Exercise');
const WorkoutSession = require('../src/models/WorkoutSession');
const { loadExerciseLibrary } = require('../src/data/loadExercises');
const { streakFrom } = require('../src/controllers/session.controller');
const { app, startDb, clearDb, stopDb, registerOwner, registerMember, createAndLogin } = require('./helpers');

beforeAll(startDb);
afterEach(clearDb);
afterAll(stopDb);

let owner, trainer, client, stranger, plan, bench, row;

beforeEach(async () => {
  await loadExerciseLibrary();
  [bench, row] = await Promise.all([
    Exercise.findOne({ name: 'Barbell Bench Press' }),
    Exercise.findOne({ name: 'Barbell Row' }),
  ]);
  owner = await registerOwner();
  trainer = await createAndLogin(owner.agent, 'TRAINER', 'trainer@example.com');
  client = await registerMember(owner.gym.joinCode, { email: 'client@example.com' });
  stranger = await registerMember(owner.gym.joinCode, { email: 'stranger@example.com' });
  await owner.agent.patch(`/api/users/${client.user.id}/trainer`).send({ trainerId: trainer.user.id });

  plan = (
    await trainer.agent.post('/api/plans').send({
      name: 'Two Day',
      days: [
        { name: 'Push', exercises: [{ exercise: bench.id, sets: 3, reps: '8', weight: 40 }] },
        { name: 'Pull', exercises: [{ exercise: row.id, sets: 3, reps: '10' }] },
      ],
    })
  ).body.plan;
  await trainer.agent.put(`/api/plans/${plan.id}/assignees`).send({ memberIds: [client.user.id] });
});

const benchSession = (weight, overrides = {}) => ({
  planId: plan.id,
  dayIndex: 0,
  startedAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
  entries: [
    {
      exercise: bench.id,
      sets: [
        { reps: 8, weight, done: true },
        { reps: 8, weight, done: true },
        { reps: 6, weight: weight + 10, done: false },
      ],
    },
  ],
  ...overrides,
});

describe('logging a workout', () => {
  it('saves the session with duration, volume and a first-time PR', async () => {
    const res = await client.agent.post('/api/sessions').send(benchSession(50));
    expect(res.status).toBe(201);
    const { session } = res.body;
    expect(session).toMatchObject({ planName: 'Two Day', dayName: 'Push', completedSets: 2, totalVolume: 800 });
    expect(session.durationSeconds).toBeGreaterThanOrEqual(45 * 60 - 5);
    expect(session.entries[0]).toMatchObject({ exerciseName: 'Barbell Bench Press', target: { sets: 3, reps: '8', weight: 40 } });
    // The undone 60 kg set does not count.
    expect(session.prs).toEqual([{ exercise: bench.id, exerciseName: 'Barbell Bench Press', weight: 50, reps: 8 }]);
  });

  it('only records a PR when the weight beats the previous best', async () => {
    await client.agent.post('/api/sessions').send(benchSession(50));
    expect((await client.agent.post('/api/sessions').send(benchSession(45))).body.session.prs).toEqual([]);
    expect((await client.agent.post('/api/sessions').send(benchSession(55))).body.session.prs[0].weight).toBe(55);
  });

  it('rejects sessions with nothing done, a foreign exercise, a bad day or an unassigned plan', async () => {
    const nothingDone = benchSession(50);
    nothingDone.entries[0].sets = [{ reps: 8, weight: 50, done: false }];
    expect((await client.agent.post('/api/sessions').send(nothingDone)).status).toBe(400);

    const wrongExercise = benchSession(50);
    wrongExercise.entries[0].exercise = row.id;
    expect((await client.agent.post('/api/sessions').send(wrongExercise)).status).toBe(400);

    expect((await client.agent.post('/api/sessions').send(benchSession(50, { dayIndex: 5 }))).status).toBe(400);
    expect((await stranger.agent.post('/api/sessions').send(benchSession(50))).status).toBe(404);
  });

  it('only members can log', async () => {
    expect((await trainer.agent.post('/api/sessions').send(benchSession(50))).status).toBe(403);
    expect((await owner.agent.post('/api/sessions').send(benchSession(50))).status).toBe(403);
  });
});

describe('summary', () => {
  it('reports totals, streak, this week and the next day in the plan', async () => {
    let summary = (await client.agent.get('/api/sessions/summary')).body.summary;
    expect(summary).toMatchObject({ totalWorkouts: 0, streak: 0, trainedToday: false });
    expect(summary.nextUp).toEqual([{ planId: plan.id, dayIndex: 0 }]);
    expect(summary.week).toHaveLength(7);

    await client.agent.post('/api/sessions').send(benchSession(50));
    summary = (await client.agent.get('/api/sessions/summary')).body.summary;
    expect(summary).toMatchObject({ totalWorkouts: 1, streak: 1, trainedToday: true });
    expect(summary.week[6].count).toBe(1);
    expect(summary.nextUp).toEqual([{ planId: plan.id, dayIndex: 1 }]);
    expect(summary.recentPrs[0].exerciseName).toBe('Barbell Bench Press');
  });

  it('counts consecutive days, and yesterday keeps the streak alive', () => {
    expect(streakFrom(['2026-10-23', '2026-10-22', '2026-10-21', '2026-10-19'], '2026-10-23')).toBe(3);
    expect(streakFrom(['2026-10-22', '2026-10-21'], '2026-10-23')).toBe(2);
    expect(streakFrom(['2026-10-20'], '2026-10-23')).toBe(0);
  });

  it('shows the last logged sets per exercise', async () => {
    await client.agent.post('/api/sessions').send(benchSession(50));
    const { previous } = (await client.agent.get(`/api/sessions/previous?exercises=${bench.id},${row.id}`)).body;
    expect(previous[bench.id].sets).toEqual([
      { reps: 8, weight: 50, done: true },
      { reps: 8, weight: 50, done: true },
    ]);
    expect(previous[row.id]).toBeUndefined();
  });
});

describe('history and reviews', () => {
  let sessionId;
  beforeEach(async () => {
    sessionId = (await client.agent.post('/api/sessions').send(benchSession(50))).body.session.id;
  });

  it('members see their own history; trainers see clients; others see nothing', async () => {
    expect((await client.agent.get('/api/sessions')).body.sessions).toHaveLength(1);
    expect((await stranger.agent.get('/api/sessions')).body.sessions).toHaveLength(0);
    expect((await stranger.agent.get(`/api/sessions/${sessionId}`)).status).toBe(404);

    const forTrainer = (await trainer.agent.get('/api/sessions?pendingReview=true')).body.sessions;
    expect(forTrainer.map((s) => s.member.name)).toEqual(['Mia Member']);

    const otherTrainer = await createAndLogin(owner.agent, 'TRAINER', 'trainer2@example.com');
    expect((await otherTrainer.agent.get('/api/sessions')).body.sessions).toEqual([]);
    expect((await otherTrainer.agent.get(`/api/sessions?member=${client.user.id}`)).body.sessions).toEqual([]);
    expect((await owner.agent.get('/api/sessions')).body.sessions).toHaveLength(1);
  });

  it("trainer reviews a client's workout and it leaves the pending list", async () => {
    const res = await trainer.agent.patch(`/api/sessions/${sessionId}/review`).send({ comment: 'Nice work, add 2.5 kg.' });
    expect(res.status).toBe(200);
    expect(res.body.session.review).toMatchObject({ comment: 'Nice work, add 2.5 kg.', reviewedBy: { name: 'TRAINER User' } });
    expect((await trainer.agent.get('/api/sessions?pendingReview=true')).body.sessions).toEqual([]);
    expect((await client.agent.patch(`/api/sessions/${sessionId}/review`).send({ comment: 'me' })).status).toBe(403);
  });
});

describe('join code rotation', () => {
  it('owner gets a new code; the old one stops working', async () => {
    const oldCode = owner.gym.joinCode;
    const res = await owner.agent.post('/api/gym/join-code');
    expect(res.status).toBe(200);
    expect(res.body.gym.joinCode).not.toBe(oldCode);
    expect((await request(app).get(`/api/gym/lookup?code=${oldCode}`)).status).toBe(404);
    expect((await trainer.agent.post('/api/gym/join-code')).status).toBe(403);
    expect(await WorkoutSession.countDocuments()).toBe(0);
  });
});

describe('workouts logged offline', () => {
  const clientId = '3f2b8c1e-7a4d-4e9b-9c2a-1d5e6f7a8b9c';

  it('saves a retried upload only once', async () => {
    const first = await client.agent.post('/api/sessions').send(benchSession(50, { clientId }));
    expect(first.status).toBe(201);

    const retry = await client.agent.post('/api/sessions').send(benchSession(50, { clientId }));
    expect(retry.status).toBe(200);
    expect(retry.body.session.id).toBe(first.body.session.id);
    expect(await WorkoutSession.countDocuments({ member: client.user.id })).toBe(1);
  });

  it('treats the same id from two members as two workouts', async () => {
    await registerMemberWithPlan();
    expect((await client.agent.post('/api/sessions').send(benchSession(50, { clientId }))).status).toBe(201);
    expect((await stranger.agent.post('/api/sessions').send(benchSession(50, { clientId }))).status).toBe(201);
  });

  it('keeps the real finish time of a workout uploaded later', async () => {
    const startedAt = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const completedAt = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const res = await client.agent
      .post('/api/sessions')
      .send(benchSession(50, { clientId, startedAt: startedAt.toISOString(), completedAt: completedAt.toISOString() }));
    expect(res.status).toBe(201);
    expect(new Date(res.body.session.completedAt).getTime()).toBe(completedAt.getTime());
    expect(res.body.session.durationSeconds).toBe(3600);
  });

  it('rejects finish times in the future or older than two weeks, and malformed ids', async () => {
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    expect((await client.agent.post('/api/sessions').send(benchSession(50, { completedAt: future }))).status).toBe(400);

    const old = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
    const tooOld = benchSession(50, { startedAt: new Date(old.getTime() - 3600_000).toISOString(), completedAt: old.toISOString() });
    expect((await client.agent.post('/api/sessions').send(tooOld)).status).toBe(400);

    expect((await client.agent.post('/api/sessions').send(benchSession(50, { clientId: 'not-a-uuid' }))).status).toBe(400);
  });

  it('allows a few minutes of clock difference between phone and server', async () => {
    const slightlyAhead = new Date(Date.now() + 60 * 1000).toISOString();
    const res = await client.agent.post('/api/sessions').send(benchSession(50, { completedAt: slightlyAhead }));
    expect(res.status).toBe(201);
    expect(new Date(res.body.session.completedAt).getTime()).toBeLessThanOrEqual(Date.now());
  });
});

// The stranger joins the same plan so both members can log the same day.
async function registerMemberWithPlan() {
  await owner.agent.patch(`/api/users/${stranger.user.id}/trainer`).send({ trainerId: trainer.user.id });
  await trainer.agent.put(`/api/plans/${plan.id}/assignees`).send({ memberIds: [client.user.id, stranger.user.id] });
}
