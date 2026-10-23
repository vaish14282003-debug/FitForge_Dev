// Adds trainer hours, demo sessions and three weeks of classes to the demo gym, without deleting anything.
const env = require('../src/config/env');
const { connectDb, disconnectDb } = require('../src/config/db');
const User = require('../src/models/User');
const Gym = require('../src/models/Gym');
const { seedDemoSchedule } = require('../src/data/demoSchedule');

async function run() {
  if (env.isProd) throw new Error('Refusing to add demo data to a production database');
  await connectDb();
  const owner = await User.findOne({ email: 'owner@fitforge.dev' });
  if (!owner) throw new Error('owner@fitforge.dev not found. Run npm run seed first.');
  const gym = await Gym.findById(owner.gym);
  const added = await seedDemoSchedule(gym, owner);
  console.log(`${gym.name}: ${added.classes} classes and ${added.bookings} sessions added.`);
}

run()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(disconnectDb);
