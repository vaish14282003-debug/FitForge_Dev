const crypto = require('crypto');
const env = require('../config/env');

// AES-256-GCM for secrets we must store and use later (third-party access tokens). A leaked
// database dump alone doesn't reveal them. Format: v1.<iv>.<tag>.<ciphertext>, base64url parts.

function key(hex = env.tokenEncryptionKey) {
  if (!hex) throw new Error('TOKEN_ENCRYPTION_KEY is not set');
  return Buffer.from(hex, 'hex');
}

function seal(plaintext, hexKey) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(hexKey), iv);
  const data = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  return ['v1', iv, cipher.getAuthTag(), data].map((p) => (typeof p === 'string' ? p : p.toString('base64url'))).join('.');
}

function open(sealed, hexKey) {
  const [version, iv, tag, data] = String(sealed).split('.');
  if (version !== 'v1' || !iv || !tag || data === undefined) throw new Error('Unreadable sealed value');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(hexKey), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
}

module.exports = { seal, open };
