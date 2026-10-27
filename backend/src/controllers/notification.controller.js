const Notification = require('../models/Notification');
const Announcement = require('../models/Announcement');
const Membership = require('../models/Membership');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { ROLES, PERMISSIONS, can } = require('../config/roles');
const { notify } = require('../services/notify');
const { dayKey, daysBetween } = require('../utils/dates');

const EXPIRY_WARNING_DAYS = 3;

/**
 * "Your membership ends in N days" has no event that triggers it, so it's created the first time
 * the member checks their alerts inside the warning window. The dedupe key keeps it to one per period.
 */
async function ensureExpiryAlert(user, tz) {
  if (user.role !== ROLES.MEMBER) return;
  const today = dayKey(new Date(), tz);
  const live = await Membership.find({ member: user._id, cancelledAt: null, endDate: { $gte: today } }).sort({ endDate: -1 }).lean();
  const latest = live[0];
  if (!latest || latest.startDate > today) return;
  const daysLeft = daysBetween(today, latest.endDate);
  if (daysLeft > EXPIRY_WARNING_DAYS) return;
  await notify([user._id], {
    gym: user.gym,
    type: 'MEMBERSHIP_EXPIRING',
    title: daysLeft === 0 ? 'Your membership ends today' : `Your membership ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`,
    body: `Your ${latest.planName} membership ends on ${latest.endDate}. Renew at the front desk to keep training without a break.`,
    link: '/member',
    dedupeKey: `expiring:${latest._id}`,
  });
}

async function listNotifications(req, res) {
  await ensureExpiryAlert(req.user, req.valid.query.tz);
  const [notifications, unread] = await Promise.all([
    Notification.find({ user: req.user._id }).populate('actor', 'name avatarKey').sort({ createdAt: -1 }).limit(req.valid.query.limit),
    Notification.countDocuments({ user: req.user._id, readAt: null }),
  ]);
  res.json({ notifications, unread });
}

async function unreadCount(req, res) {
  await ensureExpiryAlert(req.user, req.valid.query.tz);
  res.json({ unread: await Notification.countDocuments({ user: req.user._id, readAt: null }) });
}

async function markRead(req, res) {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.valid.params.id, user: req.user._id },
    { $set: { readAt: new Date() } },
    { new: true }
  );
  if (!notification) throw ApiError.notFound('Notification not found');
  res.json({ notification });
}

async function markAllRead(req, res) {
  const { modifiedCount } = await Notification.updateMany({ user: req.user._id, readAt: null }, { $set: { readAt: new Date() } });
  res.json({ updated: modifiedCount });
}

// ---- announcements

const AUDIENCE_ROLES = {
  EVERYONE: [ROLES.MEMBER, ROLES.TRAINER, ROLES.STAFF],
  MEMBERS: [ROLES.MEMBER],
  TRAINERS: [ROLES.TRAINER],
  STAFF: [ROLES.STAFF, ROLES.TRAINER],
};
// Which audiences a role can see. Owners see everything they posted.
const visibleAudiences = (role) => {
  if (role === ROLES.MEMBER) return ['EVERYONE', 'MEMBERS'];
  if (role === ROLES.TRAINER) return ['EVERYONE', 'TRAINERS', 'STAFF'];
  if (role === ROLES.STAFF) return ['EVERYONE', 'STAFF'];
  return Object.keys(AUDIENCE_ROLES);
};

async function listAnnouncements(req, res) {
  const announcements = await Announcement.find({ gym: req.user.gym, audience: { $in: visibleAudiences(req.user.role) } })
    .populate('author', 'name avatarKey')
    .sort({ pinned: -1, createdAt: -1 })
    .limit(50);
  res.json({ announcements });
}

async function createAnnouncement(req, res) {
  const announcement = await Announcement.create({ ...req.valid.body, gym: req.user.gym, author: req.user._id });
  const recipients = await User.find({ gym: req.user.gym, isActive: true, role: { $in: AUDIENCE_ROLES[announcement.audience] } }).distinct('_id');
  await notify(recipients, {
    gym: req.user.gym,
    type: 'ANNOUNCEMENT',
    title: announcement.title,
    body: announcement.body,
    actor: req.user._id,
    link: '/announcements',
  });
  await announcement.populate('author', 'name avatarKey');
  res.status(201).json({ announcement, notified: recipients.length });
}

async function deleteAnnouncement(req, res) {
  const { deletedCount } = await Announcement.deleteOne({ _id: req.valid.params.id, gym: req.user.gym });
  if (!deletedCount) throw ApiError.notFound('Announcement not found');
  res.status(204).end();
}

/** A trainer (or owner) sends a note to members: trainers only to their own clients. */
async function sendMessage(req, res) {
  const { memberIds, title, body } = req.valid.body;
  const filter = { _id: { $in: memberIds }, gym: req.user.gym, role: ROLES.MEMBER, isActive: true };
  if (!can(req.user.role, PERMISSIONS.GYM_SETTINGS)) filter.trainer = req.user._id;
  const members = await User.find(filter).distinct('_id');
  if (members.length !== memberIds.length) {
    throw ApiError.badRequest(can(req.user.role, PERMISSIONS.GYM_SETTINGS) ? 'Some members are not in this gym' : 'You can only message your own clients');
  }
  await notify(members, { gym: req.user.gym, type: 'MESSAGE', title, body, actor: req.user._id, link: null });
  res.status(201).json({ sent: members.length });
}

module.exports = { listNotifications, unreadCount, markRead, markAllRead, listAnnouncements, createAnnouncement, deleteAnnouncement, sendMessage };
