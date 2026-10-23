const Exercise = require('../models/Exercise');
const ApiError = require('../utils/ApiError');

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// The shared library plus this gym's own exercises.
const visibleTo = (user) => ({ $or: [{ gym: null }, { gym: user.gym }] });

async function listExercises(req, res) {
  const { muscleGroup, q } = req.valid.query;
  const filter = { $and: [visibleTo(req.user)] };
  if (muscleGroup) filter.$and.push({ muscleGroup });
  if (q) filter.$and.push({ name: { $regex: escapeRegex(q), $options: 'i' } });

  const exercises = await Exercise.find(filter).sort({ name: 1 });
  res.json({ exercises });
}

async function createExercise(req, res) {
  const { name } = req.valid.body;
  const clash = await Exercise.exists({
    ...visibleTo(req.user),
    name: { $regex: `^${escapeRegex(name)}$`, $options: 'i' },
  });
  if (clash) throw ApiError.conflict('An exercise with this name already exists');

  const exercise = await Exercise.create({ ...req.valid.body, gym: req.user.gym, createdBy: req.user._id });
  res.status(201).json({ exercise });
}

module.exports = { listExercises, createExercise, visibleTo };
