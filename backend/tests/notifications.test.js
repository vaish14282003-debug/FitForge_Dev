const Exercise = require('../src/models/Exercise');
const { loadExerciseLibrary } = require('../src/data/loadExercises');
const { addDays, addMonths, dayKey, periodEnd } = require('../src/utils/dates');
const { startDb, clearDb, stopDb, registerOwner, registerMember, createAndLogin } = require('./helpers');

beforeAll(startDb);
afterEach(clearDb);
afterAll(stopDb);

let owner, trainer, staff, client, other;
beforeEach(async () => {
  owner = await registerOwner();
  trainer = await createAndLogin(owner.agent, 'TRAINER', 'trainer@example.com');
  staff = await createAndLogin(owner.agent, 'STAFF', 'staff@example.com');
  client = await registerMember(owner.gym.joinCode, { email: 'client@example.com' });
  other = await registerMember(owner.gym.joinCode, { email: 'other@example.com', name: 'Omar Other' });
  await owner.agent.patch(`/api/users/${client.user.id}/trainer`).send({ trainerId: trainer.user.id });
});

const inbox = async (agent) => (await agent.get('/api/notifications')).body;

it('alerts a member when a plan is assigned and when their workout is reviewed', async () => {
  await loadExerciseLibrary();
  const bench = await Exercise.findOne({ name: 'Barbell Bench Press' });
  const plan = (await trainer.agent.post('/api/plans').send({ name: 'Push', days: [{ name: 'Push', exercises: [{ exercise: bench.id, sets: 3, reps: '5' }] }] })).body.plan;
  await trainer.agent.put(`/api/plans/${plan.id}/assignees`).send({ memberIds: [client.user.id] });
  // Re-saving the same assignees doesn't alert again.
  await trainer.agent.put(`/api/plans/${plan.id}/assignees`).send({ memberIds: [client.user.id] });

  let box = await inbox(client.agent);
  expect(box.unread).toBe(1);
  expect(box.notifications[0]).toMatchObject({ type: 'PLAN_ASSIGNED', title: 'New plan: Push', link: '/workouts', actor: { name: 'TRAINER User' } });

  const session = (
    await client.agent.post('/api/sessions').send({ planId: plan.id, dayIndex: 0, startedAt: new Date(Date.now() - 6e5).toISOString(), entries: [{ exercise: bench.id, sets: [{ reps: 5, weight: 40, done: true }] }] })
  ).body.session;
  await trainer.agent.patch(`/api/sessions/${session.id}/review`).send({ comment: 'Great depth' });
  box = await inbox(client.agent);
  expect(box.notifications[0]).toMatchObject({ type: 'WORKOUT_REVIEWED', body: 'Great depth' });
  expect((await inbox(trainer.agent)).unread).toBe(0);
});

it('marks one or all read, and keeps inboxes private', async () => {
  await owner.agent.post('/api/announcements').send({ title: 'Closed Monday', body: 'Deep clean' });
  await owner.agent.post('/api/announcements').send({ title: 'New kettlebells', body: 'Arrived today' });
  const box = await inbox(client.agent);
  expect(box.unread).toBe(2);
  expect((await other.agent.post(`/api/notifications/${box.notifications[0].id}/read`)).status).toBe(404);
  await client.agent.post(`/api/notifications/${box.notifications[0].id}/read`);
  expect((await client.agent.get('/api/notifications/unread-count')).body.unread).toBe(1);
  await client.agent.post('/api/notifications/read-all');
  expect((await client.agent.get('/api/notifications/unread-count')).body.unread).toBe(0);
});

it('announcements reach their audience only, and only owners post them', async () => {
  const res = await owner.agent.post('/api/announcements').send({ title: 'Trainer meeting', body: 'Friday 9am', audience: 'TRAINERS', pinned: true });
  expect(res.status).toBe(201);
  expect(res.body.notified).toBe(1);
  expect((await inbox(trainer.agent)).notifications[0].type).toBe('ANNOUNCEMENT');
  expect((await inbox(client.agent)).unread).toBe(0);
  expect((await client.agent.get('/api/announcements')).body.announcements).toEqual([]);
  expect((await trainer.agent.get('/api/announcements')).body.announcements[0]).toMatchObject({ title: 'Trainer meeting', pinned: true });
  expect((await staff.agent.post('/api/announcements').send({ title: 'x', body: 'y' })).status).toBe(403);
  expect((await owner.agent.delete(`/api/announcements/${res.body.announcement.id}`)).status).toBe(204);
});

it('trainers message only their own clients', async () => {
  expect((await trainer.agent.post('/api/notifications/messages').send({ memberIds: [client.user.id], title: 'Hydrate!' })).body.sent).toBe(1);
  expect((await inbox(client.agent)).notifications[0]).toMatchObject({ type: 'MESSAGE', title: 'Hydrate!' });
  expect((await trainer.agent.post('/api/notifications/messages').send({ memberIds: [other.user.id], title: 'Hi' })).status).toBe(400);
  expect((await client.agent.post('/api/notifications/messages').send({ memberIds: [other.user.id], title: 'Hi' })).status).toBe(403);
});

it('booking and cancelling alert the other person', async () => {
  const tomorrow = addDays(dayKey(new Date()), 1);
  await trainer.agent.put('/api/schedule/availability').send({ weekly: [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, start: '07:00', end: '09:00' })), sessionMinutes: 60 });
  const { booking } = (await client.agent.post('/api/schedule/bookings').send({ startsAt: `${tomorrow}T07:00:00.000Z` })).body;
  expect((await inbox(trainer.agent)).notifications[0]).toMatchObject({ type: 'BOOKING_CREATED', title: 'Mia Member booked a session' });
  await trainer.agent.post(`/api/schedule/bookings/${booking.id}/cancel`);
  expect((await inbox(client.agent)).notifications[0].type).toBe('BOOKING_CANCELLED');
});

it('memberships: added on sale, and a single expiring alert near the end', async () => {
  const plan = (await owner.agent.post('/api/membership-plans').send({ name: 'Monthly', durationMonths: 1, price: 1500 })).body.plan;
  // A one-month membership ending within the 3-day warning window. Some end dates can't exist
  // (month-end clamping), so take the first reachable one.
  const today = dayKey(new Date());
  const candidates = [1, 2, 0].flatMap((left) => [-4, -3, -2, -1, 0, 1, 2, 3, 4].map((o) => ({ left, start: addDays(addMonths(addDays(today, left), -1), o) })));
  const { start, left } = candidates.find((c) => periodEnd(c.start, 1) === addDays(today, c.left));
  await staff.agent.post('/api/memberships').send({ memberId: client.user.id, planId: plan.id, startDate: start, payment: { status: 'PAID', method: 'UPI' } });
  await client.agent.get('/api/notifications');
  const box = await inbox(client.agent);
  expect(box.notifications.map((n) => n.type).sort()).toEqual(['MEMBERSHIP_ADDED', 'MEMBERSHIP_EXPIRING']);
  const expected = left === 0 ? 'Your membership ends today' : `Your membership ends in ${left} day${left === 1 ? '' : 's'}`;
  expect(box.notifications.find((n) => n.type === 'MEMBERSHIP_EXPIRING').title).toBe(expected);
});
