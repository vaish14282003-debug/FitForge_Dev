// Adds or updates the built-in exercise library without touching any other data.
const { connectDb, disconnectDb } = require('../src/config/db');
const { loadExerciseLibrary } = require('../src/data/loadExercises');

connectDb()
  .then(loadExerciseLibrary)
  .then(async (count) => {
    console.log(`Exercise library ready (${count} exercises)`);
    await disconnectDb();
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
