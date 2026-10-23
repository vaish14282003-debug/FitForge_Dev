const request = require('supertest');
const Exercise = require('../src/models/Exercise');
const { loadExerciseLibrary } = require('../src/data/loadExercises');
const { app, startDb, clearDb, stopDb, registerOwner, registerMember, createAndLogin } = require('./helpers');

beforeAll(startDb);
afterEach(clearDb);
afterAll(stopDb);

let owner, trainer, client, otherMember, library;

beforeEach(async () => {
  await loadExerciseLibrary();
  library = await Exercise.find({ gym: null }).limit(3);
  owner = await registerOwner();
  trainer = await createAndLogin(owner.agent, 'TRAINER', 'trainer@example.com');
  client = await registerMember(owner.gym.joinCode, { email: 'client@example.com' });
  otherMember = await registerMember(owner.gym.joinCode, { email: 'other@example.com' });
  await owner.agent.patch(`/api/users/${client.user.id}/trainer`).send({ trainerId: trainer.user.id });
});

const planBody = (overrides = {}) => ({
  name: 'Push Pull Legs',
  days: [
    {
      name: 'Push',
      exercises: [
        { exercise: library[0].id, sets: 4, reps: '8-12', weight: 40 },
        { exercise: library[1].id, sets: 3, reps: '10' },
      ],
    },
  ],
  ...overrides,
});

describe('exercise library', () => {
  it('shows the built-in library to everyone, filtered by muscle group or name', async () => {
    const all = await client.agent.get('/api/exercises');
    expect(all.status).toBe(200);
    expect(all.body.exercises.length).toBe(30);

    const chest = await client.agent.get('/api/exercises?muscleGroup=CHEST');
    expect(chest.body.exercises.every((e) => e.muscleGroup === 'CHEST')).toBe(true);

    const search = await client.agent.get('/api/exercises?q=squat');
    expect(search.body.exercises.map((e) => e.name)).toEqual(['Back Squat']);
  });

  it('lets trainers add gym exercises, rejects duplicates, and blocks members', async () => {
    const body = { name: 'Landmine Press', muscleGroup: 'SHOULDERS', equipment: 'BARBELL' };
    const created = await trainer.agent.post('/api/exercises').send(body);
    expect(created.status).toBe(201);
    expect(created.body.exercise.isCustom).toBe(true);

    expect((await trainer.agent.post('/api/exercises').send({ ...body, name: 'landmine press' })).status).toBe(409);
    expect((await client.agent.post('/api/exercises').send(body)).status).toBe(403);
  });

  it("keeps a gym's custom exercises away from other gyms", async () => {
    await trainer.agent.post('/api/exercises').send({ name: 'Secret Move', muscleGroup: 'CORE', equipment: 'OTHER' });
    const other = await registerOwner({ email: 'owner-b@example.com', gymName: 'Steel House' });
    const names = (await other.agent.get('/api/exercises?q=secret')).body.exercises;
    expect(names).toEqual([]);
  });
});

describe('workout plans', () => {
  it('trainer creates a plan with exercises filled in', async () => {
    const res = await trainer.agent.post('/api/plans').send(planBody());
    expect(res.status).toBe(201);
    expect(res.body.plan.days[0].exercises[0]).toMatchObject({ sets: 4, reps: '8-12', weight: 40 });
    expect(res.body.plan.days[0].exercises[0].exercise.name).toBe(library[0].name);
    expect(res.body.plan.createdBy.name).toBe('TRAINER User');
  });

  it('validates plan shape and exercise access', async () => {
    expect((await trainer.agent.post('/api/plans').send(planBody({ days: [] }))).status).toBe(400);
    const badReps = planBody();
    badReps.days[0].exercises[0].reps = 'lots';
    expect((await trainer.agent.post('/api/plans').send(badReps)).status).toBe(400);

    const other = await registerOwner({ email: 'owner-b@example.com', gymName: 'Steel House' });
    const foreign = (await other.agent.post('/api/exercises').send({ name: 'Foreign', muscleGroup: 'CORE', equipment: 'OTHER' }))
      .body.exercise;
    const withForeign = planBody();
    withForeign.days[0].exercises[0].exercise = foreign.id;
    expect((await trainer.agent.post('/api/plans').send(withForeign)).status).toBe(400);
  });

  it('members cannot create plans', async () => {
    expect((await client.agent.post('/api/plans').send(planBody())).status).toBe(403);
  });

  it('trainers assign only their own clients; owners can assign anyone in the gym', async () => {
    const plan = (await trainer.agent.post('/api/plans').send(planBody())).body.plan;

    const notMine = await trainer.agent.put(`/api/plans/${plan.id}/assignees`).send({ memberIds: [otherMember.user.id] });
    expect(notMine.status).toBe(400);

    const mine = await trainer.agent.put(`/api/plans/${plan.id}/assignees`).send({ memberIds: [client.user.id] });
    expect(mine.status).toBe(200);
    expect(mine.body.plan.assignedTo.map((u) => u.id)).toEqual([client.user.id]);

    const byOwner = await owner.agent
      .put(`/api/plans/${plan.id}/assignees`)
      .send({ memberIds: [client.user.id, otherMember.user.id] });
    expect(byOwner.status).toBe(200);
  });

  it('members see only plans assigned to them, read-only', async () => {
    const plan = (await trainer.agent.post('/api/plans').send(planBody())).body.plan;
    await trainer.agent.put(`/api/plans/${plan.id}/assignees`).send({ memberIds: [client.user.id] });

    expect((await client.agent.get('/api/plans')).body.plans.map((p) => p.id)).toEqual([plan.id]);
    expect((await client.agent.get(`/api/plans/${plan.id}`)).status).toBe(200);
    expect((await otherMember.agent.get('/api/plans')).body.plans).toEqual([]);
    expect((await otherMember.agent.get(`/api/plans/${plan.id}`)).status).toBe(404);
    expect((await client.agent.put(`/api/plans/${plan.id}`).send(planBody())).status).toBe(403);
  });

  it('trainers manage only their own plans; owners manage all', async () => {
    const plan = (await trainer.agent.post('/api/plans').send(planBody())).body.plan;
    const otherTrainer = await createAndLogin(owner.agent, 'TRAINER', 'trainer2@example.com');

    expect((await otherTrainer.agent.get('/api/plans')).body.plans).toEqual([]);
    expect((await otherTrainer.agent.put(`/api/plans/${plan.id}`).send(planBody())).status).toBe(404);

    const renamed = await owner.agent.put(`/api/plans/${plan.id}`).send(planBody({ name: 'Renamed' }));
    expect(renamed.body.plan.name).toBe('Renamed');

    expect((await trainer.agent.delete(`/api/plans/${plan.id}`)).status).toBe(204);
    expect((await owner.agent.get(`/api/plans/${plan.id}`)).status).toBe(404);
  });

  it('keeps plans inside their gym', async () => {
    const plan = (await trainer.agent.post('/api/plans').send(planBody())).body.plan;
    const other = await registerOwner({ email: 'owner-b@example.com', gymName: 'Steel House' });
    expect((await other.agent.get(`/api/plans/${plan.id}`)).status).toBe(404);
    expect((await other.agent.delete(`/api/plans/${plan.id}`)).status).toBe(404);
  });
});
