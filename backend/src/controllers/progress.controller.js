const mongoose = require('mongoose');
const BodyMetric = require('../models/BodyMetric');
const WorkoutSession = require('../models/WorkoutSession');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { ROLES, PERMISSIONS, can } = require('../config/roles');

const DAY_MS = 24 * 60 * 60 * 1000;

// Whose progress is being read: members always get their own; trainers may pick one of their
// clients; owners anyone in the gym. Out-of-scope ids look like they don't exist.
async function resolveMember(req) {
  const requested = req.valid.query.member;
  if (req.user.role === ROLES.MEMBER || !requested) {
    if (req.user.role !== ROLES.MEMBER) throw ApiError.badRequest('Pick a member');
    return req.user;
  }
  const filter = { _id: requested, gym: req.user.gym, role: ROLES.MEMBER };
  if (!can(req.user.role, PERMISSIONS.GYM_SETTINGS)) filter.trainer = req.user._id;
  const member = await User.findOne(filter);
  if (!member) throw ApiError.notFound('Member not found');
  return member;
}

// Epley estimate of a one-rep max; a single rep is its own max.
const estimateOneRepMax = (weight, reps) => (reps <= 1 ? weight : Math.round(weight * (1 + reps / 30) * 10) / 10);

async function listMetrics(req, res) {
  const member = await resolveMember(req);
  const metrics = await BodyMetric.find({ member: member._id }).sort({ day: 1 });
  res.json({
    member: { id: member.id, name: member.name },
    goal: { targetWeight: member.goals?.targetWeight ?? null },
    metrics,
  });
}

async function upsertMetric(req, res) {
  const { day, ...values } = req.valid.body;
  const set = {};
  for (const key of ['weight', 'bodyFat', 'note']) if (key in values) set[key] = values[key];
  for (const [key, value] of Object.entries(values.measurements ?? {})) set[`measurements.${key}`] = value;

  const metric = await BodyMetric.findOneAndUpdate(
    { member: req.user._id, day },
    { $set: set, $setOnInsert: { gym: req.user.gym, member: req.user._id, day } },
    { upsert: true, new: true, runValidators: true }
  );
  res.json({ metric });
}

async function deleteMetric(req, res) {
  const { deletedCount } = await BodyMetric.deleteOne({ _id: req.valid.params.id, member: req.user._id });
  if (!deletedCount) throw ApiError.notFound('Entry not found');
  res.status(204).end();
}

async function setGoal(req, res) {
  req.user.set('goals.targetWeight', req.valid.body.targetWeight);
  await req.user.save();
  res.json({ goal: { targetWeight: req.user.goals.targetWeight } });
}

// Monday of the week containing `date`, in the member's timezone, as YYYY-MM-DD.
function weekStart(date, tz) {
  const local = new Date(date.getTime() - tz * 60 * 1000);
  const daysSinceMonday = (local.getUTCDay() + 6) % 7;
  return new Date(local.getTime() - daysSinceMonday * DAY_MS).toISOString().slice(0, 10);
}

async function getTraining(req, res) {
  const member = await resolveMember(req);
  const { weeks, tz } = req.valid.query;
  const now = new Date();
  const currentWeek = weekStart(now, tz);
  const from = new Date(new Date(`${currentWeek}T00:00:00Z`).getTime() - (weeks - 1) * 7 * DAY_MS + tz * 60 * 1000);

  const [recent, exercises] = await Promise.all([
    WorkoutSession.find({ member: member._id, completedAt: { $gte: from } })
      .select('completedAt totalVolume')
      .lean(),
    // Every exercise this member has logged a completed set for, with their all-time best.
    WorkoutSession.aggregate([
      { $match: { member: new mongoose.Types.ObjectId(member.id) } },
      { $unwind: '$entries' },
      {
        $project: {
          exercise: '$entries.exercise',
          name: '$entries.exerciseName',
          muscleGroup: '$entries.muscleGroup',
          completedAt: 1,
          sets: { $filter: { input: '$entries.sets', cond: '$$this.done' } },
        },
      },
      { $match: { 'sets.0': { $exists: true } } },
      {
        $group: {
          _id: '$exercise',
          name: { $last: '$name' },
          muscleGroup: { $last: '$muscleGroup' },
          sessions: { $sum: 1 },
          bestWeight: { $max: { $max: '$sets.weight' } },
          lastLogged: { $max: '$completedAt' },
        },
      },
      { $sort: { lastLogged: -1 } },
    ]),
  ]);

  const weekly = Array.from({ length: weeks }, (_, i) => {
    const start = new Date(new Date(`${currentWeek}T00:00:00Z`).getTime() - (weeks - 1 - i) * 7 * DAY_MS);
    return { weekStart: start.toISOString().slice(0, 10), workouts: 0, volume: 0 };
  });
  const byWeek = new Map(weekly.map((w) => [w.weekStart, w]));
  for (const session of recent) {
    const bucket = byWeek.get(weekStart(session.completedAt, tz));
    if (bucket) {
      bucket.workouts += 1;
      bucket.volume += session.totalVolume;
    }
  }

  res.json({
    weekly,
    exercises: exercises.map((e) => ({
      exercise: e._id.toString(),
      name: e.name,
      muscleGroup: e.muscleGroup,
      sessions: e.sessions,
      bestWeight: e.bestWeight ?? null,
    })),
  });
}

async function getStrength(req, res) {
  const member = await resolveMember(req);
  const { exercise } = req.valid.query;
  const sessions = await WorkoutSession.find({ member: member._id, 'entries.exercise': exercise })
    .select('completedAt entries')
    .sort({ completedAt: 1 })
    .lean();

  const points = [];
  let name = null;
  for (const session of sessions) {
    for (const entry of session.entries) {
      if (entry.exercise.toString() !== exercise) continue;
      name = entry.exerciseName;
      const done = entry.sets.filter((s) => s.done);
      if (done.length === 0) continue;
      const weighted = done.filter((s) => s.weight > 0);
      const top = [...weighted].sort((a, b) => estimateOneRepMax(b.weight, b.reps) - estimateOneRepMax(a.weight, a.reps))[0];
      points.push({
        date: session.completedAt,
        bestWeight: weighted.length ? Math.max(...weighted.map((s) => s.weight)) : null,
        e1rm: top ? estimateOneRepMax(top.weight, top.reps) : null,
        topSet: top ? { weight: top.weight, reps: top.reps } : null,
        reps: done.reduce((n, s) => n + s.reps, 0),
        volume: done.reduce((n, s) => n + (s.weight ?? 0) * s.reps, 0),
      });
    }
  }
  if (!name) throw ApiError.notFound('No logged sets for this exercise yet');
  res.json({ exercise: { id: exercise, name }, points });
}

module.exports = { listMetrics, upsertMetric, deleteMetric, setGoal, getTraining, getStrength, estimateOneRepMax };
