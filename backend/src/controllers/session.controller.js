const mongoose = require('mongoose');
const WorkoutSession = require('../models/WorkoutSession');
const WorkoutPlan = require('../models/WorkoutPlan');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { ROLES, PERMISSIONS, can } = require('../config/roles');

const MAX_SESSION_SECONDS = 6 * 60 * 60;
const DAY_MS = 24 * 60 * 60 * 1000;

const isOwnerLevel = (user) => can(user.role, PERMISSIONS.GYM_SETTINGS);

// Members see their own sessions, trainers their clients', owners the whole gym's.
async function scopeFor(user) {
  if (isOwnerLevel(user)) return { gym: user.gym };
  if (user.role === ROLES.TRAINER) {
    const clients = await User.find({ gym: user.gym, trainer: user._id }).distinct('_id');
    return { gym: user.gym, member: { $in: clients } };
  }
  return { gym: user.gym, member: user._id };
}

async function createSession(req, res) {
  const { planId, dayIndex, startedAt, notes, entries } = req.valid.body;

  const plan = await WorkoutPlan.findOne({ _id: planId, gym: req.user.gym, assignedTo: req.user._id }).populate(
    'days.exercises.exercise',
    'name muscleGroup'
  );
  if (!plan) throw ApiError.notFound('Plan not found');
  const day = plan.days[dayIndex];
  if (!day) throw ApiError.badRequest('That day is not in the plan');

  const planned = new Map(day.exercises.map((e) => [e.exercise._id.toString(), e]));
  if (entries.some((entry) => !planned.has(entry.exercise))) {
    throw ApiError.badRequest('Every exercise must be part of this day');
  }

  const completedAt = new Date();
  const started = new Date(startedAt);
  if (started > completedAt) throw ApiError.badRequest('startedAt is in the future');
  const durationSeconds = Math.min(MAX_SESSION_SECONDS, Math.round((completedAt - started) / 1000));

  const doneSets = entries.flatMap((entry) => entry.sets.filter((set) => set.done));
  if (doneSets.length === 0) throw ApiError.badRequest('Log at least one set before finishing');
  const totalVolume = doneSets.reduce((sum, set) => sum + (set.weight ?? 0) * set.reps, 0);

  // A PR is a heavier completed set than anything this member logged before for that exercise.
  const exerciseIds = entries.map((entry) => entry.exercise);
  const previousBest = await WorkoutSession.aggregate([
    { $match: { member: req.user._id, 'entries.exercise': { $in: exerciseIds.map((id) => new mongoose.Types.ObjectId(id)) } } },
    { $unwind: '$entries' },
    { $unwind: '$entries.sets' },
    { $match: { 'entries.sets.done': true, 'entries.sets.weight': { $gt: 0 } } },
    { $group: { _id: '$entries.exercise', best: { $max: '$entries.sets.weight' } } },
  ]);
  const bestById = new Map(previousBest.map((row) => [row._id.toString(), row.best]));

  const prs = [];
  const sessionEntries = entries.map((entry) => {
    const plannedEntry = planned.get(entry.exercise);
    const top = entry.sets
      .filter((set) => set.done && set.weight > 0)
      .sort((a, b) => b.weight - a.weight || b.reps - a.reps)[0];
    if (top && top.weight > (bestById.get(entry.exercise) ?? 0)) {
      prs.push({ exercise: entry.exercise, exerciseName: plannedEntry.exercise.name, weight: top.weight, reps: top.reps });
    }
    return {
      exercise: entry.exercise,
      exerciseName: plannedEntry.exercise.name,
      muscleGroup: plannedEntry.exercise.muscleGroup,
      target: { sets: plannedEntry.sets, reps: plannedEntry.reps, weight: plannedEntry.weight },
      sets: entry.sets,
    };
  });

  const session = await WorkoutSession.create({
    gym: req.user.gym,
    member: req.user._id,
    plan: plan._id,
    planName: plan.name,
    dayIndex,
    dayName: day.name,
    startedAt: started,
    completedAt,
    durationSeconds,
    entries: sessionEntries,
    notes,
    totalVolume,
    completedSets: doneSets.length,
    prs,
  });
  res.status(201).json({ session });
}

async function listSessions(req, res) {
  const { member, pendingReview, limit } = req.valid.query;
  const filter = await scopeFor(req.user);
  // Narrow to one member, but never outside the caller's scope (a trainer's clients, or a member's own).
  if (member && req.user.role !== ROLES.MEMBER) {
    const inScope = !filter.member?.$in || filter.member.$in.some((id) => id.equals(member));
    if (!inScope) return res.json({ sessions: [] });
    filter.member = member;
  }
  if (pendingReview) filter['review.reviewedAt'] = null;

  const sessions = await WorkoutSession.find(filter)
    .populate('member', 'name email avatarKey')
    .populate('review.reviewedBy', 'name')
    .sort({ completedAt: -1 })
    .limit(limit);
  res.json({ sessions });
}

async function getSession(req, res) {
  const session = await WorkoutSession.findOne({ _id: req.valid.params.id, ...(await scopeFor(req.user)) })
    .populate('member', 'name email avatarKey')
    .populate('review.reviewedBy', 'name');
  if (!session) throw ApiError.notFound('Workout not found');
  res.json({ session });
}

// Calendar day of a timestamp in the member's timezone, as "YYYY-MM-DD".
const dayKey = (date, tz) => new Date(date.getTime() - tz * 60 * 1000).toISOString().slice(0, 10);

function streakFrom(dayKeys, todayKey) {
  const days = new Set(dayKeys);
  const cursor = new Date(`${todayKey}T00:00:00Z`);
  // Training today is optional: yesterday's workout keeps the streak alive until tonight.
  if (!days.has(todayKey)) cursor.setUTCDate(cursor.getUTCDate() - 1);
  let streak = 0;
  while (days.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

async function getSummary(req, res) {
  const { tz } = req.valid.query;
  const memberId = req.user._id;
  const now = new Date();
  const todayKey = dayKey(now, tz);

  const [totalWorkouts, recent, plans, prSessions] = await Promise.all([
    WorkoutSession.countDocuments({ member: memberId }),
    WorkoutSession.find({ member: memberId, completedAt: { $gte: new Date(now - 400 * DAY_MS) } })
      .select('completedAt plan dayIndex totalVolume')
      .sort({ completedAt: -1 })
      .lean(),
    WorkoutPlan.find({ gym: req.user.gym, assignedTo: memberId }).select('days.name').lean(),
    WorkoutSession.find({ member: memberId, 'prs.0': { $exists: true } })
      .select('prs completedAt')
      .sort({ completedAt: -1 })
      .limit(5)
      .lean(),
  ]);

  const keys = recent.map((s) => dayKey(s.completedAt, tz));
  const week = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(`${todayKey}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() - (6 - i));
    const key = date.toISOString().slice(0, 10);
    const daySessions = recent.filter((s, idx) => keys[idx] === key);
    return { date: key, count: daySessions.length, volume: daySessions.reduce((n, s) => n + s.totalVolume, 0) };
  });

  // The next day in each plan follows the last day completed in it, wrapping around.
  const nextUp = plans.map((plan) => {
    const last = recent.find((s) => s.plan?.equals(plan._id));
    const dayIndex = last ? (last.dayIndex + 1) % plan.days.length : 0;
    return { planId: plan._id.toString(), dayIndex };
  });

  res.json({
    summary: {
      totalWorkouts,
      streak: streakFrom(keys, todayKey),
      trainedToday: keys.includes(todayKey),
      week,
      nextUp,
      recentPrs: prSessions.flatMap((s) => s.prs.map((pr) => ({ ...pr, achievedAt: s.completedAt }))).slice(0, 5),
    },
  });
}

// Most recent logged sets per exercise, shown as "last time" while training.
async function getPrevious(req, res) {
  const ids = req.valid.query.exercises.split(',');
  const sessions = await WorkoutSession.find({ member: req.user._id, 'entries.exercise': { $in: ids } })
    .select('entries completedAt')
    .sort({ completedAt: -1 })
    .limit(30)
    .lean();

  const previous = {};
  for (const session of sessions) {
    for (const entry of session.entries) {
      const id = entry.exercise.toString();
      if (ids.includes(id) && !previous[id]) {
        previous[id] = { completedAt: session.completedAt, sets: entry.sets.filter((s) => s.done) };
      }
    }
  }
  res.json({ previous });
}

async function reviewSession(req, res) {
  const session = await WorkoutSession.findOne({ _id: req.valid.params.id, ...(await scopeFor(req.user)) });
  if (!session) throw ApiError.notFound('Workout not found');

  session.review = { reviewedBy: req.user._id, reviewedAt: new Date(), comment: req.valid.body.comment };
  await session.save();
  await session.populate([
    { path: 'member', select: 'name email' },
    { path: 'review.reviewedBy', select: 'name' },
  ]);
  res.json({ session });
}

module.exports = { createSession, listSessions, getSession, getSummary, getPrevious, reviewSession, streakFrom };
