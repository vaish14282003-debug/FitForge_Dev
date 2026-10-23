const jwt = require('jsonwebtoken');
const Attendance = require('../models/Attendance');
const User = require('../models/User');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const { ROLES, PERMISSIONS, can } = require('../config/roles');

const DAY_MS = 24 * 60 * 60 * 1000;
// Long enough to scan comfortably, short enough that a photo of the screen goes stale quickly.
const QR_TTL_SECONDS = 120;
// A separate secret, so a check-in token can never be mistaken for a login token.
const QR_SECRET = `${env.jwtAccessSecret}:checkin`;

const dayKey = (date, tz) => new Date(date.getTime() - tz * 60 * 1000).toISOString().slice(0, 10);

// Records today's visit, or returns the existing one. Safe under double-taps thanks to the unique index.
async function recordVisit({ member, tz, method, recordedBy = null }) {
  const now = new Date();
  const day = dayKey(now, tz);
  const existing = await Attendance.findOne({ member: member._id, day });
  if (existing) return { attendance: existing, alreadyCheckedIn: true };
  try {
    const attendance = await Attendance.create({ gym: member.gym, member: member._id, day, checkedInAt: now, method, recordedBy });
    return { attendance, alreadyCheckedIn: false };
  } catch (err) {
    if (err.code !== 11000) throw err;
    return { attendance: await Attendance.findOne({ member: member._id, day }), alreadyCheckedIn: true };
  }
}

async function getQrToken(req, res) {
  const expiresAt = new Date(Date.now() + QR_TTL_SECONDS * 1000);
  const token = jwt.sign({ gym: req.user.gym.toString(), purpose: 'checkin' }, QR_SECRET, { expiresIn: QR_TTL_SECONDS });
  res.json({ token, expiresAt, ttlSeconds: QR_TTL_SECONDS });
}

async function qrCheckIn(req, res) {
  const { token, tz } = req.valid.body;
  let payload;
  try {
    payload = jwt.verify(token, QR_SECRET);
  } catch (err) {
    throw ApiError.badRequest(
      err.name === 'TokenExpiredError' ? 'This code has expired. Scan the screen at the front desk again.' : 'This check-in code is not valid.'
    );
  }
  if (payload.purpose !== 'checkin' || payload.gym !== req.user.gym.toString()) {
    throw ApiError.badRequest("This code belongs to a different gym.");
  }
  const result = await recordVisit({ member: req.user, tz, method: 'QR' });
  res.status(result.alreadyCheckedIn ? 200 : 201).json(result);
}

async function staffCheckIn(req, res) {
  const { memberId, tz } = req.valid.body;
  const member = await User.findOne({ _id: memberId, gym: req.user.gym, role: ROLES.MEMBER, isActive: true });
  if (!member) throw ApiError.notFound('Member not found');
  const result = await recordVisit({ member, tz, method: 'STAFF', recordedBy: req.user._id });
  res.status(result.alreadyCheckedIn ? 200 : 201).json({ ...result, member: { id: member.id, name: member.name } });
}

// Members: themselves. Trainers: their clients. Owners and front-desk staff: anyone in the gym.
async function resolveMember(req) {
  const requested = req.valid.query.member;
  if (req.user.role === ROLES.MEMBER) return req.user;
  if (!requested) throw ApiError.badRequest('Pick a member');
  const filter = { _id: requested, gym: req.user.gym, role: ROLES.MEMBER };
  const gymWide = can(req.user.role, PERMISSIONS.GYM_SETTINGS) || can(req.user.role, PERMISSIONS.MEMBERS_MANAGE);
  if (!gymWide) filter.trainer = req.user._id;
  const member = await User.findOne(filter);
  if (!member) throw ApiError.notFound('Member not found');
  return member;
}

async function getSummary(req, res) {
  const member = await resolveMember(req);
  const { tz } = req.valid.query;
  const today = dayKey(new Date(), tz);
  const since = dayKey(new Date(Date.now() - 12 * 7 * DAY_MS), tz);

  const [total, recent] = await Promise.all([
    Attendance.countDocuments({ member: member._id }),
    Attendance.find({ member: member._id, day: { $gte: since } }).select('day checkedInAt method').sort({ day: -1 }).lean(),
  ]);
  const monthPrefix = today.slice(0, 7);
  const thirtyDaysAgo = dayKey(new Date(Date.now() - 29 * DAY_MS), tz);

  res.json({
    summary: {
      checkedInToday: recent[0]?.day === today,
      todayAt: recent[0]?.day === today ? recent[0].checkedInAt : null,
      thisMonth: recent.filter((a) => a.day.startsWith(monthPrefix)).length,
      last30Days: recent.filter((a) => a.day >= thirtyDaysAgo).length,
      total,
      days: recent.map((a) => a.day),
    },
  });
}

async function getStats(req, res) {
  const { tz, days } = req.valid.query;
  const today = dayKey(new Date(), tz);
  const from = dayKey(new Date(Date.now() - (days - 1) * DAY_MS), tz);

  const [daily, todays] = await Promise.all([
    Attendance.aggregate([
      { $match: { gym: req.user.gym, day: { $gte: from } } },
      { $group: { _id: '$day', count: { $sum: 1 } } },
    ]),
    Attendance.find({ gym: req.user.gym, day: today }).populate('member', 'name email').sort({ checkedInAt: -1 }).limit(200),
  ]);

  const counts = new Map(daily.map((d) => [d._id, d.count]));
  const series = Array.from({ length: days }, (_, i) => {
    const day = dayKey(new Date(Date.now() - (days - 1 - i) * DAY_MS), tz);
    return { day, count: counts.get(day) ?? 0 };
  });

  res.json({ stats: { today: todays.length, daily: series, checkIns: todays } });
}

module.exports = { getQrToken, qrCheckIn, staffCheckIn, getSummary, getStats, QR_SECRET };
