const NutritionLog = require('../models/NutritionLog');
const ApiError = require('../utils/ApiError');
const { ROLES } = require('../config/roles');
const { dayKey, addDays } = require('../utils/dates');
const { findClient } = require('../utils/scope');

const totalsOf = (log) =>
  (log?.entries ?? []).reduce(
    (t, e) => ({ calories: t.calories + e.calories, protein: t.protein + e.protein, carbs: t.carbs + e.carbs, fat: t.fat + e.fat }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

const goalsOf = (user) => ({
  calories: user.nutritionGoals?.calories ?? null,
  protein: user.nutritionGoals?.protein ?? null,
  carbs: user.nutritionGoals?.carbs ?? null,
  fat: user.nutritionGoals?.fat ?? null,
  waterMl: user.nutritionGoals?.waterMl ?? null,
});

async function getDay(req, res) {
  const { member: memberId, tz } = req.valid.query;
  if (req.user.role !== ROLES.MEMBER && !memberId) throw ApiError.badRequest('Pick a member');
  const member = req.user.role === ROLES.MEMBER ? req.user : await findClient(req.user, memberId);
  const day = req.valid.query.day ?? dayKey(new Date(), tz);
  const weekStart = addDays(day, -6);
  const logs = await NutritionLog.find({ member: member._id, day: { $gte: weekStart, $lte: day } });
  const byDay = new Map(logs.map((l) => [l.day, l]));
  const log = byDay.get(day);

  res.json({
    member: { id: member.id, name: member.name },
    day,
    goals: goalsOf(member),
    log: log ? log.toJSON() : { day, entries: [], waterMl: 0 },
    totals: totalsOf(log),
    week: Array.from({ length: 7 }, (_, i) => {
      const d = addDays(weekStart, i);
      return { day: d, ...totalsOf(byDay.get(d)), waterMl: byDay.get(d)?.waterMl ?? 0, logged: !!byDay.get(d)?.entries.length };
    }),
  });
}

async function setGoals(req, res) {
  for (const [key, value] of Object.entries(req.valid.body)) req.user.set(`nutritionGoals.${key}`, value);
  await req.user.save();
  res.json({ goals: goalsOf(req.user) });
}

const upsertDay = (user, day) =>
  NutritionLog.findOneAndUpdate(
    { member: user._id, day },
    { $setOnInsert: { gym: user.gym, member: user._id, day } },
    { upsert: true, new: true }
  );

async function addEntry(req, res) {
  const { day, ...entry } = req.valid.body;
  await upsertDay(req.user, day);
  const log = await NutritionLog.findOneAndUpdate({ member: req.user._id, day }, { $push: { entries: entry } }, { new: true, runValidators: true });
  res.status(201).json({ log, totals: totalsOf(log) });
}

async function deleteEntry(req, res) {
  const log = await NutritionLog.findOneAndUpdate(
    { member: req.user._id, 'entries._id': req.valid.params.id },
    { $pull: { entries: { _id: req.valid.params.id } } },
    { new: true }
  );
  if (!log) throw ApiError.notFound('Entry not found');
  res.json({ log, totals: totalsOf(log) });
}

async function setWater(req, res) {
  const { day, waterMl } = req.valid.body;
  await upsertDay(req.user, day);
  const log = await NutritionLog.findOneAndUpdate({ member: req.user._id, day }, { waterMl }, { new: true, runValidators: true });
  res.json({ log });
}

module.exports = { getDay, setGoals, addEntry, deleteEntry, setWater };
