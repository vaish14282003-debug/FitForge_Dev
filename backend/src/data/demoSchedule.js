const Availability = require('../models/Availability');
const Booking = require('../models/Booking');
const GymClass = require('../models/GymClass');
const User = require('../models/User');
const { ROLES } = require('../config/roles');
const { dayKey, addDays } = require('../utils/dates');

// Demo gym runs on Indian time.
const IST = -330;
const MINUTE = 60 * 1000;
function at(day, hhmm) {
  const [y, m, d] = day.split('-').map(Number);
  const [h, min] = hhmm.split(':').map(Number);
  return new Date(Date.UTC(y, m - 1, d, h, min) + IST * MINUTE);
}

const CLASSES = [
  { title: 'HIIT Blast', days: [2, 4], time: '07:00', minutes: 45, capacity: 12, location: 'Studio 1', description: 'Fast intervals, bodyweight and kettlebells.' },
  { title: 'Strength Club', days: [1, 3], time: '18:30', minutes: 60, capacity: 8, location: 'Main floor', description: 'Coached barbell lifts in small groups.' },
  { title: 'Yoga Flow', days: [6], time: '08:00', minutes: 60, capacity: 15, location: 'Studio 2', description: 'Mobility and breathing to recover.', noTrainer: true },
];

/** Trainer hours, a couple of sessions and three weeks of classes for one gym. Adds only what's missing. */
async function seedDemoSchedule(gym, owner) {
  const trainer = await User.findOne({ gym: gym._id, role: ROLES.TRAINER }).sort({ createdAt: 1 });
  if (!trainer) return { classes: 0, bookings: 0 };
  const today = dayKey(new Date(), IST);

  if (!(await Availability.exists({ trainer: trainer._id }))) {
    const weekly = [1, 2, 3, 4, 5, 6].flatMap((day) => [
      { day, start: '07:00', end: '11:00' },
      { day, start: '17:00', end: '21:00' },
    ]);
    await Availability.create({ gym: gym._id, trainer: trainer._id, weekly, sessionMinutes: 60 });
  }

  let bookings = 0;
  const client = await User.findOne({ gym: gym._id, role: ROLES.MEMBER, trainer: trainer._id }).sort({ createdAt: 1 });
  if (client && !(await Booking.exists({ member: client._id }))) {
    // Next weekday morning, plus a completed one last week.
    let next = addDays(today, 1);
    while (new Date(`${next}T00:00:00Z`).getUTCDay() === 0) next = addDays(next, 1);
    let past = addDays(today, -6);
    while (new Date(`${past}T00:00:00Z`).getUTCDay() === 0) past = addDays(past, 1);
    await Booking.insertMany([
      { gym: gym._id, trainer: trainer._id, member: client._id, startsAt: at(past, '08:00'), endsAt: at(past, '09:00'), status: 'COMPLETED', notes: 'Squat technique', bookedBy: client._id },
      { gym: gym._id, trainer: trainer._id, member: client._id, startsAt: at(next, '08:00'), endsAt: at(next, '09:00'), status: 'BOOKED', notes: 'Deadlift form check', bookedBy: client._id },
    ]);
    bookings = 2;
  }

  let classes = 0;
  if (!(await GymClass.exists({ gym: gym._id, startsAt: { $gte: new Date() } }))) {
    const members = await User.find({ gym: gym._id, role: ROLES.MEMBER }).select('_id').lean();
    const docs = [];
    for (let i = 0; i < 21; i += 1) {
      const day = addDays(today, i);
      const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
      for (const c of CLASSES.filter((k) => k.days.includes(weekday))) {
        const startsAt = at(day, c.time);
        if (startsAt <= new Date()) continue;
        // Earlier classes are fuller, as they would be in real life.
        const signedUp = Math.max(0, Math.min(c.capacity - (i < 4 ? 1 : 4), members.length - (i % 3)));
        docs.push({
          gym: gym._id,
          title: c.title,
          description: c.description,
          location: c.location,
          trainer: c.noTrainer ? null : trainer._id,
          startsAt,
          endsAt: new Date(startsAt.getTime() + c.minutes * MINUTE),
          capacity: c.capacity,
          attendees: members.slice(0, signedUp).map((m) => m._id),
          createdBy: owner._id,
        });
      }
    }
    await GymClass.insertMany(docs);
    classes = docs.length;
  }
  return { classes, bookings };
}

module.exports = { seedDemoSchedule };
