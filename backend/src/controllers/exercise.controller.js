const Exercise = require('../models/Exercise');
const ApiError = require('../utils/ApiError');
const { saveImage, removeQuietly } = require('../storage');

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// The shared library plus this gym's own exercises.
const visibleTo = (user) => ({ $or: [{ gym: null }, { gym: user.gym }] });

async function listExercises(req, res) {
  const { muscleGroup, q, muscle } = req.valid.query;
  const filter = { $and: [visibleTo(req.user)] };
  if (muscleGroup) filter.$and.push({ muscleGroup });
  if (muscle) filter.$and.push({ $or: [{ primaryMuscles: muscle }, { secondaryMuscles: muscle }] });
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

// Only a gym's own exercises take photos; the built-in library is shared by every gym.
async function uploadExerciseImage(req, res) {
  const exercise = await Exercise.findOne({ _id: req.valid.params.id, gym: req.user.gym });
  if (!exercise) throw ApiError.notFound('Exercise not found among your gym\'s own exercises');
  const key = await saveImage(req.file, { gymId: req.user.gym, folder: 'exercises', size: 1200 });
  const previous = exercise.imageKey;
  exercise.imageKey = key;
  await exercise.save();
  await removeQuietly(previous);
  res.json({ exercise });
}

module.exports = { listExercises, createExercise, uploadExerciseImage, visibleTo };
