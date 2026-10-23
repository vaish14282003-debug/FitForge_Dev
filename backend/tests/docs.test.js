const request = require('supertest');
const app = require('../src/app');
const openapi = require('../src/docs/openapi');

// Walks the Express router so a new route without docs fails this test.
function mountedRoutes() {
  const routes = [];
  const prefixes = { auth: '/auth', users: '/users', gym: '/gym', exercises: '/exercises', plans: '/plans', sessions: '/sessions', progress: '/progress', attendance: '/attendance' };
  const apiRouter = require('../src/routes');
  for (const layer of apiRouter.stack) {
    if (layer.route) {
      Object.keys(layer.route.methods).forEach((m) => routes.push(`${m} ${layer.route.path}`));
    } else if (layer.handle?.stack) {
      const prefix = Object.values(prefixes).find((p) => layer.matchers?.[0]?.(p) || String(layer.regexp).includes(p.slice(1)));
      for (const sub of layer.handle.stack) {
        if (!sub.route) continue;
        const path = `${prefix}${sub.route.path === '/' ? '' : sub.route.path}`.replace(/:(\w+)/g, '{$1}');
        Object.keys(sub.route.methods).forEach((m) => routes.push(`${m} ${path}`));
      }
    }
  }
  return routes;
}

describe('API docs', () => {
  it('serves the Swagger UI and the raw spec', async () => {
    const ui = await request(app).get('/api/docs/');
    expect(ui.status).toBe(200);
    expect(ui.text).toContain('swagger-ui');

    const spec = await request(app).get('/api/docs.json');
    expect(spec.status).toBe(200);
    expect(spec.body.info.title).toBe('FitForge API');
  });

  it('documents every route the API exposes', () => {
    const documented = Object.entries(openapi.paths).flatMap(([path, ops]) => Object.keys(ops).map((m) => `${m} ${path}`));
    expect(documented.sort()).toEqual(mountedRoutes().sort());
  });
});
