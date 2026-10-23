const { slotsForDay } = require('../src/controllers/schedule.controller');
const { dayKey, addDays } = require('../src/utils/dates');
const { startDb, clearDb, stopDb, registerOwner, registerMember, createAndLogin } = require('./helpers');

beforeAll(startDb);
afterEach(clearDb);
afterAll(stopDb);

const ALL_WEEK = [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, start: '07:00', end: '10:00' }));
const tomorrow = addDays(dayKey(new Date()), 1);
// Tomorrow 08:00 UTC (tz 0 throughout these tests).
const at = (hhmm, day = tomorrow) => new Date(`${day}T${hhmm}:00.000Z`).toISOString();

let owner, trainer, client, other;
beforeEach(async () => {
  owner = await registerOwner();
  trainer = await createAndLogin(owner.agent, 'TRAINER', 'trainer@example.com');
  client = await registerMember(owner.gym.joinCode, { email: 'client@example.com' });
  other = await registerMember(owner.gym.joinCode, { email: 'other@example.com', name: 'Omar Other' });
  for (const m of [client, other]) await owner.agent.patch(`/api/users/${m.user.id}/trainer`).send({ trainerId: trainer.user.id });
  await trainer.agent.put('/api/schedule/availability').send({ weekly: ALL_WEEK, sessionMinutes: 60 });
});

describe('availability and slots', () => {
  it('cuts slots from weekly hours in the given timezone', () => {
    const slots = slotsForDay({ weekly: [{ day: 3, start: '07:00', end: '09:30' }], sessionMinutes: 60 }, '2026-10-28', -330);
    // 28 Oct 2026 is a Wednesday; 07:00 IST is 01:30 UTC. 09:30 leaves room for two full hours.
    expect(slots.map((s) => s.startsAt.toISOString())).toEqual(['2026-10-28T01:30:00.000Z', '2026-10-28T02:30:00.000Z']);
  });

  it('rejects overlapping or backwards hours, and only trainers set them', async () => {
    expect((await trainer.agent.put('/api/schedule/availability').send({ weekly: [{ day: 1, start: '09:00', end: '08:00' }], sessionMinutes: 60 })).status).toBe(400);
    const overlap = [{ day: 1, start: '07:00', end: '10:00' }, { day: 1, start: '09:00', end: '11:00' }];
    expect((await trainer.agent.put('/api/schedule/availability').send({ weekly: overlap, sessionMinutes: 60 })).status).toBe(400);
    expect((await owner.agent.put('/api/schedule/availability').send({ weekly: ALL_WEEK, sessionMinutes: 60 })).status).toBe(403);
    expect((await client.agent.put('/api/schedule/availability').send({ weekly: ALL_WEEK, sessionMinutes: 60 })).status).toBe(403);
  });

  it("members see their own trainer's slots, with taken ones marked", async () => {
    await client.agent.post('/api/schedule/bookings').send({ startsAt: at('08:00') });
    const { days, trainer: t } = (await other.agent.get(`/api/schedule/slots?from=${tomorrow}&days=1`)).body;
    expect(t.name).toBe('TRAINER User');
    expect(days[0].slots.map((s) => [s.startsAt.slice(11, 16), s.available])).toEqual([
      ['07:00', true],
      ['08:00', false],
      ['09:00', true],
    ]);
  });
});

describe('booking', () => {
  it('books a valid slot once; a second booking of that slot is refused', async () => {
    const res = await client.agent.post('/api/schedule/bookings').send({ startsAt: at('08:00'), notes: 'Focus on squats' });
    expect(res.status).toBe(201);
    expect(res.body.booking).toMatchObject({ status: 'BOOKED', trainer: { name: 'TRAINER User' }, endsAt: at('09:00') });
    expect((await other.agent.post('/api/schedule/bookings').send({ startsAt: at('08:00') })).status).toBe(409);
  });

  it('refuses times outside hours, off the grid, or in the past', async () => {
    expect((await client.agent.post('/api/schedule/bookings').send({ startsAt: at('12:00') })).status).toBe(400);
    expect((await client.agent.post('/api/schedule/bookings').send({ startsAt: at('08:30') })).status).toBe(400);
    expect((await client.agent.post('/api/schedule/bookings').send({ startsAt: new Date(Date.now() - 3600e3).toISOString() })).status).toBe(400);
  });

  it('members without a trainer are told so; trainers book only their own clients', async () => {
    const loner = await registerMember(owner.gym.joinCode, { email: 'loner@example.com' });
    expect((await loner.agent.post('/api/schedule/bookings').send({ startsAt: at('08:00') })).body.message).toMatch(/don't have a trainer/);
    expect((await trainer.agent.post('/api/schedule/bookings').send({ startsAt: at('07:00'), memberId: loner.user.id })).status).toBe(404);
    expect((await trainer.agent.post('/api/schedule/bookings').send({ startsAt: at('07:00'), memberId: client.user.id })).status).toBe(201);
  });

  it('lists by role, cancels, frees the slot, and blocks marking future sessions', async () => {
    const { booking } = (await client.agent.post('/api/schedule/bookings').send({ startsAt: at('08:00') })).body;
    expect((await client.agent.get('/api/schedule/bookings')).body.bookings).toHaveLength(1);
    expect((await other.agent.get('/api/schedule/bookings')).body.bookings).toHaveLength(0);
    expect((await trainer.agent.get('/api/schedule/bookings')).body.bookings).toHaveLength(1);
    expect((await owner.agent.get('/api/schedule/bookings')).body.bookings).toHaveLength(1);

    expect((await trainer.agent.patch(`/api/schedule/bookings/${booking.id}/status`).send({ status: 'COMPLETED' })).status).toBe(400);
    expect((await other.agent.post(`/api/schedule/bookings/${booking.id}/cancel`)).status).toBe(404);
    expect((await client.agent.post(`/api/schedule/bookings/${booking.id}/cancel`)).body.booking.status).toBe('CANCELLED');
    expect((await other.agent.post('/api/schedule/bookings').send({ startsAt: at('08:00') })).status).toBe(201);
  });
});

describe('classes', () => {
  const classBody = (overrides = {}) => ({ title: 'HIIT Blast', startsAt: at('18:00'), durationMinutes: 45, capacity: 1, location: 'Studio 1', ...overrides });

  it('creates weekly repeats and enforces capacity', async () => {
    const res = await trainer.agent.post('/api/schedule/classes').send(classBody({ repeatWeeks: 3 }));
    expect(res.status).toBe(201);
    expect(res.body.classes).toHaveLength(3);
    expect(res.body.classes[0]).toMatchObject({ trainer: { name: 'TRAINER User' }, spotsLeft: 1 });
    expect(new Date(res.body.classes[1].startsAt) - new Date(res.body.classes[0].startsAt)).toBe(7 * 24 * 3600e3);

    const id = res.body.classes[0].id;
    expect((await client.agent.post(`/api/schedule/classes/${id}/join`)).body.class.spotsLeft).toBe(0);
    expect((await client.agent.post(`/api/schedule/classes/${id}/join`)).status).toBe(409);
    const full = await other.agent.post(`/api/schedule/classes/${id}/join`);
    expect(full.status).toBe(409);
    expect(full.body.message).toMatch(/full/);

    await client.agent.post(`/api/schedule/classes/${id}/leave`);
    expect((await other.agent.post(`/api/schedule/classes/${id}/join`)).status).toBe(200);
  });

  it('a class blocks the trainer for 1-on-1s at the same time', async () => {
    await trainer.agent.post('/api/schedule/classes').send(classBody({ startsAt: at('08:00') }));
    const slots = (await client.agent.get(`/api/schedule/slots?from=${tomorrow}&days=1`)).body.days[0].slots;
    expect(slots.find((s) => s.startsAt === at('08:00')).available).toBe(false);
    expect((await client.agent.post('/api/schedule/bookings').send({ startsAt: at('08:00') })).status).toBe(409);
  });

  it('only staff create, only the right people cancel, and cancelled classes cannot be joined', async () => {
    expect((await client.agent.post('/api/schedule/classes').send(classBody())).status).toBe(403);
    const id = (await owner.agent.post('/api/schedule/classes').send(classBody({ trainerId: null }))).body.classes[0].id;
    const otherTrainer = await createAndLogin(owner.agent, 'TRAINER', 'trainer2@example.com');
    expect((await otherTrainer.agent.post(`/api/schedule/classes/${id}/cancel`)).status).toBe(403);
    expect((await owner.agent.post(`/api/schedule/classes/${id}/cancel`)).status).toBe(200);
    expect((await client.agent.post(`/api/schedule/classes/${id}/join`)).body.message).toMatch(/cancelled/);
  });
});
