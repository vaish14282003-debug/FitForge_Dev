const Attendance = require('../models/Attendance');
const Booking = require('../models/Booking');
const GymClass = require('../models/GymClass');
const Membership = require('../models/Membership');
const User = require('../models/User');
const WorkoutSession = require('../models/WorkoutSession');
const WorkoutPlan = require('../models/WorkoutPlan');
const { ROLES } = require('../config/roles');
const { dayKey, addDays } = require('../utils/dates');

/**
 * One CSV cell. Quotes everything, doubles quotes, and defuses values a spreadsheet would run as a
 * formula (=, +, -, @), since names and notes are typed by users.
 */
function cell(value) {
  let text = value == null ? '' : value instanceof Date ? value.toISOString() : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function sendCsv(res, name, header, rows) {
  const body = [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n');
  res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${name}"` });
  // The BOM makes Excel read ₹ and other non-ASCII characters correctly.
  res.send(`﻿${body}\r\n`);
}

const range = (q) => {
  const to = q.to ?? dayKey(new Date(), q.tz);
  return { from: q.from ?? addDays(to, -29), to };
};

async function membersCsv(req, res) {
  const today = dayKey(new Date(), req.valid.query.tz);
  const [members, memberships] = await Promise.all([
    User.find({ gym: req.user.gym, role: ROLES.MEMBER }).populate('trainer', 'name').sort({ name: 1 }).lean(),
    Membership.find({ gym: req.user.gym, cancelledAt: null }).sort({ endDate: -1 }).lean(),
  ]);
  const latest = new Map();
  for (const m of memberships) if (!latest.has(m.member.toString())) latest.set(m.member.toString(), m);
  sendCsv(
    res,
    `members-${today}.csv`,
    ['Name', 'Email', 'Phone', 'Active account', 'Trainer', 'Membership', 'Membership ends', 'Membership status', 'Joined'],
    members.map((u) => {
      const m = latest.get(u._id.toString());
      const status = !m ? 'None' : m.startDate > today ? 'Upcoming' : m.endDate < today ? 'Expired' : 'Active';
      return [u.name, u.email, u.phone ?? '', u.isActive ? 'Yes' : 'No', u.trainer?.name ?? '', m?.planName ?? '', m?.endDate ?? '', status, dayKey(u.createdAt)];
    })
  );
}

async function paymentsCsv(req, res) {
  const { from, to } = range(req.valid.query);
  const tz = req.valid.query.tz;
  const memberships = await Membership.find({ gym: req.user.gym, cancelledAt: null, startDate: { $lte: to }, endDate: { $gte: from } })
    .populate('member', 'name email')
    .sort({ startDate: 1 })
    .lean();
  sendCsv(
    res,
    `payments-${from}-to-${to}.csv`,
    ['Member', 'Email', 'Plan', 'Price (INR)', 'Starts', 'Ends', 'Payment status', 'Method', 'Reference', 'Paid on'],
    memberships.map((m) => [
      m.member?.name ?? '',
      m.member?.email ?? '',
      m.planName,
      m.price,
      m.startDate,
      m.endDate,
      m.payment.status,
      m.payment.method ?? '',
      m.payment.reference ?? '',
      m.payment.paidAt ? dayKey(m.payment.paidAt, tz) : '',
    ])
  );
}

async function attendanceCsv(req, res) {
  const { from, to } = range(req.valid.query);
  const visits = await Attendance.find({ gym: req.user.gym, day: { $gte: from, $lte: to } }).populate('member', 'name email').sort({ day: 1, checkedInAt: 1 }).lean();
  sendCsv(
    res,
    `attendance-${from}-to-${to}.csv`,
    ['Date', 'Checked in at', 'Member', 'Email', 'Method'],
    visits.map((v) => [v.day, v.checkedInAt, v.member?.name ?? '', v.member?.email ?? '', v.method === 'QR' ? 'QR scan' : 'Front desk'])
  );
}

/** How each trainer is doing over the period: clients, sessions, classes, reviews and client attendance. */
async function trainerPerformance(req, res) {
  const { from, to } = range(req.valid.query);
  const tz = req.valid.query.tz;
  const start = new Date(`${from}T00:00:00Z`).getTime() + tz * 60 * 1000;
  const end = new Date(`${addDays(to, 1)}T00:00:00Z`).getTime() + tz * 60 * 1000;
  const window = { $gte: new Date(start), $lt: new Date(end) };
  const days = Math.round((end - start) / 86400000);

  const trainers = await User.find({ gym: req.user.gym, role: ROLES.TRAINER }).select('name email avatarKey isActive').sort({ name: 1 });
  const rows = await Promise.all(
    trainers.map(async (trainer) => {
      const clients = await User.find({ gym: req.user.gym, role: ROLES.MEMBER, trainer: trainer._id, isActive: true }).distinct('_id');
      const [bookings, classes, reviews, logged, visits, activePlans] = await Promise.all([
        Booking.find({ trainer: trainer._id, startsAt: window }).select('status').lean(),
        GymClass.find({ trainer: trainer._id, cancelledAt: null, startsAt: window }).select('attendees capacity').lean(),
        WorkoutSession.countDocuments({ 'review.reviewedBy': trainer._id, 'review.reviewedAt': window }),
        WorkoutSession.countDocuments({ member: { $in: clients }, completedAt: window }),
        Attendance.countDocuments({ member: { $in: clients }, day: { $gte: from, $lte: to } }),
        WorkoutPlan.countDocuments({ createdBy: trainer._id, 'assignedTo.0': { $exists: true } }),
      ]);
      const count = (s) => bookings.filter((b) => b.status === s).length;
      const seats = classes.reduce((n, c) => n + c.capacity, 0);
      return {
        trainer,
        clients: clients.length,
        activePlans,
        sessions: { completed: count('COMPLETED'), noShow: count('NO_SHOW'), cancelled: count('CANCELLED'), upcoming: count('BOOKED') },
        classes: { taught: classes.length, fillRate: seats ? Math.round((classes.reduce((n, c) => n + c.attendees.length, 0) / seats) * 100) : null },
        reviewsGiven: reviews,
        clientWorkouts: logged,
        // Average gym visits per client per week over the period.
        clientVisitsPerWeek: clients.length ? Math.round((visits / clients.length / (days / 7)) * 10) / 10 : null,
      };
    })
  );
  res.json({ from, to, trainers: rows });
}

module.exports = { membersCsv, paymentsCsv, attendanceCsv, trainerPerformance, cell };
