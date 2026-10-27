const LIBRARY = require('../src/data/exercises');
const { MUSCLE_IDS, MOVEMENT_PATTERNS } = require('../src/config/anatomy');
const { loadExerciseLibrary } = require('../src/data/loadExercises');
const { startDb, clearDb, stopDb, registerOwner, createAndLogin } = require('./helpers');

describe('anatomy data in the built-in library', () => {
  it('uses unique, kebab-case muscle IDs', () => {
    expect(new Set(MUSCLE_IDS).size).toBe(MUSCLE_IDS.length);
    for (const id of MUSCLE_IDS) expect(id).toMatch(/^[a-z]+(-[a-z]+)*$/);
  });

  it.each(LIBRARY.map((e) => [e.name, e]))('%s has a pattern, at least one primary muscle, and no overlaps', (_name, e) => {
    expect(MOVEMENT_PATTERNS).toContain(e.movementPattern);
    expect(e.primaryMuscles.length).toBeGreaterThan(0);
    for (const m of [...e.primaryMuscles, ...e.secondaryMuscles]) expect(MUSCLE_IDS).toContain(m);
    expect(e.primaryMuscles.filter((m) => e.secondaryMuscles.includes(m))).toEqual([]);
  });
});

describe('exercise API with muscles', () => {
  beforeAll(startDb);
  afterEach(clearDb);
  afterAll(stopDb);

  let trainer;
  beforeEach(async () => {
    await loadExerciseLibrary();
    const owner = await registerOwner();
    trainer = await createAndLogin(owner.agent, 'TRAINER', 'trainer@example.com');
  });

  it('returns muscles and filters by a muscle as primary or secondary', async () => {
    const all = (await trainer.agent.get('/api/exercises')).body.exercises;
    expect(all.find((e) => e.name === 'Barbell Bench Press')).toMatchObject({
      movementPattern: 'HORIZONTAL_PUSH',
      primaryMuscles: ['pectoralis-major'],
      secondaryMuscles: ['anterior-deltoid', 'triceps-brachii'],
    });
    const triceps = (await trainer.agent.get('/api/exercises?muscle=triceps-brachii')).body.exercises.map((e) => e.name);
    // Primary (pushdown) and secondary (bench press) both count.
    expect(triceps).toEqual(expect.arrayContaining(['Triceps Pushdown', 'Barbell Bench Press']));
    expect(triceps).not.toContain('Back Squat');
    expect((await trainer.agent.get('/api/exercises?muscle=not-a-muscle')).status).toBe(400);
  });

  it('custom exercises may set muscles; a muscle cannot be both primary and secondary', async () => {
    const base = { name: 'Landmine Press', muscleGroup: 'SHOULDERS', equipment: 'BARBELL' };
    const ok = await trainer.agent.post('/api/exercises').send({ ...base, primaryMuscles: ['anterior-deltoid'], secondaryMuscles: ['triceps-brachii'] });
    expect(ok.status).toBe(201);
    expect(ok.body.exercise.primaryMuscles).toEqual(['anterior-deltoid']);
    const clash = await trainer.agent.post('/api/exercises').send({ ...base, name: 'Other', primaryMuscles: ['anterior-deltoid'], secondaryMuscles: ['anterior-deltoid'] });
    expect(clash.status).toBe(400);
    const plain = await trainer.agent.post('/api/exercises').send({ ...base, name: 'Plain' });
    expect(plain.body.exercise).toMatchObject({ primaryMuscles: [], secondaryMuscles: [], movementPattern: null });
  });
});
