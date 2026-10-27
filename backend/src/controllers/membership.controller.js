const Membership = require('../models/Membership');
const MembershipPlan = require('../models/MembershipPlan');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { ROLES, PERMISSIONS, can } = require('../config/roles');
const { dayKey, addDays, periodEnd, daysBetween } = require('../utils/dates');
const { notify } = require('../services/notify');

// Shown as "expiring" on dashboards and the roster once this close to the end date.
const EXPIRING_DAYS = 7;
const REVENUE_MONTHS = 6;

function describe(membership, today) {
  const m = membership.toJSON ? membership.toJSON() : membership;
  let status;
  if (m.cancelledAt) status = 'CANCELLED';
  else if (m.startDate > today) status = 'UPCOMING';
  else if (m.endDate < today) status = 'EXPIRED';
  else status = 'ACTIVE';
  return { ...m, status, daysLeft: status === 'ACTIVE' ? daysBetween(today, m.endDate) : null };
}

/** Where a member stands: their current period, anything already booked after it, and a single label. */
function standing(memberships, today) {
  const live = memberships.filter((m) => !m.cancelledAt).map((m) => describe(m, today));
  const current = live.find((m) => m.status === 'ACTIVE') ?? null;
  const upcoming = live.filter((m) => m.status === 'UPCOMING').sort((a, b) => a.startDate.localeCompare(b.startDate))[0] ?? null;
  const latest = [...live].sort((a, b) => b.endDate.localeCompare(a.endDate))[0] ?? null;

  let status = 'NONE';
  if (current) status = current.daysLeft <= EXPIRING_DAYS && !upcoming ? 'EXPIRING' : 'ACTIVE';
  else if (upcoming) status = 'UPCOMING';
  else if (latest) status = 'EXPIRED';

  return {
    status,
    current,
    upcoming,
    latest,
    pendingPayments: live.filter((m) => m.payment.status === 'PENDING').length,
  };
}

const paymentFields = (payment) =>
  payment.status === 'PAID'
    ? { status: 'PAID', method: payment.method, reference: payment.reference, paidAt: new Date() }
    : { status: 'PENDING', method: null, reference: payment.reference, paidAt: null };

async function findMember(req, memberId) {
  const member = await User.findOne({ _id: memberId, gym: req.user.gym, role: ROLES.MEMBER });
  if (!member) throw ApiError.notFound('Member not found');
  return member;
}

async function findSellablePlan(req, planId) {
  const plan = await MembershipPlan.findOne({ _id: planId, gym: req.user.gym });
  if (!plan) throw ApiError.notFound('Plan not found');
  if (!plan.isActive) throw ApiError.badRequest('That plan is archived and can no longer be sold');
  return plan;
}

// Two live periods for the same member must never overlap.
async function assertNoOverlap(memberId, startDate, endDate) {
  const clash = await Membership.findOne({
    member: memberId,
    cancelledAt: null,
    startDate: { $lte: endDate },
    endDate: { $gte: startDate },
  });
  if (clash) {
    throw ApiError.conflict(`This overlaps the existing membership from ${clash.startDate} to ${clash.endDate}. Renew it instead.`);
  }
}

async function sell(req, { member, plan, startDate, payment, notes, renewalOf = null }) {
  const endDate = periodEnd(startDate, plan.durationMonths);
  await assertNoOverlap(member._id, startDate, endDate);
  const membership = await Membership.create({
    gym: req.user.gym,
    member: member._id,
    plan: plan._id,
    planName: plan.name,
    durationMonths: plan.durationMonths,
    price: plan.price,
    startDate,
    endDate,
    payment: paymentFields(payment),
    notes,
    renewalOf,
    createdBy: req.user._id,
  });
  await notify([member._id], {
    gym: req.user.gym,
    type: 'MEMBERSHIP_ADDED',
    title: renewalOf ? `Membership renewed: ${plan.name}` : `Welcome aboard: ${plan.name} membership`,
    body: `Valid from ${startDate} to ${endDate}.${payment.status === 'PENDING' ? ' Payment is still due at the front desk.' : ''}`,
    link: '/member',
    actor: req.user._id,
  });
  return membership;
}

// ---- plans

async function listPlans(req, res) {
  const filter = { gym: req.user.gym };
  // Members only see what's on sale; the people running the gym also see archived plans.
  if (!can(req.user.role, PERMISSIONS.MEMBERSHIPS_MANAGE)) filter.isActive = true;
  const plans = await MembershipPlan.find(filter).sort({ isActive: -1, durationMonths: 1, price: 1 });
  res.json({ plans });
}

async function createPlan(req, res) {
  const plan = await MembershipPlan.create({ ...req.valid.body, gym: req.user.gym });
  res.status(201).json({ plan });
}

async function updatePlan(req, res) {
  const plan = await MembershipPlan.findOneAndUpdate({ _id: req.valid.params.id, gym: req.user.gym }, req.valid.body, {
    new: true,
    runValidators: true,
  });
  if (!plan) throw ApiError.notFound('Plan not found');
  res.json({ plan });
}

// ---- memberships

async function createMembership(req, res) {
  const { memberId, planId, startDate, payment, notes, tz } = req.valid.body;
  const [member, plan] = await Promise.all([findMember(req, memberId), findSellablePlan(req, planId)]);
  const membership = await sell(req, { member, plan, startDate: startDate ?? dayKey(new Date(), tz), payment, notes });
  res.status(201).json({ membership: describe(membership, dayKey(new Date(), tz)) });
}

// Continues straight after the member's latest period, or from today if it has already lapsed.
async function renewMembership(req, res) {
  const { planId, payment, notes, tz } = req.valid.body;
  const today = dayKey(new Date(), tz);
  const base = await Membership.findOne({ _id: req.valid.params.id, gym: req.user.gym, cancelledAt: null });
  if (!base) throw ApiError.notFound('Membership not found');

  const [member, latest] = await Promise.all([
    findMember(req, base.member),
    Membership.findOne({ member: base.member, cancelledAt: null }).sort({ endDate: -1 }),
  ]);
  const plan = await findSellablePlan(req, planId ?? base.plan);
  const nextDay = addDays(latest.endDate, 1);
  const membership = await sell(req, {
    member,
    plan,
    startDate: nextDay > today ? nextDay : today,
    payment,
    notes,
    renewalOf: latest._id,
  });
  res.status(201).json({ membership: describe(membership, today) });
}

async function markPaid(req, res) {
  const membership = await Membership.findOne({ _id: req.valid.params.id, gym: req.user.gym, cancelledAt: null });
  if (!membership) throw ApiError.notFound('Membership not found');
  if (membership.payment.status === 'PAID') throw ApiError.conflict('This membership is already paid');
  membership.payment = { status: 'PAID', method: req.valid.body.method, reference: req.valid.body.reference, paidAt: new Date() };
  await membership.save();
  res.json({ membership: describe(membership, dayKey(new Date())) });
}

async function cancelMembership(req, res) {
  const membership = await Membership.findOne({ _id: req.valid.params.id, gym: req.user.gym, cancelledAt: null });
  if (!membership) throw ApiError.notFound('Membership not found');
  membership.cancelledAt = new Date();
  await membership.save();
  res.json({ membership: describe(membership, dayKey(new Date())) });
}

/** Every member in the gym with where they stand, for the memberships page. */
async function getRoster(req, res) {
  const today = dayKey(new Date(), req.valid.query.tz);
  const [members, memberships] = await Promise.all([
    User.find({ gym: req.user.gym, role: ROLES.MEMBER }).select('name email isActive createdAt avatarKey').sort({ name: 1 }),
    Membership.find({ gym: req.user.gym }).sort({ startDate: -1 }).lean(),
  ]);
  const byMember = new Map();
  for (const m of memberships) {
    const key = m.member.toString();
    if (!byMember.has(key)) byMember.set(key, []);
    byMember.get(key).push({ ...m, id: m._id.toString() });
  }
  res.json({
    roster: members.map((member) => ({ member, ...standing(byMember.get(member.id) ?? [], today) })),
    expiringDays: EXPIRING_DAYS,
  });
}

async function listMemberships(req, res) {
  const { member, tz } = req.valid.query;
  const today = dayKey(new Date(), tz);
  const filter = { gym: req.user.gym };
  if (member) filter.member = member;
  const memberships = await Membership.find(filter).populate('member', 'name email').sort({ startDate: -1 }).limit(200);
  res.json({ memberships: memberships.map((m) => describe(m, today)) });
}

async function getMine(req, res) {
  const today = dayKey(new Date(), req.valid.query.tz);
  const memberships = await Membership.find({ member: req.user._id }).sort({ startDate: -1 }).lean();
  const all = memberships.map((m) => ({ ...m, id: m._id.toString() }));
  res.json({ ...standing(all, today), history: all.map((m) => describe(m, today)) });
}

async function getOverview(req, res) {
  const { tz } = req.valid.query;
  const today = dayKey(new Date(), tz);
  const soon = addDays(today, EXPIRING_DAYS);
  const monthAgo = addDays(today, -30);

  const [live, pending] = await Promise.all([
    Membership.find({ gym: req.user.gym, cancelledAt: null, endDate: { $gte: monthAgo } }).populate('member', 'name email').lean(),
    Membership.find({ gym: req.user.gym, cancelledAt: null, 'payment.status': 'PENDING' }).select('price').lean(),
  ]);

  // A member renewed in advance isn't "expiring", so look past their current period.
  const latestEndByMember = new Map();
  for (const m of live) {
    const key = m.member._id.toString();
    if ((latestEndByMember.get(key) ?? '') < m.endDate) latestEndByMember.set(key, m.endDate);
  }
  const active = live.filter((m) => m.startDate <= today && m.endDate >= today);
  const expiringSoon = active
    .filter((m) => m.endDate <= soon && latestEndByMember.get(m.member._id.toString()) === m.endDate)
    .map((m) => ({ ...describe({ ...m, id: m._id.toString() }, today) }))
    .sort((a, b) => a.endDate.localeCompare(b.endDate));
  const recentlyExpired = [...latestEndByMember.values()].filter((end) => end < today).length;

  const overview = {
    activeMembers: new Set(active.map((m) => m.member._id.toString())).size,
    expiringSoon,
    expiringDays: EXPIRING_DAYS,
    recentlyExpired,
    pendingPayments: { count: pending.length, amount: pending.reduce((n, m) => n + m.price, 0) },
  };

  if (can(req.user.role, PERMISSIONS.REVENUE_READ)) {
    const thisMonth = today.slice(0, 7);
    const months = Array.from({ length: REVENUE_MONTHS }, (_, i) => {
      const d = new Date(`${thisMonth}-01T00:00:00Z`);
      d.setUTCMonth(d.getUTCMonth() - (REVENUE_MONTHS - 1 - i));
      return d.toISOString().slice(0, 7);
    });
    const firstDay = new Date(`${months[0]}-01T00:00:00Z`);
    const paid = await Membership.find({
      gym: req.user.gym,
      cancelledAt: null,
      'payment.status': 'PAID',
      'payment.paidAt': { $gte: new Date(firstDay.getTime() + tz * 60 * 1000) },
    })
      .select('price payment.paidAt')
      .lean();
    const totals = new Map(months.map((m) => [m, { amount: 0, count: 0 }]));
    for (const m of paid) {
      const bucket = totals.get(dayKey(m.payment.paidAt, tz).slice(0, 7));
      if (bucket) {
        bucket.amount += m.price;
        bucket.count += 1;
      }
    }
    overview.revenue = {
      thisMonth: totals.get(thisMonth).amount,
      lastMonth: totals.get(months[months.length - 2]).amount,
      months: months.map((month) => ({ month, ...totals.get(month) })),
    };
  }

  res.json({ overview });
}

module.exports = {
  listPlans,
  createPlan,
  updatePlan,
  createMembership,
  renewMembership,
  markPaid,
  cancelMembership,
  getRoster,
  listMemberships,
  getMine,
  getOverview,
};
