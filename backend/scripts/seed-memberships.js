// Adds membership plans, demo members and their membership history to the demo gym, without
// deleting anything. Safe to run more than once.
const env = require('../src/config/env');
const { connectDb, disconnectDb } = require('../src/config/db');
const User = require('../src/models/User');
const Gym = require('../src/models/Gym');
const { seedDemoMemberships } = require('../src/data/demoMemberships');

async function run() {
  if (env.isProd) throw new Error('Refusing to add demo data to a production database');
  await connectDb();
  const owner = await User.findOne({ email: 'owner@fitforge.dev' });
  if (!owner) throw new Error('owner@fitforge.dev not found. Run npm run seed first.');
  const gym = await Gym.findById(owner.gym);
  const added = await seedDemoMemberships(gym, owner);
  console.log(`${gym.name}: ${added.plans} plans, ${added.memberships} memberships added.`);
}

run()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(disconnectDb);
