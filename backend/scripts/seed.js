// Creates a demo gym with one account per role. Development only: wipes existing data.
const bcrypt = require('bcrypt');
const env = require('../src/config/env');
const { connectDb, disconnectDb } = require('../src/config/db');
const { ROLES } = require('../src/config/roles');
const User = require('../src/models/User');
const Gym = require('../src/models/Gym');
const RefreshToken = require('../src/models/RefreshToken');
const Exercise = require('../src/models/Exercise');
const WorkoutPlan = require('../src/models/WorkoutPlan');
const WorkoutSession = require('../src/models/WorkoutSession');
const BodyMetric = require('../src/models/BodyMetric');
const Attendance = require('../src/models/Attendance');
const Membership = require('../src/models/Membership');
const MembershipPlan = require('../src/models/MembershipPlan');
const { seedDemoMemberships } = require('../src/data/demoMemberships');
const Availability = require('../src/models/Availability');
const Booking = require('../src/models/Booking');
const GymClass = require('../src/models/GymClass');
const { seedDemoSchedule } = require('../src/data/demoSchedule');
const { seedDemoProgress } = require('../src/data/demoProgress');
const { loadExerciseLibrary } = require('../src/data/loadExercises');

const PASSWORD = 'Password123!';

async function seed() {
  if (env.isProd) throw new Error('Refusing to seed a production database');
  await connectDb();
  await Promise.all(
    [User, Gym, RefreshToken, Exercise, WorkoutPlan, WorkoutSession, BodyMetric, Attendance, Membership, MembershipPlan, Availability, Booking, GymClass].map((model) => model.deleteMany({}))
  );
  await loadExerciseLibrary();

  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  const owner = new User({ name: 'Arjun Mehta', email: 'owner@fitforge.dev', role: ROLES.GYM_OWNER, passwordHash });
  const gym = await Gym.create({ name: 'Iron Temple', owner: owner._id });
  owner.gym = gym._id;
  await owner.save();

  const base = { gym: gym._id, passwordHash };
  const trainer = await User.create({ ...base, name: 'Priya Nair', email: 'trainer@fitforge.dev', role: ROLES.TRAINER });
  await User.create({ ...base, name: 'Rohan Das', email: 'staff@fitforge.dev', role: ROLES.STAFF });
  const member = await User.create({
    ...base,
    name: 'Vaishnavi Rao',
    email: 'member@fitforge.dev',
    role: ROLES.MEMBER,
    trainer: trainer._id,
  });

  const byName = Object.fromEntries((await Exercise.find({ gym: null })).map((e) => [e.name, e._id]));
  const entry = (name, sets, reps, restSeconds = 90) => ({ exercise: byName[name], sets, reps, restSeconds });
  const plan = await WorkoutPlan.create({
    gym: gym._id,
    createdBy: trainer._id,
    name: 'Push Pull Legs',
    description: 'Three-day split for building strength and muscle.',
    assignedTo: [member._id],
    days: [
      {
        name: 'Push',
        exercises: [
          entry('Barbell Bench Press', 4, '6-8', 120),
          entry('Overhead Press', 3, '8-10'),
          entry('Incline Dumbbell Press', 3, '10-12'),
          entry('Lateral Raise', 3, '12-15', 60),
          entry('Triceps Pushdown', 3, '12', 60),
        ],
      },
      {
        name: 'Pull',
        exercises: [
          entry('Deadlift', 3, '5', 150),
          entry('Lat Pulldown', 3, '10'),
          entry('Seated Cable Row', 3, '10-12'),
          entry('Face Pull', 3, '15', 60),
          entry('Hammer Curl', 3, '12', 60),
        ],
      },
      {
        name: 'Legs',
        exercises: [
          entry('Back Squat', 4, '6-8', 150),
          entry('Romanian Deadlift', 3, '8-10', 120),
          entry('Leg Press', 3, '12'),
          entry('Walking Lunge', 3, '10'),
          entry('Plank', 3, '45', 60),
        ],
      },
    ],
  });

  await plan.populate('days.exercises.exercise');
  await seedDemoProgress(member, plan);
  await seedDemoMemberships(gym, owner);
  await seedDemoSchedule(gym, owner);

  console.log(`Seeded gym "${gym.name}" (join code ${gym.joinCode})`);
  console.log(`Accounts: owner@ / trainer@ / staff@ / member@fitforge.dev, password ${PASSWORD}`);
  await disconnectDb();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
