const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../src/app');

let mongod;

async function startDb() {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
}

async function clearDb() {
  await Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})));
}

async function stopDb() {
  await mongoose.disconnect();
  await mongod.stop();
}

const PASSWORD = 'Password123!';

// Each agent keeps its own cookie jar, i.e. its own logged-in session.
async function registerOwner(overrides = {}) {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/register').send({
    name: 'Olive Owner',
    email: 'owner@example.com',
    password: PASSWORD,
    role: 'GYM_OWNER',
    gymName: 'Iron Temple',
    ...overrides,
  });
  const gym = (await agent.get('/api/gym')).body.gym;
  return { agent, user: res.body.user, gym, res };
}

async function registerMember(gymCode, overrides = {}) {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/register').send({
    name: 'Mia Member',
    email: 'member@example.com',
    password: PASSWORD,
    role: 'MEMBER',
    gymCode,
    ...overrides,
  });
  return { agent, user: res.body.user, res };
}

// Owner creates the account, then we log in as it.
async function createAndLogin(ownerAgent, role, email) {
  const created = await ownerAgent.post('/api/users').send({ name: `${role} User`, email, password: PASSWORD, role });
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ email, password: PASSWORD });
  return { agent, user: created.body.user };
}

module.exports = { app, startDb, clearDb, stopDb, PASSWORD, registerOwner, registerMember, createAndLogin };
