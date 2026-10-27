const fs = require('fs/promises');
const sharp = require('sharp');
const request = require('supertest');
const env = require('../src/config/env');
const { outbox } = require('../src/services/mailer');
const { cell } = require('../src/controllers/report.controller');
const { app, startDb, clearDb, stopDb, PASSWORD, registerOwner, registerMember, createAndLogin } = require('./helpers');

beforeAll(startDb);
afterEach(clearDb);
afterAll(async () => {
  await stopDb();
  await fs.rm(env.storage.uploadDir, { recursive: true, force: true });
});

let owner, staff, trainer, client, other;
beforeEach(async () => {
  outbox.length = 0;
  owner = await registerOwner();
  staff = await createAndLogin(owner.agent, 'STAFF', 'staff@example.com');
  trainer = await createAndLogin(owner.agent, 'TRAINER', 'trainer@example.com');
  client = await registerMember(owner.gym.joinCode, { email: 'client@example.com' });
  other = await registerMember(owner.gym.joinCode, { email: 'other@example.com', name: 'Omar Other' });
  await owner.agent.patch(`/api/users/${client.user.id}/trainer`).send({ trainerId: trainer.user.id });
});

describe('editing and deactivating people', () => {
  it('owners deactivate a trainer: login blocked, sessions ended, clients unassigned', async () => {
    const res = await owner.agent.patch(`/api/users/${trainer.user.id}`).send({ isActive: false, name: 'Tara Trainer' });
    expect(res.body.user).toMatchObject({ isActive: false, name: 'Tara Trainer' });
    expect((await trainer.agent.get('/api/auth/me')).status).toBe(401);
    expect((await trainer.agent.post('/api/auth/refresh')).status).toBe(401);
    expect((await request(app).post('/api/auth/login').send({ email: 'trainer@example.com', password: PASSWORD })).status).toBe(403);
    expect((await client.agent.get('/api/auth/me')).body.user.trainer).toBeNull();

    expect((await owner.agent.patch(`/api/users/${trainer.user.id}`).send({ isActive: true })).body.user.isActive).toBe(true);
  });

  it('staff edit members but not trainers; nobody edits themselves or other gyms here', async () => {
    expect((await staff.agent.patch(`/api/users/${client.user.id}`).send({ phone: '+91 90000 00000' })).status).toBe(200);
    expect((await staff.agent.patch(`/api/users/${trainer.user.id}`).send({ isActive: false })).status).toBe(404);
    expect((await trainer.agent.patch(`/api/users/${client.user.id}`).send({ name: 'X Y' })).status).toBe(403);
    const otherGym = await registerOwner({ email: 'owner-b@example.com', gymName: 'Steel House' });
    expect((await otherGym.agent.patch(`/api/users/${client.user.id}`).send({ isActive: false })).status).toBe(404);
  });
});

describe('forgot and reset password', () => {
  const linkToken = () => outbox.at(-1).text.match(/token=([\w-]+)/)[1];

  it('emails a single-use link that resets the password and ends old sessions', async () => {
    const res = await request(app).post('/api/auth/forgot-password').send({ email: 'CLIENT@example.com' });
    expect(res.status).toBe(200);
    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toMatchObject({ to: 'client@example.com', subject: 'Reset your FitForge password' });
    const token = linkToken();

    expect((await request(app).post('/api/auth/reset-password').send({ token, password: 'short' })).status).toBe(400);
    expect((await request(app).post('/api/auth/reset-password').send({ token, password: 'BrandNew123!' })).status).toBe(200);
    expect((await request(app).post('/api/auth/reset-password').send({ token, password: 'Again12345!' })).status).toBe(400);
    expect((await client.agent.post('/api/auth/refresh')).status).toBe(401);
    expect((await request(app).post('/api/auth/login').send({ email: 'client@example.com', password: 'BrandNew123!' })).status).toBe(200);
  });

  it('answers the same for unknown emails and sends nothing', async () => {
    const known = await request(app).post('/api/auth/forgot-password').send({ email: 'client@example.com' });
    const unknown = await request(app).post('/api/auth/forgot-password').send({ email: 'nobody@example.com' });
    expect(unknown.status).toBe(200);
    expect(unknown.body).toEqual(known.body);
    expect(outbox).toHaveLength(1);
    expect((await request(app).post('/api/auth/reset-password').send({ token: 'made-up', password: 'BrandNew123!' })).status).toBe(400);
  });
});

describe('client notes', () => {
  it("trainers keep private notes on their own clients; members can't see them", async () => {
    const res = await trainer.agent.post(`/api/clients/${client.user.id}/notes`).send({ body: 'Sore left knee' });
    expect(res.status).toBe(201);
    expect((await trainer.agent.get(`/api/clients/${client.user.id}/notes`)).body.notes.map((n) => n.body)).toEqual(['Sore left knee']);
    expect((await owner.agent.get(`/api/clients/${client.user.id}/notes`)).body.notes).toHaveLength(1);
    expect((await trainer.agent.post(`/api/clients/${other.user.id}/notes`).send({ body: 'x' })).status).toBe(404);
    expect((await client.agent.get(`/api/clients/${client.user.id}/notes`)).status).toBe(403);
    expect((await trainer.agent.delete(`/api/clients/${client.user.id}/notes/${res.body.note.id}`)).status).toBe(204);
  });
});

describe('shared resources', () => {
  const pdf = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');
  const upload = (agent, fields = {}, file = pdf, name = 'diet.pdf', type = 'application/pdf') => {
    let r = agent.post('/api/resources').field('title', fields.title ?? 'Diet plan');
    if (fields.memberIds) r = r.field('memberIds', fields.memberIds);
    return r.attach('file', file, { filename: name, contentType: type });
  };

  it('shares with all clients by default, notifies them, and serves only to them', async () => {
    const res = await upload(trainer.agent);
    expect(res.status).toBe(201);
    const { resource } = res.body;
    expect(resource).toMatchObject({ title: 'Diet plan', fileName: 'diet.pdf', shareWithAllClients: true });
    expect(resource.fileKey).toBeUndefined();

    expect((await client.agent.get('/api/resources')).body.resources).toHaveLength(1);
    expect((await other.agent.get('/api/resources')).body.resources).toHaveLength(0);
    const file = await client.agent.get(resource.downloadUrl);
    expect(file.status).toBe(200);
    expect(file.headers['content-type']).toMatch(/pdf/);
    expect((await other.agent.get(resource.downloadUrl)).status).toBe(404);
    expect((await client.agent.get('/api/notifications')).body.notifications[0].type).toBe('RESOURCE_SHARED');
  });

  it('rejects fake files, other trainers’ clients, and member uploads', async () => {
    expect((await upload(trainer.agent, {}, Buffer.from('not a pdf'))).status).toBe(400);
    const png = await sharp({ create: { width: 10, height: 10, channels: 3, background: '#000' } }).png().toBuffer();
    expect((await upload(trainer.agent, {}, png, 'chart.png', 'image/png')).status).toBe(201);
    expect((await upload(trainer.agent, {}, Buffer.from('x'), 'a.exe', 'application/octet-stream')).status).toBe(400);
    expect((await upload(trainer.agent, { memberIds: other.user.id })).status).toBe(400);
    expect((await upload(client.agent)).status).toBe(403);
  });

  it('only the uploader or owner deletes', async () => {
    const { resource } = (await upload(trainer.agent)).body;
    const t2 = await createAndLogin(owner.agent, 'TRAINER', 'trainer2@example.com');
    expect((await t2.agent.delete(`/api/resources/${resource.id}`)).status).toBe(404);
    expect((await owner.agent.delete(`/api/resources/${resource.id}`)).status).toBe(204);
    expect((await client.agent.get(resource.downloadUrl)).status).toBe(404);
  });
});

describe('nutrition', () => {
  const day = '2026-10-27';
  it('members set goals, log food and water; totals add up; trainers can read', async () => {
    await client.agent.put('/api/nutrition/goals').send({ calories: 2000, protein: 110, waterMl: 3000 });
    const a = await client.agent.post('/api/nutrition/entries').send({ day, meal: 'BREAKFAST', name: 'Oats', calories: 350, protein: 12 });
    const b = await client.agent.post('/api/nutrition/entries').send({ day, meal: 'LUNCH', name: 'Dal rice', calories: 600, protein: 22 });
    await client.agent.put('/api/nutrition/water').send({ day, waterMl: 1500 });

    const res = (await client.agent.get(`/api/nutrition?day=${day}`)).body;
    expect(res.goals).toMatchObject({ calories: 2000, protein: 110, waterMl: 3000 });
    expect(res.totals).toMatchObject({ calories: 950, protein: 34 });
    expect(res.log.waterMl).toBe(1500);
    expect(res.week).toHaveLength(7);
    expect(res.week[6]).toMatchObject({ day, calories: 950, logged: true });

    await client.agent.delete(`/api/nutrition/entries/${a.body.log.entries[0].id}`);
    expect((await trainer.agent.get(`/api/nutrition?day=${day}&member=${client.user.id}`)).body.totals.calories).toBe(600);
    expect((await trainer.agent.get(`/api/nutrition?day=${day}&member=${other.user.id}`)).status).toBe(404);
    expect((await trainer.agent.post('/api/nutrition/entries').send({ day, meal: 'LUNCH', name: 'x', calories: 1 })).status).toBe(403);
    expect((await other.agent.delete(`/api/nutrition/entries/${b.body.log.entries[1].id}`)).status).toBe(404);
  });
});

describe('reports', () => {
  it('defuses spreadsheet formulas and quotes cells', () => {
    expect(cell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(cell('Asha, Rao')).toBe('"Asha, Rao"');
  });

  it('owners export CSVs and see trainer performance; others cannot', async () => {
    const members = await owner.agent.get('/api/reports/members.csv');
    expect(members.status).toBe(200);
    expect(members.headers['content-type']).toMatch(/text\/csv/);
    expect(members.text).toContain('"client@example.com"');
    expect((await owner.agent.get('/api/reports/payments.csv')).status).toBe(200);
    expect((await owner.agent.get('/api/reports/attendance.csv')).status).toBe(200);

    const perf = (await owner.agent.get('/api/reports/trainers')).body;
    expect(perf.trainers).toHaveLength(1);
    expect(perf.trainers[0]).toMatchObject({ clients: 1, sessions: { completed: 0 } });
    for (const who of [staff, trainer, client]) expect((await who.agent.get('/api/reports/members.csv')).status).toBe(403);
  });
});
