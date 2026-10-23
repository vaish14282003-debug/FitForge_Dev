const fs = require('fs/promises');
const path = require('path');
const sharp = require('sharp');
const request = require('supertest');
const env = require('../src/config/env');
const { app, startDb, clearDb, stopDb, PASSWORD, registerOwner, registerMember, createAndLogin } = require('./helpers');

beforeAll(startDb);
afterEach(clearDb);
afterAll(async () => {
  await stopDb();
  await fs.rm(env.storage.uploadDir, { recursive: true, force: true });
});

const png = (width = 900, height = 600) =>
  sharp({ create: { width, height, channels: 3, background: '#ff2d1f' } }).png().toBuffer();

let owner, member;
beforeEach(async () => {
  owner = await registerOwner();
  member = await registerMember(owner.gym.joinCode);
});

describe('profile photo', () => {
  it('stores a square WebP, serves it to the gym, and replaces the old file', async () => {
    const res = await member.agent.post('/api/users/me/avatar').attach('avatar', await png(), 'me.png');
    expect(res.status).toBe(200);
    const { avatarUrl } = res.body.user;
    expect(avatarUrl).toMatch(/^\/api\/files\/gyms\/[a-f0-9]{24}\/avatars\/[0-9a-f-]+\.webp$/);
    expect(res.body.user.avatarKey).toBeUndefined();

    const served = await member.agent.get(avatarUrl).buffer(true).parse((r, cb) => {
      const chunks = [];
      r.on('data', (c) => chunks.push(c));
      r.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    expect(served.status).toBe(200);
    const meta = await sharp(served.body).metadata();
    expect(meta).toMatchObject({ format: 'webp', width: 512, height: 512 });

    // Someone else in the same gym can see it (it appears next to the member's name).
    expect((await owner.agent.get(avatarUrl)).status).toBe(200);

    const oldFile = path.join(env.storage.uploadDir, avatarUrl.replace('/api/files/', ''));
    const replaced = await member.agent.post('/api/users/me/avatar').attach('avatar', await png(300, 300), 'new.png');
    expect(replaced.body.user.avatarUrl).not.toBe(avatarUrl);
    await expect(fs.access(oldFile)).rejects.toThrow();

    const removed = await member.agent.delete('/api/users/me/avatar');
    expect(removed.body.user.avatarUrl).toBeNull();
  });

  it('rejects non-images, disguised files, oversized files and missing files', async () => {
    const text = await member.agent.post('/api/users/me/avatar').attach('avatar', Buffer.from('hello'), { filename: 'a.txt', contentType: 'text/plain' });
    expect(text.status).toBe(400);

    // Claims to be a PNG but isn't one.
    const fake = await member.agent.post('/api/users/me/avatar').attach('avatar', Buffer.from('not really a png'), { filename: 'x.png', contentType: 'image/png' });
    expect(fake.status).toBe(400);
    expect(fake.body.message).toMatch(/not a readable image/);

    const big = await member.agent.post('/api/users/me/avatar').attach('avatar', Buffer.alloc(6 * 1024 * 1024, 1), { filename: 'big.png', contentType: 'image/png' });
    expect(big.status).toBe(400);
    expect(big.body.message).toMatch(/over 5 MB/);

    expect((await member.agent.post('/api/users/me/avatar')).status).toBe(400);
  });

  it('keeps files inside their gym and requires sign-in', async () => {
    const { avatarUrl } = (await member.agent.post('/api/users/me/avatar').attach('avatar', await png(), 'me.png')).body.user;
    const other = await registerOwner({ email: 'owner-b@example.com', gymName: 'Steel House' });
    expect((await other.agent.get(avatarUrl)).status).toBe(404);
    expect((await request(app).get(avatarUrl)).status).toBe(401);
    expect((await member.agent.get('/api/files/gyms/../../etc/passwd')).status).toBe(404);
  });
});

describe('profile details and password', () => {
  it('updates profile fields and validates them', async () => {
    const res = await member.agent
      .patch('/api/users/me')
      .send({ phone: '+91 98765 43210', heightCm: 168, dateOfBirth: '1999-04-12', fitnessGoal: 'BUILD_MUSCLE' });
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ phone: '+91 98765 43210', heightCm: 168, fitnessGoal: 'BUILD_MUSCLE' });
    expect((await member.agent.patch('/api/users/me').send({ phone: 'call me' })).status).toBe(400);
    expect((await member.agent.patch('/api/users/me').send({ fitnessGoal: 'FLY' })).status).toBe(400);
  });

  it('changes the password, keeps this session, and signs out other devices', async () => {
    const otherDevice = request.agent(app);
    await otherDevice.post('/api/auth/login').send({ email: 'member@example.com', password: PASSWORD });

    expect((await member.agent.post('/api/users/me/password').send({ currentPassword: 'wrong-one', newPassword: 'NewPassword456!' })).status).toBe(400);
    expect((await member.agent.post('/api/users/me/password').send({ currentPassword: PASSWORD, newPassword: PASSWORD })).status).toBe(400);
    expect((await member.agent.post('/api/users/me/password').send({ currentPassword: PASSWORD, newPassword: 'NewPassword456!' })).status).toBe(204);

    expect((await member.agent.get('/api/auth/me')).status).toBe(200);
    expect((await otherDevice.post('/api/auth/refresh')).status).toBe(401);
    expect((await request(app).post('/api/auth/login').send({ email: 'member@example.com', password: 'NewPassword456!' })).status).toBe(200);
  });
});

describe('exercise images', () => {
  it("only a gym's own exercises take photos", async () => {
    const trainer = await createAndLogin(owner.agent, 'TRAINER', 'trainer@example.com');
    const mine = (await trainer.agent.post('/api/exercises').send({ name: 'Landmine Press', muscleGroup: 'SHOULDERS', equipment: 'BARBELL' })).body.exercise;
    const res = await trainer.agent.post(`/api/exercises/${mine.id}/image`).attach('image', await png(1600, 1000), 'lm.png');
    expect(res.status).toBe(200);
    expect(res.body.exercise.imageUrl).toMatch(/\/exercises\/.+\.webp$/);
    expect((await member.agent.post(`/api/exercises/${mine.id}/image`).attach('image', await png(), 'x.png')).status).toBe(403);
  });
});
