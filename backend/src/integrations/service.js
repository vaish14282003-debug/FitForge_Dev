const env = require('../config/env');
const logger = require('../config/logger');
const IntegrationConnection = require('../models/IntegrationConnection');
const { seal, open } = require('../utils/secretBox');
const { ProviderError } = require('./http');
const registry = require('./registry');

// Provider-independent logic: tokens are stored sealed and refreshed when about to expire, workouts
// are uploaded to every connected provider with auto-upload on, and a provider that answers 401
// (access revoked on their side) is disconnected.

/** A provider can be offered when its keys are set and stored tokens can be encrypted. */
const isAvailable = (provider) => Boolean(provider?.isConfigured() && env.tokenEncryptionKey);
const available = () => registry.all().filter(isAvailable);

const redirectUri = (provider) => `${env.appUrl.replace(/\/$/, '')}/api/integrations/${provider.id}/callback`;

async function connect(userId, provider, code) {
  const result = await provider.exchangeCode({ code, redirectUri: redirectUri(provider) });
  return IntegrationConnection.findOneAndUpdate(
    { user: userId, provider: provider.id },
    {
      user: userId,
      provider: provider.id,
      externalId: result.externalId,
      displayName: result.displayName,
      scope: result.scope,
      accessToken: seal(result.accessToken),
      refreshToken: seal(result.refreshToken),
      expiresAt: result.expiresAt,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function accessToken(connection, provider) {
  if (connection.expiresAt.getTime() - Date.now() > 60_000) return open(connection.accessToken);
  const tokens = await provider.refresh({ refreshToken: open(connection.refreshToken) });
  connection.accessToken = seal(tokens.accessToken);
  connection.refreshToken = seal(tokens.refreshToken);
  connection.expiresAt = tokens.expiresAt;
  await connection.save();
  return tokens.accessToken;
}

function recordExport(session, entry) {
  session.exports = [...(session.exports || []).filter((e) => e.provider !== entry.provider), { ...entry, at: new Date() }];
}

/** Sends one workout to one provider and records the outcome on it. Never throws. */
async function uploadSession(session, connection) {
  const provider = registry.get(connection.provider);
  if (!isAvailable(provider)) return session;
  try {
    const token = await accessToken(connection, provider);
    const { externalId, url } = await provider.uploadWorkout({ accessToken: token, session });
    recordExport(session, { provider: provider.id, status: 'uploaded', externalId, url: url ?? null, error: null });
  } catch (err) {
    let error;
    if (err.status === 401) {
      await IntegrationConnection.deleteOne({ _id: connection._id });
      error = `${provider.name} access was removed. Connect ${provider.name} again.`;
    } else {
      logger.warn(`${provider.name} upload failed for session ${session.id}: ${err.message}`);
      error = err instanceof ProviderError ? err.message : `Could not reach ${provider.name}. Try again later.`;
    }
    recordExport(session, { provider: provider.id, status: 'failed', externalId: null, url: null, error });
  }
  await session.save();
  return session;
}

/** After a workout is saved: send it to every connected provider with auto-upload on. */
async function autoUpload(session) {
  const ids = available().map((p) => p.id);
  if (!ids.length) return session;
  const connections = await IntegrationConnection.find({ user: session.member, provider: { $in: ids }, autoUpload: true });
  for (const connection of connections) await uploadSession(session, connection);
  return session;
}

/** Revoke on the provider's side (best effort), then forget the tokens. */
async function disconnect(userId, provider) {
  const connection = await IntegrationConnection.findOne({ user: userId, provider: provider.id });
  if (!connection) return;
  try {
    await provider.revoke({ refreshToken: open(connection.refreshToken), accessToken: open(connection.accessToken) });
  } catch (err) {
    logger.warn(`${provider.name} revoke failed for user ${userId}: ${err.message}`);
  }
  await IntegrationConnection.deleteOne({ _id: connection._id });
}

module.exports = { isAvailable, available, redirectUri, connect, uploadSession, autoUpload, disconnect };
