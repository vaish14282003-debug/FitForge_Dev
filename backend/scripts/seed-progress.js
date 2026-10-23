// Adds demo training history and weigh-ins for member@fitforge.dev, without deleting anything.
// Skips if that member already has history beyond a couple of workouts.
const env = require('../src/config/env');
const { connectDb, disconnectDb } = require('../src/config/db');
const User = require('../src/models/User');
// Registers the model so plans can populate their exercises.
require('../src/models/Exercise');
const WorkoutPlan = require('../src/models/WorkoutPlan');
const WorkoutSession = require('../src/models/WorkoutSession');
const BodyMetric = require('../src/models/BodyMetric');
const { seedDemoProgress } = require('../src/data/demoProgress');

async function run() {
  if (env.isProd) throw new Error('Refusing to add demo data to a production database');
  await connectDb();
  const member = await User.findOne({ email: 'member@fitforge.dev' });
  if (!member) throw new Error('member@fitforge.dev not found. Run npm run seed first.');

  const [sessions, metrics] = await Promise.all([
    WorkoutSession.countDocuments({ member: member._id }),
    BodyMetric.countDocuments({ member: member._id }),
  ]);
  if (sessions > 3 || metrics > 0) {
    console.log(`Skipped: ${member.email} already has ${sessions} workouts and ${metrics} weigh-ins.`);
    return;
  }

  const plan = await WorkoutPlan.findOne({ assignedTo: member._id })
    .sort({ createdAt: 1 })
    .populate('days.exercises.exercise');
  if (!plan) throw new Error(`${member.email} has no assigned plan to build history from.`);

  const added = await seedDemoProgress(member, plan);
  console.log(`Added ${added.sessions} past workouts and ${added.metrics} weigh-ins for ${member.email} (plan: ${plan.name}).`);
}

run()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(disconnectDb);
