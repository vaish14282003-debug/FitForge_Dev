const request = require('supertest');
const User = require('../src/models/User');
const { ROLES, PERMISSIONS: P, can } = require('../src/config/roles');
const { app, startDb, clearDb, stopDb, registerOwner, registerMember, createAndLogin } = require('./helpers');

beforeAll(startDb);
afterEach(clearDb);
afterAll(stopDb);

describe('permission matrix', () => {
  // Mirrors the table in the product spec.
  const matrix = [
    [P.PROFILE_READ_OWN, true, true, true],
    [P.PROFILE_UPDATE_OWN, true, true, true],
    [P.WORKOUT_CREATE, false, true, true],
    [P.WORKOUT_ASSIGN, false, true, true],
    [P.CLIENTS_READ_ASSIGNED, false, true, true],
    [P.MEMBERS_MANAGE, false, false, true],
    [P.TRAINERS_MANAGE, false, false, true],
    [P.REVENUE_READ, false, false, true],
    [P.GYM_SETTINGS, false, false, true],
  ];

  it.each(matrix)('%s', (permission, member, trainer, owner) => {
    expect(can(ROLES.MEMBER, permission)).toBe(member);
    expect(can(ROLES.TRAINER, permission)).toBe(trainer);
    expect(can(ROLES.GYM_OWNER, permission)).toBe(owner);
  });

  it('gives unknown roles nothing', () => {
    expect(can('HACKER', P.PROFILE_READ_OWN)).toBe(false);
  });
});

describe('route enforcement', () => {
  let owner, trainer, staff, member;

  beforeEach(async () => {
    owner = await registerOwner();
    trainer = await createAndLogin(owner.agent, 'TRAINER', 'trainer@example.com');
    staff = await createAndLogin(owner.agent, 'STAFF', 'staff@example.com');
    member = await registerMember(owner.gym.joinCode);
  });

  it('requires authentication', async () => {
    expect((await request(app).get('/api/users')).status).toBe(401);
    expect((await request(app).get('/api/gym')).status).toBe(401);
  });

  it('only owners see everyone; staff see members only; others are forbidden', async () => {
    const all = await owner.agent.get('/api/users');
    expect(all.body.users.map((u) => u.role).sort()).toEqual(['MEMBER', 'STAFF', 'TRAINER']);

    const staffView = await staff.agent.get('/api/users');
    expect(staffView.body.users.map((u) => u.role)).toEqual(['MEMBER']);
    expect((await staff.agent.get('/api/users?role=TRAINER')).status).toBe(403);

    expect((await trainer.agent.get('/api/users')).status).toBe(403);
    expect((await member.agent.get('/api/users')).status).toBe(403);
  });

  it('only owners can create trainers; staff can create members', async () => {
    const body = { name: 'New Person', password: 'Password123!' };
    const asStaffTrainer = await staff.agent.post('/api/users').send({ ...body, email: 'a@example.com', role: 'TRAINER' });
    const asStaffMember = await staff.agent.post('/api/users').send({ ...body, email: 'b@example.com', role: 'MEMBER' });
    const asMember = await member.agent.post('/api/users').send({ ...body, email: 'c@example.com', role: 'MEMBER' });
    const asTrainer = await trainer.agent.post('/api/users').send({ ...body, email: 'd@example.com', role: 'MEMBER' });
    const ownerEscalation = await owner.agent.post('/api/users').send({ ...body, email: 'e@example.com', role: 'GYM_OWNER' });

    expect(asStaffTrainer.status).toBe(403);
    expect(asStaffMember.status).toBe(201);
    expect(asMember.status).toBe(403);
    expect(asTrainer.status).toBe(403);
    expect(ownerEscalation.status).toBe(400);
  });

  it('hides the join code and overview from non-owners', async () => {
    expect((await owner.agent.get('/api/gym')).body.gym.joinCode).toBeDefined();
    for (const actor of [trainer, staff, member]) {
      const res = await actor.agent.get('/api/gym');
      expect(res.status).toBe(200);
      expect(res.body.gym.joinCode).toBeUndefined();
      expect((await actor.agent.get('/api/gym/overview')).status).toBe(403);
    }
    expect((await owner.agent.get('/api/gym/overview')).body.overview).toEqual({ members: 1, trainers: 1, staff: 1 });
  });

  it('trainers see only their assigned clients', async () => {
    expect((await member.agent.get('/api/users/clients')).status).toBe(403);
    expect((await trainer.agent.get('/api/users/clients')).body.clients).toEqual([]);

    const assign = await owner.agent.patch(`/api/users/${member.user.id}/trainer`).send({ trainerId: trainer.user.id });
    expect(assign.status).toBe(200);
    expect(assign.body.user.trainer.id ?? assign.body.user.trainer._id).toBeDefined();

    const clients = (await trainer.agent.get('/api/users/clients')).body.clients;
    expect(clients.map((c) => c.id)).toEqual([member.user.id]);

    const other = await createAndLogin(owner.agent, 'TRAINER', 'trainer2@example.com');
    expect((await other.agent.get('/api/users/clients')).body.clients).toEqual([]);
    expect((await trainer.agent.patch(`/api/users/${member.user.id}/trainer`).send({ trainerId: null })).status).toBe(403);
  });

  it('users can edit their own profile but not their role or gym', async () => {
    const res = await member.agent.patch('/api/users/me').send({ name: 'Renamed', role: 'GYM_OWNER' });
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ name: 'Renamed', role: 'MEMBER' });
  });

  it('a role change or deactivation takes effect on the very next request', async () => {
    await User.updateOne({ _id: staff.user.id }, { role: ROLES.MEMBER });
    expect((await staff.agent.get('/api/users')).status).toBe(403);

    await User.updateOne({ _id: trainer.user.id }, { isActive: false });
    expect((await trainer.agent.get('/api/auth/me')).status).toBe(401);
  });
});

describe('gym code lookup', () => {
  it('confirms a valid code with only the gym name, without signing in', async () => {
    const { gym } = await registerOwner();
    const res = await request(app).get(`/api/gym/lookup?code=${gym.joinCode.toLowerCase()}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ gym: { name: 'Iron Temple' } });
  });

  it('rejects unknown and malformed codes', async () => {
    expect((await request(app).get('/api/gym/lookup?code=ZZZZZZZZ')).status).toBe(404);
    expect((await request(app).get('/api/gym/lookup?code=abc')).status).toBe(400);
  });
});

describe('tenant isolation', () => {
  it('keeps gyms from seeing or touching each other', async () => {
    const a = await registerOwner();
    const b = await registerOwner({ email: 'owner-b@example.com', gymName: 'Steel House' });
    const memberA = await registerMember(a.gym.joinCode);
    const trainerB = await createAndLogin(b.agent, 'TRAINER', 'trainer-b@example.com');

    expect((await b.agent.get('/api/users?role=MEMBER')).body.users).toEqual([]);
    // Gym B cannot assign to gym A's member, and gym A cannot borrow gym B's trainer.
    expect((await b.agent.patch(`/api/users/${memberA.user.id}/trainer`).send({ trainerId: trainerB.user.id })).status).toBe(404);
    expect((await a.agent.patch(`/api/users/${memberA.user.id}/trainer`).send({ trainerId: trainerB.user.id })).status).toBe(400);
  });
});
