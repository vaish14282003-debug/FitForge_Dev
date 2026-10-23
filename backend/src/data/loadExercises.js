const Exercise = require('../models/Exercise');
const LIBRARY = require('./exercises');

// Upserts the built-in library by name. Safe to run repeatedly; never touches gym exercises.
async function loadExerciseLibrary() {
  await Exercise.bulkWrite(
    LIBRARY.map((exercise) => ({
      updateOne: { filter: { gym: null, name: exercise.name }, update: { $set: exercise }, upsert: true },
    }))
  );
  return LIBRARY.length;
}

module.exports = { loadExerciseLibrary };
