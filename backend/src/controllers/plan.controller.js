const WorkoutPlan = require('../models/WorkoutPlan');
const Exercise = require('../models/Exercise');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { ROLES, PERMISSIONS, can } = require('../config/roles');
const { visibleTo } = require('./exercise.controller');

const POPULATE = [
  { path: 'days.exercises.exercise', select: 'name muscleGroup equipment imageUrl instructions' },
  { path: 'assignedTo', select: 'name email' },
  { path: 'createdBy', select: 'name' },
];

const isOwnerLevel = (user) => can(user.role, PERMISSIONS.GYM_SETTINGS);

// Trainers see and manage the plans they wrote; owners see every plan in the gym;
// everyone else only sees plans assigned to them.
function scopeFor(user) {
  if (isOwnerLevel(user)) return { gym: user.gym };
  if (can(user.role, PERMISSIONS.WORKOUT_CREATE)) return { gym: user.gym, createdBy: user._id };
  return { gym: user.gym, assignedTo: user._id };
}

async function findManageable(req) {
  const plan = await WorkoutPlan.findOne({ _id: req.valid.params.id, ...scopeFor(req.user) });
  if (!plan) throw ApiError.notFound('Plan not found');
  return plan;
}

// Every exercise in the plan must be one this gym can see.
async function assertExercisesUsable(user, days) {
  const ids = [...new Set(days.flatMap((day) => day.exercises.map((e) => e.exercise)))];
  const found = await Exercise.countDocuments({ _id: { $in: ids }, ...visibleTo(user) });
  if (found !== ids.length) throw ApiError.badRequest('One or more exercises are not available in this gym');
}

async function listPlans(req, res) {
  const plans = await WorkoutPlan.find(scopeFor(req.user)).populate(POPULATE).sort({ updatedAt: -1 });
  res.json({ plans });
}

async function getPlan(req, res) {
  const plan = await WorkoutPlan.findOne({ _id: req.valid.params.id, ...scopeFor(req.user) }).populate(POPULATE);
  if (!plan) throw ApiError.notFound('Plan not found');
  res.json({ plan });
}

async function createPlan(req, res) {
  await assertExercisesUsable(req.user, req.valid.body.days);
  const plan = await WorkoutPlan.create({ ...req.valid.body, gym: req.user.gym, createdBy: req.user._id });
  await plan.populate(POPULATE);
  res.status(201).json({ plan });
}

async function updatePlan(req, res) {
  const plan = await findManageable(req);
  await assertExercisesUsable(req.user, req.valid.body.days);
  plan.set(req.valid.body);
  await plan.save();
  await plan.populate(POPULATE);
  res.json({ plan });
}

async function deletePlan(req, res) {
  const plan = await findManageable(req);
  await plan.deleteOne();
  res.status(204).end();
}

async function setAssignees(req, res) {
  const plan = await findManageable(req);
  const { memberIds } = req.valid.body;

  const filter = { _id: { $in: memberIds }, gym: req.user.gym, role: ROLES.MEMBER, isActive: true };
  // Trainers can only put their own clients on a plan.
  if (!isOwnerLevel(req.user)) filter.trainer = req.user._id;
  const allowed = await User.countDocuments(filter);
  if (allowed !== memberIds.length) {
    throw ApiError.badRequest(
      isOwnerLevel(req.user) ? 'Some members are not in this gym' : 'You can only assign plans to your own clients'
    );
  }

  plan.assignedTo = memberIds;
  await plan.save();
  await plan.populate(POPULATE);
  res.json({ plan });
}

module.exports = { listPlans, getPlan, createPlan, updatePlan, deletePlan, setAssignees };
