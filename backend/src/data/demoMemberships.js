const bcrypt = require('bcrypt');
const Membership = require('../models/Membership');
const MembershipPlan = require('../models/MembershipPlan');
const User = require('../models/User');
const { ROLES } = require('../config/roles');
const { dayKey, addDays, addMonths, periodEnd } = require('../utils/dates');

const PLANS = [
  { name: 'Monthly', durationMonths: 1, price: 1500, description: 'Full gym access, billed every month.' },
  { name: 'Quarterly', durationMonths: 3, price: 4000, description: 'Three months. Save ₹500 over monthly.' },
  { name: 'Half-yearly', durationMonths: 6, price: 7500, description: 'Six months. Save ₹1,500.' },
  { name: 'Yearly', durationMonths: 12, price: 13500, description: 'Best value: twelve months for the price of nine.' },
];

// [name, plan, start offset in days from today, payment status]
const DEMO_MEMBERS = [
  ['Aarav Shah', 'Monthly', -20, 'PAID'],
  ['Diya Patel', 'Quarterly', -85, 'PAID'],
  ['Kabir Mehra', 'Yearly', -150, 'PAID'],
  ['Ishita Rao', 'Monthly', -40, 'PAID'],
  ['Rohan Iyer', 'Half-yearly', -100, 'PAID'],
  ['Sneha Kulkarni', 'Monthly', -3, 'PENDING'],
  ['Arjun Nair', 'Quarterly', -170, 'PAID'],
  ['Meera Joshi', 'Monthly', -27, 'PAID'],
];

/**
 * Plans, a handful of demo members and six months of membership sales for one gym, so the
 * memberships page and revenue chart have something to show. Adds only what's missing.
 */
async function seedDemoMemberships(gym, seller) {
  const today = dayKey(new Date());
  let plans = await MembershipPlan.find({ gym: gym._id });
  if (plans.length === 0) plans = await MembershipPlan.insertMany(PLANS.map((p) => ({ ...p, gym: gym._id })));
  const planByName = Object.fromEntries(plans.map((p) => [p.name, p]));
  const passwordHash = await bcrypt.hash('Password123!', 10);
  let sold = 0;

  const sellFrom = async (member, plan, start, paymentStatus) => {
    const endDate = periodEnd(start, plan.durationMonths);
    const paidAt = paymentStatus === 'PAID' ? new Date(`${start}T10:30:00Z`) : null;
    await Membership.create({
      gym: gym._id,
      member: member._id,
      plan: plan._id,
      planName: plan.name,
      durationMonths: plan.durationMonths,
      price: plan.price,
      startDate: start,
      endDate,
      payment: { status: paymentStatus, method: paymentStatus === 'PAID' ? ['UPI', 'CASH', 'CARD'][sold % 3] : null, paidAt },
      createdBy: seller._id,
    });
    sold += 1;
    return endDate;
  };

  for (const [name, planName, offset, status] of DEMO_MEMBERS) {
    const email = `${name.split(' ')[0].toLowerCase()}@demo.fitforge.dev`;
    let member = await User.findOne({ email });
    if (!member) member = await User.create({ name, email, role: ROLES.MEMBER, gym: gym._id, passwordHash });
    if (await Membership.exists({ member: member._id })) continue;
    const plan = planByName[planName] ?? plans[0];
    // Monthly members renewed back-to-back for a few months, so revenue shows across the chart.
    let start = addDays(today, offset);
    if (plan.durationMonths === 1 && offset < -10) {
      let earlier = addMonths(start, -3);
      for (let i = 0; i < 3; i += 1) earlier = addDays(await sellFrom(member, plan, earlier, 'PAID'), 1);
      start = earlier;
    }
    await sellFrom(member, plan, start, status);
  }

  // The demo member's quarterly plan ends in five days, so "expiring" has a real example.
  const demo = await User.findOne({ gym: gym._id, email: 'member@fitforge.dev' });
  if (demo && !(await Membership.exists({ member: demo._id }))) {
    await sellFrom(demo, planByName.Quarterly ?? plans[0], addDays(addMonths(today, -3), 6), 'PAID');
  }
  return { plans: plans.length, memberships: sold };
}

module.exports = { seedDemoMemberships };
