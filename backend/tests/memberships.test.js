const { addDays, addMonths, periodEnd, dayKey } = require('../src/utils/dates');
const { startDb, clearDb, stopDb, registerOwner, registerMember, createAndLogin } = require('./helpers');

beforeAll(startDb);
afterEach(clearDb);
afterAll(stopDb);

const today = dayKey(new Date());
// Start date of a membership of `months` that ends exactly `daysLeft` days from today, whatever the month lengths.
// A start date whose period ends about `daysLeft` days from now. Month-end clamping means some end
// dates are impossible (no 1-month plan ends on 30 Oct), so this tries the nearest days too and
// reports which one it hit.
function startEndingIn(daysLeft, months = 1) {
  for (const left of [daysLeft, daysLeft - 1, daysLeft + 1]) {
    const target = addDays(today, left);
    for (let offset = -4; offset <= 4; offset += 1) {
      const start = addDays(addMonths(target, -months), offset);
      if (periodEnd(start, months) === target) return { start, left };
    }
  }
  throw new Error(`No ${months}-month period ends near ${daysLeft} days from now`);
}
let owner, staff, trainer, member, monthly, quarterly;

beforeEach(async () => {
  owner = await registerOwner();
  staff = await createAndLogin(owner.agent, 'STAFF', 'staff@example.com');
  trainer = await createAndLogin(owner.agent, 'TRAINER', 'trainer@example.com');
  member = await registerMember(owner.gym.joinCode, { email: 'member@example.com' });
  monthly = (await owner.agent.post('/api/membership-plans').send({ name: 'Monthly', durationMonths: 1, price: 1500 })).body.plan;
  quarterly = (await owner.agent.post('/api/membership-plans').send({ name: 'Quarterly', durationMonths: 3, price: 4000 })).body.plan;
});

const sell = (agent, body) => agent.post('/api/memberships').send({ memberId: member.user.id, planId: monthly.id, payment: { status: 'PAID', method: 'UPI' }, ...body });

describe('date helpers', () => {
  it('clamps month ends and computes the last day of a period', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
    expect(periodEnd('2026-10-01', 3)).toBe('2026-12-31');
    expect(periodEnd('2026-01-15', 1)).toBe('2026-02-14');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
});

describe('plans', () => {
  it('owners manage plans; staff and members cannot; members only see active ones', async () => {
    expect((await staff.agent.post('/api/membership-plans').send({ name: 'X', durationMonths: 1, price: 10 })).status).toBe(403);
    expect((await member.agent.post('/api/membership-plans').send({ name: 'X', durationMonths: 1, price: 10 })).status).toBe(403);

    await owner.agent.patch(`/api/membership-plans/${monthly.id}`).send({ isActive: false });
    expect((await member.agent.get('/api/membership-plans')).body.plans.map((p) => p.name)).toEqual(['Quarterly']);
    expect((await staff.agent.get('/api/membership-plans')).body.plans).toHaveLength(2);
  });
});

describe('selling and renewing', () => {
  it('staff sell a membership starting today, with the plan snapshotted', async () => {
    const res = await sell(staff.agent);
    expect(res.status).toBe(201);
    expect(res.body.membership).toMatchObject({
      planName: 'Monthly',
      price: 1500,
      startDate: today,
      endDate: periodEnd(today, 1),
      status: 'ACTIVE',
      payment: { status: 'PAID', method: 'UPI' },
    });
    // Repricing the plan later doesn't change what was sold.
    await owner.agent.patch(`/api/membership-plans/${monthly.id}`).send({ price: 2000 });
    const { memberships } = (await owner.agent.get(`/api/memberships?member=${member.user.id}`)).body;
    expect(memberships[0].price).toBe(1500);
  });

  it('requires a payment method when paid, refuses overlaps and archived plans', async () => {
    expect((await sell(staff.agent, { payment: { status: 'PAID' } })).status).toBe(400);
    await sell(staff.agent);
    const overlap = await sell(staff.agent, { planId: quarterly.id });
    expect(overlap.status).toBe(409);
    expect(overlap.body.message).toMatch(/Renew it instead/);

    await owner.agent.patch(`/api/membership-plans/${quarterly.id}`).send({ isActive: false });
    expect((await sell(staff.agent, { planId: quarterly.id, startDate: addDays(today, 60) })).status).toBe(400);
  });

  it('renewal starts the day after the current period, on a new plan if chosen', async () => {
    const first = (await sell(staff.agent)).body.membership;
    const res = await staff.agent
      .post(`/api/memberships/${first.id}/renew`)
      .send({ planId: quarterly.id, payment: { status: 'PENDING' } });
    expect(res.status).toBe(201);
    expect(res.body.membership).toMatchObject({
      planName: 'Quarterly',
      startDate: addDays(first.endDate, 1),
      status: 'UPCOMING',
      renewalOf: first.id,
      payment: { status: 'PENDING', paidAt: null },
    });
  });

  it('renewing a lapsed membership starts today', async () => {
    const old = (await sell(staff.agent, { startDate: addDays(today, -90) })).body.membership;
    expect(old.status).toBe('EXPIRED');
    const renewed = (await staff.agent.post(`/api/memberships/${old.id}/renew`).send({ payment: { status: 'PAID', method: 'CASH' } })).body.membership;
    expect(renewed.startDate).toBe(today);
  });

  it('marks a pending payment paid once, and cancels', async () => {
    const m = (await sell(staff.agent, { payment: { status: 'PENDING' } })).body.membership;
    const paid = await staff.agent.patch(`/api/memberships/${m.id}/payment`).send({ method: 'CARD' });
    expect(paid.body.membership.payment).toMatchObject({ status: 'PAID', method: 'CARD' });
    expect((await staff.agent.patch(`/api/memberships/${m.id}/payment`).send({ method: 'CARD' })).status).toBe(409);
    expect((await staff.agent.post(`/api/memberships/${m.id}/cancel`)).body.membership.status).toBe('CANCELLED');
  });

  it('trainers and members cannot sell, and gyms stay separate', async () => {
    expect((await sell(trainer.agent)).status).toBe(403);
    expect((await sell(member.agent)).status).toBe(403);
    const other = await registerOwner({ email: 'owner-b@example.com', gymName: 'Steel House' });
    expect((await sell(other.agent)).status).toBe(404);
  });
});

describe('roster, overview and member view', () => {
  it('labels members ACTIVE, EXPIRING, EXPIRED or NONE', async () => {
    await registerMember(owner.gym.joinCode, { email: 'other@example.com', name: 'Omar Other' });
    const ending = startEndingIn(3);
    await sell(staff.agent, { startDate: ending.start });
    let roster = (await staff.agent.get('/api/memberships/roster')).body.roster;
    const byEmail = Object.fromEntries(roster.map((r) => [r.member.email, r]));
    expect(byEmail['member@example.com']).toMatchObject({ status: 'EXPIRING', current: { daysLeft: ending.left } });
    expect(byEmail['other@example.com'].status).toBe('NONE');

    // Renewing in advance takes them off "expiring".
    await staff.agent.post(`/api/memberships/${byEmail['member@example.com'].current.id}/renew`).send({ payment: { status: 'PAID', method: 'UPI' } });
    roster = (await staff.agent.get('/api/memberships/roster')).body.roster;
    expect(roster.find((r) => r.member.email === 'member@example.com').status).toBe('ACTIVE');
  });

  it('overview counts expiring and pending; revenue only for owners', async () => {
    await sell(staff.agent, { startDate: startEndingIn(2).start, payment: { status: 'PENDING' } });
    const forStaff = (await staff.agent.get('/api/memberships/overview')).body.overview;
    expect(forStaff).toMatchObject({ activeMembers: 1, pendingPayments: { count: 1, amount: 1500 } });
    expect(forStaff.expiringSoon).toHaveLength(1);
    expect(forStaff.revenue).toBeUndefined();

    await staff.agent.patch(`/api/memberships/${forStaff.expiringSoon[0].id}/payment`).send({ method: 'CASH' });
    const forOwner = (await owner.agent.get('/api/memberships/overview')).body.overview;
    expect(forOwner.revenue.thisMonth).toBe(1500);
    expect(forOwner.revenue.months).toHaveLength(6);
    expect((await trainer.agent.get('/api/memberships/overview')).status).toBe(403);
  });

  it("members see their own membership", async () => {
    await sell(staff.agent);
    const mine = (await member.agent.get('/api/memberships/me')).body;
    expect(mine).toMatchObject({ status: 'ACTIVE', current: { planName: 'Monthly' } });
    expect(mine.history).toHaveLength(1);
    expect((await member.agent.get('/api/memberships/roster')).status).toBe(403);
  });
});
