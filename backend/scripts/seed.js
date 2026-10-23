// Creates a demo gym with one account per role. Development only: wipes existing data.
const bcrypt = require('bcrypt');
const env = require('../src/config/env');
const { connectDb, disconnectDb } = require('../src/config/db');
const { ROLES } = require('../src/config/roles');
const User = require('../src/models/User');
const Gym = require('../src/models/Gym');
const RefreshToken = require('../src/models/RefreshToken');

const PASSWORD = 'Password123!';

async function seed() {
  if (env.isProd) throw new Error('Refusing to seed a production database');
  await connectDb();
  await Promise.all([User.deleteMany({}), Gym.deleteMany({}), RefreshToken.deleteMany({})]);

  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  const owner = new User({ name: 'Arjun Mehta', email: 'owner@fitforge.dev', role: ROLES.GYM_OWNER, passwordHash });
  const gym = await Gym.create({ name: 'Iron Temple', owner: owner._id });
  owner.gym = gym._id;
  await owner.save();

  const base = { gym: gym._id, passwordHash };
  const trainer = await User.create({ ...base, name: 'Priya Nair', email: 'trainer@fitforge.dev', role: ROLES.TRAINER });
  await User.create({ ...base, name: 'Rohan Das', email: 'staff@fitforge.dev', role: ROLES.STAFF });
  await User.create({
    ...base,
    name: 'Vaishnavi Rao',
    email: 'member@fitforge.dev',
    role: ROLES.MEMBER,
    trainer: trainer._id,
  });

  console.log(`Seeded gym "${gym.name}" (join code ${gym.joinCode})`);
  console.log(`Accounts: owner@ / trainer@ / staff@ / member@fitforge.dev, password ${PASSWORD}`);
  await disconnectDb();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
