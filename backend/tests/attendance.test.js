const jwt = require('jsonwebtoken');
const request = require('supertest');
const { QR_SECRET } = require('../src/controllers/attendance.controller');
const { app, startDb, clearDb, stopDb, registerOwner, registerMember, createAndLogin } = require('./helpers');

beforeAll(startDb);
afterEach(clearDb);
afterAll(stopDb);

let owner, staff, trainer, client, other;

beforeEach(async () => {
  owner = await registerOwner();
  staff = await createAndLogin(owner.agent, 'STAFF', 'staff@example.com');
  trainer = await createAndLogin(owner.agent, 'TRAINER', 'trainer@example.com');
  client = await registerMember(owner.gym.joinCode, { email: 'client@example.com' });
  other = await registerMember(owner.gym.joinCode, { email: 'other@example.com' });
  await owner.agent.patch(`/api/users/${client.user.id}/trainer`).send({ trainerId: trainer.user.id });
});

const qrToken = async (agent = staff.agent) => (await agent.get('/api/attendance/qr')).body.token;

describe('QR check-in', () => {
  it('front desk gets a 2-minute token; members cannot', async () => {
    const res = await staff.agent.get('/api/attendance/qr');
    expect(res.status).toBe(200);
    expect(res.body.ttlSeconds).toBe(120);
    expect((await owner.agent.get('/api/attendance/qr')).status).toBe(200);
    expect((await client.agent.get('/api/attendance/qr')).status).toBe(403);
    expect((await trainer.agent.get('/api/attendance/qr')).status).toBe(403);
  });

  it('checks a member in once per day', async () => {
    const token = await qrToken();
    const first = await client.agent.post('/api/attendance/check-in').send({ token });
    expect(first.status).toBe(201);
    expect(first.body).toMatchObject({ alreadyCheckedIn: false, attendance: { method: 'QR' } });

    const again = await client.agent.post('/api/attendance/check-in').send({ token: await qrToken() });
    expect(again.status).toBe(200);
    expect(again.body.alreadyCheckedIn).toBe(true);
    expect(again.body.attendance.id).toBe(first.body.attendance.id);
  });

  it('rejects expired, forged and other-gym codes', async () => {
    const expired = jwt.sign({ gym: owner.gym.id, purpose: 'checkin', exp: Math.floor(Date.now() / 1000) - 10 }, QR_SECRET);
    const res = await client.agent.post('/api/attendance/check-in').send({ token: expired });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/expired/);

    const forged = jwt.sign({ gym: owner.gym.id, purpose: 'checkin' }, 'not-the-secret');
    expect((await client.agent.post('/api/attendance/check-in').send({ token: forged })).status).toBe(400);

    const otherGym = await registerOwner({ email: 'owner-b@example.com', gymName: 'Steel House' });
    const foreign = await client.agent.post('/api/attendance/check-in').send({ token: await qrToken(otherGym.agent) });
    expect(foreign.status).toBe(400);
    expect(foreign.body.message).toMatch(/different gym/);
  });

  it('a check-in token cannot be used as a login token', async () => {
    const token = await qrToken();
    expect((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`)).status).toBe(401);
  });

  it('only members check themselves in', async () => {
    expect((await trainer.agent.post('/api/attendance/check-in').send({ token: await qrToken() })).status).toBe(403);
  });
});

describe('front desk and reporting', () => {
  it('staff check a member in by hand; members of other gyms are not found', async () => {
    const res = await staff.agent.post('/api/attendance').send({ memberId: client.user.id });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ member: { name: 'Mia Member' }, attendance: { method: 'STAFF' } });
    expect((await client.agent.post('/api/attendance').send({ memberId: other.user.id })).status).toBe(403);

    const otherGym = await registerOwner({ email: 'owner-b@example.com', gymName: 'Steel House' });
    expect((await otherGym.agent.post('/api/attendance').send({ memberId: client.user.id })).status).toBe(404);
  });

  it('member summary reflects today and the month', async () => {
    let summary = (await client.agent.get('/api/attendance/summary')).body.summary;
    expect(summary).toMatchObject({ checkedInToday: false, thisMonth: 0, total: 0, days: [] });

    await client.agent.post('/api/attendance/check-in').send({ token: await qrToken() });
    summary = (await client.agent.get('/api/attendance/summary')).body.summary;
    expect(summary).toMatchObject({ checkedInToday: true, thisMonth: 1, last30Days: 1, total: 1 });
    expect(summary.days).toHaveLength(1);
  });

  it('scopes summaries: trainers see clients, staff see the gym, members only themselves', async () => {
    expect((await trainer.agent.get(`/api/attendance/summary?member=${client.user.id}`)).status).toBe(200);
    expect((await trainer.agent.get(`/api/attendance/summary?member=${other.user.id}`)).status).toBe(404);
    expect((await staff.agent.get(`/api/attendance/summary?member=${other.user.id}`)).status).toBe(200);
    expect((await trainer.agent.get('/api/attendance/summary')).status).toBe(400);
  });

  it("stats count today's visits per gym", async () => {
    await client.agent.post('/api/attendance/check-in').send({ token: await qrToken() });
    await staff.agent.post('/api/attendance').send({ memberId: other.user.id });
    const { stats } = (await owner.agent.get('/api/attendance/stats?days=7')).body;
    expect(stats.today).toBe(2);
    expect(stats.daily).toHaveLength(7);
    expect(stats.daily[6].count).toBe(2);
    expect(stats.checkIns.map((c) => c.member.email).sort()).toEqual(['client@example.com', 'other@example.com']);
    expect((await trainer.agent.get('/api/attendance/stats')).status).toBe(403);
  });
});
