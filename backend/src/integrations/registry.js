/**
 * Fitness services FitForge can send workouts to. Each provider is one module implementing the
 * contract below; everything shared (encrypted token storage, refresh, auto-upload, disconnect,
 * the OAuth round trip, the API routes and the website card) lives in the generic layer, so a new
 * provider (Garmin, Google Health…) is added here without touching the others.
 *
 * Members connect with the provider's own OAuth sign-in: FitForge never sees their password.
 *
 * @typedef {object} Provider
 * @property {string} id                        URL-safe id, e.g. "strava"
 * @property {string} name                      Display name
 * @property {() => boolean} isConfigured       Whether the server has this provider's keys
 * @property {(a: {redirectUri: string, state: string}) => string} authorizeUrl
 * @property {(scope: string) => boolean} hasRequiredScope  Did the member grant what uploading needs?
 * @property {(a: {code: string, redirectUri: string}) => Promise<Tokens & {externalId: string, displayName: string, scope: string}>} exchangeCode
 * @property {(a: {refreshToken: string}) => Promise<Tokens>} refresh
 * @property {(a: {accessToken: string, session: object}) => Promise<{externalId: string, url: string|null}>} uploadWorkout
 * @property {(a: {refreshToken: string, accessToken: string}) => Promise<void>} revoke
 *
 * @typedef {{accessToken: string, refreshToken: string, expiresAt: Date}} Tokens
 */

const providers = new Map();

function register(provider) {
  for (const key of ['id', 'name', 'isConfigured', 'authorizeUrl', 'hasRequiredScope', 'exchangeCode', 'refresh', 'uploadWorkout', 'revoke']) {
    if (!provider[key]) throw new Error(`Integration provider ${provider.id || '?'} is missing "${key}"`);
  }
  if (!/^[a-z][a-z0-9-]*$/.test(provider.id)) throw new Error(`Invalid provider id "${provider.id}"`);
  providers.set(provider.id, provider);
  return () => providers.delete(provider.id); // for tests
}

register(require('./providers/strava'));

const get = (id) => providers.get(id) || null;
const all = () => [...providers.values()];

module.exports = { register, get, all };
