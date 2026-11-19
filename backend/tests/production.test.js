const request = require('supertest');
const env = require('../src/config/env');
const { productionProblems, productionWarnings } = require('../src/config/production');
const { isDemoAccount } = require('../src/config/demo');
const { parseDsn, buildEvent, buildEnvelope, stackFrames } = require('../src/services/errorReporter');
const { passwordResetEmail } = require('../src/services/emailTemplates');
const { outbox } = require('../src/services/mailer');
const { app, startDb, clearDb, stopDb, PASSWORD, registerOwner } = require('./helpers');

beforeAll(startDb);
afterEach(async () => {
  jest.restoreAllMocks();
  outbox.length = 0;
  await clearDb();
});
afterAll(stopDb);

const liveConfig = (overrides = {}) => ({
  jwtAccessSecret: 'f3a9c1d27b8e4065aa1cde9032b7f6e1c58d4a2b9e0f7136',
  clientOrigin: 'https://fitforge.vercel.app',
  appUrl: 'https://fitforge.vercel.app',
  resendApiKey: 're_123',
  smtpUrl: '',
  sentryDsn: 'https://key@o1.ingest.sentry.io/42',
  storage: { driver: 's3' },
  ...overrides,
});

describe('production configuration checks', () => {
  it('accepts a proper live configuration', () => {
    expect(productionProblems(liveConfig())).toEqual([]);
    expect(productionWarnings(liveConfig())).toEqual([]);
  });

  it("accepts Render's generated secret (base64, 44 characters)", () => {
    expect(productionProblems(liveConfig({ jwtAccessSecret: 'q8Vw0kX2zR4mT7bN1cY5hJ9pL3sD6fG8aE0uI2oK4n8=' }))).toEqual([]);
  });

  it('rejects placeholder secrets and plain-http site addresses', () => {
    const problems = productionProblems(
      liveConfig({ jwtAccessSecret: 'local-compose-secret-change-me-local-compose-secret', appUrl: 'http://fitforge.example.com' })
    );
    expect(problems).toHaveLength(2);
    expect(problems[0]).toMatch(/JWT_ACCESS_SECRET/);
    expect(problems[1]).toMatch(/APP_URL/);
  });

  it('rejects low-variety secrets', () => {
    expect(productionProblems(liveConfig({ jwtAccessSecret: 'a'.repeat(64) }))).toHaveLength(1);
  });

  it('relaxes the rules for a site on localhost (docker compose)', () => {
    const local = liveConfig({ jwtAccessSecret: 'local-compose-secret-change-me', clientOrigin: 'http://localhost:3000', appUrl: 'http://localhost:3000' });
    expect(productionProblems(local)).toEqual([]);
    expect(productionWarnings({ ...local, resendApiKey: '', sentryDsn: '', storage: { driver: 'local' } })).toEqual([]);
  });

  it('warns about missing email, local uploads and missing error tracking', () => {
    const warnings = productionWarnings(liveConfig({ resendApiKey: '', sentryDsn: '', storage: { driver: 'local' } }));
    expect(warnings.join(' ')).toMatch(/email provider/);
    expect(warnings.join(' ')).toMatch(/STORAGE_DRIVER/);
    expect(warnings.join(' ')).toMatch(/SENTRY_DSN/);
  });
});

describe('demo accounts', () => {
  it('recognises the seed domain', () => {
    expect(isDemoAccount('Owner@FitForge.dev')).toBe(true);
    expect(isDemoAccount('owner@fitforge.dev.example.com')).toBe(false);
    expect(isDemoAccount('someone@example.com')).toBe(false);
  });

  it('cannot sign in or sign up on a live deployment', async () => {
    await registerOwner({ email: 'owner@fitforge.dev' });
    jest.replaceProperty(env, 'isLive', true);

    const login = await request(app).post('/api/auth/login').send({ email: 'owner@fitforge.dev', password: PASSWORD });
    expect(login.status).toBe(401);
    expect(login.body.message).toBe('Incorrect email or password');

    const signup = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Demo', email: 'new@fitforge.dev', password: PASSWORD, role: 'GYM_OWNER', gymName: 'Demo Gym' });
    expect(signup.status).toBe(400);
  });

  it('still signs in locally, including production mode on localhost (CI, docker compose)', async () => {
    await registerOwner({ email: 'owner@fitforge.dev' });
    const login = await request(app).post('/api/auth/login').send({ email: 'owner@fitforge.dev', password: PASSWORD });
    expect(login.status).toBe(200);
  });
});

describe('health check', () => {
  it('reports the database connection', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', database: 'ok' });
  });
});

describe('password reset email', () => {
  it('is sent with text and branded HTML', async () => {
    await registerOwner();
    await request(app).post('/api/auth/forgot-password').send({ email: 'owner@example.com' });

    expect(outbox).toHaveLength(1);
    const [mail] = outbox;
    expect(mail.subject).toBe('Reset your FitForge password');
    expect(mail.text).toMatch(/reset-password\?token=/);
    expect(mail.html).toMatch(/Choose a new password/);
    expect(mail.html).toContain('Hi Olive,');
  });

  it('escapes names in the HTML', () => {
    const { html, text } = passwordResetEmail({ name: '<script>x</script> Evil', link: 'https://a.example/r?token=1&b=2', minutes: 30 });
    expect(html).not.toContain('<script>x');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('token=1&amp;b=2');
    expect(text).toContain('https://a.example/r?token=1&b=2');
  });
});

describe('error reporter', () => {
  it('parses a Sentry DSN', () => {
    expect(parseDsn('https://abc123@o99.ingest.de.sentry.io/4507')).toEqual({
      dsn: 'https://abc123@o99.ingest.de.sentry.io/4507',
      key: 'abc123',
      endpoint: 'https://o99.ingest.de.sentry.io/api/4507/envelope/',
    });
    expect(parseDsn('')).toBeNull();
    expect(parseDsn('https://o99.ingest.sentry.io/4507')).toBeNull();
    expect(parseDsn('not a url')).toBeNull();
  });

  it('turns a stack into frames, oldest call first', () => {
    const frames = stackFrames(
      'Error: boom\n    at inner (/app/src/a.js:10:5)\n    at /app/node_modules/x/index.js:3:1\n    at outer (node:internal/process:1:1)'
    );
    expect(frames.map((f) => f.function)).toEqual(['outer', '<anonymous>', 'inner']);
    expect(frames[2]).toMatchObject({ filename: '/app/src/a.js', lineno: 10, colno: 5, in_app: true });
    expect(frames[1].in_app).toBe(false);
  });

  it('builds an event without request bodies or query strings', () => {
    const event = buildEvent(new TypeError('bad'), { request: { method: 'GET', path: '/api/plans' }, userId: 'u1' });
    expect(event.event_id).toMatch(/^[0-9a-f]{32}$/);
    expect(event.exception.values[0]).toMatchObject({ type: 'TypeError', value: 'bad' });
    expect(event.request).toEqual({ method: 'GET', url: '/api/plans' });
    expect(event.user).toEqual({ id: 'u1' });

    const lines = buildEnvelope(event, parseDsn('https://k@h.example/1')).split('\n');
    expect(lines).toHaveLength(3);
    expect(JSON.parse(lines[1])).toEqual({ type: 'event' });
    expect(JSON.parse(lines[2]).event_id).toBe(event.event_id);
  });
});
