const Availability = require('../models/Availability');
const Booking = require('../models/Booking');
const GymClass = require('../models/GymClass');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { ROLES, PERMISSIONS, can } = require('../config/roles');
const { dayKey, addDays } = require('../utils/dates');

const MINUTE = 60 * 1000;
const PERSON = 'name email avatarKey';
const toMinutes = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));
const isOwnerLevel = (user) => can(user.role, PERMISSIONS.GYM_SETTINGS);

/** Bookable slots on one local calendar day, as UTC instants, from a trainer's weekly hours. */
function slotsForDay(availability, day, tz) {
  const [y, m, d] = day.split('-').map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const midnight = Date.UTC(y, m - 1, d) + tz * MINUTE;
  const length = availability.sessionMinutes;
  const slots = [];
  for (const window of availability.weekly.filter((w) => w.day === weekday)) {
    for (let t = toMinutes(window.start); t + length <= toMinutes(window.end); t += length) {
      slots.push({ startsAt: new Date(midnight + t * MINUTE), endsAt: new Date(midnight + (t + length) * MINUTE) });
    }
  }
  return slots.sort((a, b) => a.startsAt - b.startsAt);
}

function assertValidWeek(weekly) {
  for (const day of [0, 1, 2, 3, 4, 5, 6]) {
    const windows = weekly
      .filter((w) => w.day === day)
      .map((w) => [toMinutes(w.start), toMinutes(w.end)])
      .sort((a, b) => a[0] - b[0]);
    windows.forEach(([start, end], i) => {
      if (end <= start) throw ApiError.badRequest('Each block of hours must end after it starts');
      if (i > 0 && start < windows[i - 1][1]) throw ApiError.badRequest('Blocks of hours on the same day overlap');
    });
  }
}

/** The trainer a request is about: a member's own trainer, the trainer themselves, or (owners) any. */
async function resolveTrainer(req) {
  if (req.user.role === ROLES.MEMBER) {
    if (!req.user.trainer) throw ApiError.badRequest("You don't have a trainer yet. Ask at the front desk to be assigned one.");
    return User.findById(req.user.trainer);
  }
  if (req.user.role === ROLES.TRAINER && !req.valid.query.trainer) return req.user;
  const id = req.valid.query.trainer;
  if (!id) throw ApiError.badRequest('Pick a trainer');
  if (req.user.role === ROLES.TRAINER && id !== req.user.id) throw ApiError.forbidden();
  const trainer = await User.findOne({ _id: id, gym: req.user.gym, role: ROLES.TRAINER });
  if (!trainer) throw ApiError.notFound('Trainer not found');
  return trainer;
}

const emptyAvailability = (trainer) => ({ trainer: trainer.id, weekly: [], sessionMinutes: 60 });

// ---- availability

async function getAvailability(req, res) {
  const trainer = await resolveTrainer(req);
  const availability = await Availability.findOne({ trainer: trainer._id });
  res.json({ availability: availability ?? emptyAvailability(trainer), trainer });
}

async function setAvailability(req, res) {
  if (req.user.role !== ROLES.TRAINER) throw ApiError.forbidden('Only trainers set their own hours');
  assertValidWeek(req.valid.body.weekly);
  const availability = await Availability.findOneAndUpdate(
    { trainer: req.user._id },
    { ...req.valid.body, gym: req.user.gym, trainer: req.user._id },
    { upsert: true, new: true, runValidators: true }
  );
  res.json({ availability });
}

// ---- slots and bookings

async function getSlots(req, res) {
  const trainer = await resolveTrainer(req);
  const { days, tz } = req.valid.query;
  const from = req.valid.query.from ?? dayKey(new Date(), tz);
  const availability = (await Availability.findOne({ trainer: trainer._id })) ?? emptyAvailability(trainer);
  const dayList = Array.from({ length: days }, (_, i) => addDays(from, i));
  const [y, m, d] = from.split('-').map(Number);
  const rangeStart = new Date(Date.UTC(y, m - 1, d) + tz * MINUTE);
  const rangeEnd = new Date(rangeStart.getTime() + days * 24 * 60 * MINUTE);

  const [booked, classes] = await Promise.all([
    Booking.find({ trainer: trainer._id, status: 'BOOKED', startsAt: { $lt: rangeEnd }, endsAt: { $gt: rangeStart } }).select('startsAt endsAt member').lean(),
    GymClass.find({ trainer: trainer._id, cancelledAt: null, startsAt: { $lt: rangeEnd }, endsAt: { $gt: rangeStart } }).select('startsAt endsAt').lean(),
  ]);
  const busy = [...booked, ...classes];
  const now = new Date();

  res.json({
    trainer,
    sessionMinutes: availability.sessionMinutes,
    days: dayList.map((date) => ({
      date,
      slots: slotsForDay(availability, date, tz)
        .filter((slot) => slot.startsAt > now)
        .map((slot) => {
          const clash = busy.find((b) => b.startsAt < slot.endsAt && b.endsAt > slot.startsAt);
          return { ...slot, available: !clash, yours: !!clash?.member && clash.member.equals(req.user._id) };
        }),
    })),
  });
}

async function createBooking(req, res) {
  const { startsAt, memberId, notes, tz } = req.valid.body;
  let member;
  let trainer;
  if (req.user.role === ROLES.MEMBER) {
    member = req.user;
    if (!member.trainer) throw ApiError.badRequest("You don't have a trainer yet. Ask at the front desk to be assigned one.");
    trainer = await User.findById(member.trainer);
  } else if (req.user.role === ROLES.TRAINER) {
    if (!memberId) throw ApiError.badRequest('Pick a client to book');
    trainer = req.user;
    member = await User.findOne({ _id: memberId, gym: req.user.gym, role: ROLES.MEMBER, trainer: req.user._id });
    if (!member) throw ApiError.notFound('That member is not one of your clients');
  } else {
    throw ApiError.forbidden();
  }

  const start = new Date(startsAt);
  if (start <= new Date()) throw ApiError.badRequest('That time has already passed');
  const availability = await Availability.findOne({ trainer: trainer._id });
  const slot = availability && slotsForDay(availability, dayKey(start, tz), tz).find((s) => s.startsAt.getTime() === start.getTime());
  if (!slot) throw ApiError.badRequest(`${trainer.name.split(' ')[0]} isn't available at that time`);

  const [memberBusy, classClash] = await Promise.all([
    Booking.exists({ member: member._id, status: 'BOOKED', startsAt: { $lt: slot.endsAt }, endsAt: { $gt: slot.startsAt } }),
    GymClass.exists({ trainer: trainer._id, cancelledAt: null, startsAt: { $lt: slot.endsAt }, endsAt: { $gt: slot.startsAt } }),
  ]);
  if (memberBusy) throw ApiError.conflict(`${member.id === req.user.id ? 'You already have' : `${member.name} already has`} a session at that time`);
  if (classClash) throw ApiError.conflict('The trainer is teaching a class then');

  try {
    const booking = await Booking.create({ gym: req.user.gym, trainer: trainer._id, member: member._id, ...slot, notes, bookedBy: req.user._id });
    await booking.populate([{ path: 'trainer', select: PERSON }, { path: 'member', select: PERSON }]);
    res.status(201).json({ booking });
  } catch (err) {
    if (err.code === 11000) throw ApiError.conflict('Someone just booked that slot. Pick another time.');
    throw err;
  }
}

// Members see their own sessions, trainers theirs, owners the whole gym.
function bookingScope(user) {
  if (isOwnerLevel(user)) return { gym: user.gym };
  if (user.role === ROLES.TRAINER) return { gym: user.gym, trainer: user._id };
  return { gym: user.gym, member: user._id };
}

async function listBookings(req, res) {
  const { from, to, member } = req.valid.query;
  const filter = bookingScope(req.user);
  if (member && req.user.role !== ROLES.MEMBER) filter.member = member;
  if (from || to) filter.startsAt = { ...(from && { $gte: new Date(from) }), ...(to && { $lt: new Date(to) }) };
  const bookings = await Booking.find(filter)
    .populate([{ path: 'trainer', select: PERSON }, { path: 'member', select: PERSON }])
    .sort({ startsAt: 1 })
    .limit(300);
  res.json({ bookings });
}

async function findScopedBooking(req) {
  const booking = await Booking.findOne({ _id: req.valid.params.id, ...bookingScope(req.user) });
  if (!booking) throw ApiError.notFound('Session not found');
  return booking;
}

async function cancelBooking(req, res) {
  const booking = await findScopedBooking(req);
  if (booking.status !== 'BOOKED') throw ApiError.conflict('Only booked sessions can be cancelled');
  if (booking.startsAt <= new Date()) throw ApiError.badRequest('This session has already started');
  booking.status = 'CANCELLED';
  booking.cancelledBy = req.user._id;
  await booking.save();
  await booking.populate([{ path: 'trainer', select: PERSON }, { path: 'member', select: PERSON }]);
  res.json({ booking });
}

async function setBookingStatus(req, res) {
  if (req.user.role === ROLES.MEMBER) throw ApiError.forbidden();
  const booking = await findScopedBooking(req);
  if (booking.status === 'CANCELLED') throw ApiError.conflict('This session was cancelled');
  if (booking.startsAt > new Date()) throw ApiError.badRequest("You can mark a session once it's started");
  booking.status = req.valid.body.status;
  await booking.save();
  await booking.populate([{ path: 'trainer', select: PERSON }, { path: 'member', select: PERSON }]);
  res.json({ booking });
}

// ---- classes

async function listClasses(req, res) {
  const { from, to } = req.valid.query;
  const filter = { gym: req.user.gym };
  filter.startsAt = { $gte: from ? new Date(from) : new Date(Date.now() - 24 * 60 * MINUTE), ...(to && { $lt: new Date(to) }) };
  const classes = await GymClass.find(filter).populate('trainer', PERSON).sort({ startsAt: 1 }).limit(200);
  res.json({ classes });
}

async function createClass(req, res) {
  const { title, description, location, trainerId, startsAt, durationMinutes, capacity, repeatWeeks } = req.valid.body;
  let trainer = null;
  const wanted = trainerId === undefined && req.user.role === ROLES.TRAINER ? req.user.id : trainerId;
  if (wanted) {
    trainer = await User.findOne({ _id: wanted, gym: req.user.gym, role: ROLES.TRAINER });
    if (!trainer) throw ApiError.badRequest('Trainer not found in this gym');
  }
  const first = new Date(startsAt);
  if (first <= new Date()) throw ApiError.badRequest('Pick a time in the future');

  // One class per week for `repeatWeeks` weeks, e.g. "every Tuesday 7 am for 4 weeks".
  const docs = Array.from({ length: repeatWeeks }, (_, week) => {
    const start = new Date(first.getTime() + week * 7 * 24 * 60 * MINUTE);
    return {
      gym: req.user.gym,
      title,
      description,
      location,
      trainer: trainer?._id ?? null,
      startsAt: start,
      endsAt: new Date(start.getTime() + durationMinutes * MINUTE),
      capacity,
      createdBy: req.user._id,
    };
  });
  const created = await GymClass.insertMany(docs);
  const classes = await GymClass.find({ _id: { $in: created.map((c) => c._id) } }).populate('trainer', PERSON).sort({ startsAt: 1 });
  res.status(201).json({ classes });
}

async function joinClass(req, res) {
  const now = new Date();
  // One atomic update: only succeeds while there's room, so the last spot can't be taken twice.
  const gymClass = await GymClass.findOneAndUpdate(
    {
      _id: req.valid.params.id,
      gym: req.user.gym,
      cancelledAt: null,
      startsAt: { $gt: now },
      attendees: { $ne: req.user._id },
      $expr: { $lt: [{ $size: '$attendees' }, '$capacity'] },
    },
    { $push: { attendees: req.user._id } },
    { new: true }
  ).populate('trainer', PERSON);

  if (!gymClass) {
    const existing = await GymClass.findOne({ _id: req.valid.params.id, gym: req.user.gym });
    if (!existing) throw ApiError.notFound('Class not found');
    if (existing.cancelledAt) throw ApiError.conflict('This class was cancelled');
    if (existing.startsAt <= now) throw ApiError.badRequest('This class has already started');
    if (existing.attendees.some((a) => a.equals(req.user._id))) throw ApiError.conflict("You're already in this class");
    throw ApiError.conflict('This class is full');
  }
  res.json({ class: gymClass });
}

async function leaveClass(req, res) {
  const gymClass = await GymClass.findOneAndUpdate(
    { _id: req.valid.params.id, gym: req.user.gym, startsAt: { $gt: new Date() } },
    { $pull: { attendees: req.user._id } },
    { new: true }
  ).populate('trainer', PERSON);
  if (!gymClass) throw ApiError.notFound('Class not found, or it has already started');
  res.json({ class: gymClass });
}

async function cancelClass(req, res) {
  const gymClass = await GymClass.findOne({ _id: req.valid.params.id, gym: req.user.gym, cancelledAt: null });
  if (!gymClass) throw ApiError.notFound('Class not found');
  const mayCancel = isOwnerLevel(req.user) || gymClass.createdBy.equals(req.user._id) || gymClass.trainer?.equals(req.user._id);
  if (!mayCancel) throw ApiError.forbidden('Only the class trainer, its creator or the owner can cancel it');
  gymClass.cancelledAt = new Date();
  await gymClass.save();
  await gymClass.populate('trainer', PERSON);
  res.json({ class: gymClass });
}

module.exports = {
  getAvailability,
  setAvailability,
  getSlots,
  createBooking,
  listBookings,
  cancelBooking,
  setBookingStatus,
  listClasses,
  createClass,
  joinClass,
  leaveClass,
  cancelClass,
  slotsForDay,
};
