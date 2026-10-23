const Exercise = require('../src/models/Exercise');
const { loadExerciseLibrary } = require('../src/data/loadExercises');
const { estimateOneRepMax } = require('../src/controllers/progress.controller');
const { startDb, clearDb, stopDb, registerOwner, registerMember, createAndLogin } = require('./helpers');

beforeAll(startDb);
afterEach(clearDb);
afterAll(stopDb);

let owner, trainer, client, stranger, plan, bench;

beforeEach(async () => {
  await loadExerciseLibrary();
  bench = await Exercise.findOne({ name: 'Barbell Bench Press' });
  owner = await registerOwner();
  trainer = await createAndLogin(owner.agent, 'TRAINER', 'trainer@example.com');
  client = await registerMember(owner.gym.joinCode, { email: 'client@example.com' });
  stranger = await registerMember(owner.gym.joinCode, { email: 'stranger@example.com' });
  await owner.agent.patch(`/api/users/${client.user.id}/trainer`).send({ trainerId: trainer.user.id });
  plan = (
    await trainer.agent
      .post('/api/plans')
      .send({ name: 'Bench', days: [{ name: 'Push', exercises: [{ exercise: bench.id, sets: 3, reps: '5' }] }] })
  ).body.plan;
  await trainer.agent.put(`/api/plans/${plan.id}/assignees`).send({ memberIds: [client.user.id] });
});

const logBench = (sets) =>
  client.agent.post('/api/sessions').send({
    planId: plan.id,
    dayIndex: 0,
    startedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    entries: [{ exercise: bench.id, sets }],
  });

describe('body metrics and goal', () => {
  it('logs a day, updates the same day instead of duplicating, and lists oldest first', async () => {
    await client.agent.put('/api/progress/metrics').send({ day: '2026-10-20', weight: 63.1 });
    await client.agent.put('/api/progress/metrics').send({ day: '2026-10-13', weight: 63.8, measurements: { waist: 74 } });
    const updated = await client.agent.put('/api/progress/metrics').send({ day: '2026-10-20', bodyFat: 23 });
    expect(updated.body.metric).toMatchObject({ day: '2026-10-20', weight: 63.1, bodyFat: 23 });

    const { metrics } = (await client.agent.get('/api/progress/metrics')).body;
    expect(metrics.map((m) => m.day)).toEqual(['2026-10-13', '2026-10-20']);
    expect(metrics[0].measurements.waist).toBe(74);
  });

  it('rejects empty or out-of-range entries', async () => {
    expect((await client.agent.put('/api/progress/metrics').send({ day: '2026-10-20' })).status).toBe(400);
    expect((await client.agent.put('/api/progress/metrics').send({ day: '2026-10-20', weight: 900 })).status).toBe(400);
    expect((await client.agent.put('/api/progress/metrics').send({ day: '20-10-2026', weight: 60 })).status).toBe(400);
  });

  it('sets a goal and deletes only your own entries', async () => {
    expect((await client.agent.put('/api/progress/goal').send({ targetWeight: 60 })).body.goal.targetWeight).toBe(60);
    expect((await client.agent.get('/api/progress/metrics')).body.goal.targetWeight).toBe(60);

    const { metric } = (await client.agent.put('/api/progress/metrics').send({ day: '2026-10-20', weight: 63 })).body;
    expect((await stranger.agent.delete(`/api/progress/metrics/${metric.id}`)).status).toBe(404);
    expect((await client.agent.delete(`/api/progress/metrics/${metric.id}`)).status).toBe(204);
  });

  it("trainers read their clients' progress but cannot write it; others are kept out", async () => {
    await client.agent.put('/api/progress/metrics').send({ day: '2026-10-20', weight: 63 });
    const read = await trainer.agent.get(`/api/progress/metrics?member=${client.user.id}`);
    expect(read.status).toBe(200);
    expect(read.body.member.id).toBe(client.user.id);
    expect((await trainer.agent.get('/api/progress/metrics')).status).toBe(400);
    expect((await trainer.agent.get(`/api/progress/metrics?member=${stranger.user.id}`)).status).toBe(404);
    expect((await owner.agent.get(`/api/progress/metrics?member=${stranger.user.id}`)).status).toBe(200);
    expect((await trainer.agent.put('/api/progress/metrics').send({ day: '2026-10-20', weight: 70 })).status).toBe(403);
    // A member asking about someone else still only ever gets themselves.
    expect((await stranger.agent.get(`/api/progress/metrics?member=${client.user.id}`)).body.member.id).toBe(stranger.user.id);
  });
});

describe('strength and training volume', () => {
  it('estimates one-rep max with Epley', () => {
    expect(estimateOneRepMax(100, 1)).toBe(100);
    expect(estimateOneRepMax(60, 10)).toBe(80);
  });

  it('builds a per-session strength series from completed sets', async () => {
    await logBench([
      { reps: 5, weight: 50, done: true },
      { reps: 8, weight: 45, done: true },
      { reps: 5, weight: 70, done: false },
    ]);
    await logBench([{ reps: 5, weight: 55, done: true }]);

    const res = await client.agent.get(`/api/progress/strength?exercise=${bench.id}`);
    expect(res.status).toBe(200);
    expect(res.body.exercise.name).toBe('Barbell Bench Press');
    expect(res.body.points).toHaveLength(2);
    // 50 × 5 (est. 58.3) beats 45 × 8 (est. 57.0); the 70 kg set wasn't completed, so it's ignored.
    expect(res.body.points[0]).toMatchObject({ bestWeight: 50, e1rm: 58.3, reps: 13, volume: 610 });
    expect(res.body.points[1].bestWeight).toBe(55);
  });

  it('summarises weekly volume and lists logged exercises', async () => {
    await logBench([{ reps: 5, weight: 50, done: true }]);
    const res = await client.agent.get('/api/progress/training?weeks=4');
    expect(res.body.weekly).toHaveLength(4);
    expect(res.body.weekly[3]).toMatchObject({ workouts: 1, volume: 250 });
    expect(res.body.exercises).toEqual([
      { exercise: bench.id, name: 'Barbell Bench Press', muscleGroup: 'CHEST', sessions: 1, bestWeight: 50 },
    ]);
    expect((await trainer.agent.get(`/api/progress/training?member=${client.user.id}`)).status).toBe(200);
  });

  it('404s for an exercise with no logged sets', async () => {
    expect((await client.agent.get(`/api/progress/strength?exercise=${bench.id}`)).status).toBe(404);
  });
});
