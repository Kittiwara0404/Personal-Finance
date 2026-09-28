// Envelope encryption: each user gets a random data key (DEK) wrapped by the master key (KEK).
// Deleting the user's wrapped DEK makes all their ciphertext unrecoverable (crypto-shredding).
import crypto from 'node:crypto';
import { config } from '../config.js';

const ALG = 'aes-256-gcm';

function seal(key, plaintext, aad = '') {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALG, key, iv);
  cipher.setAAD(Buffer.from(aad));
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString('base64');
}

function open(key, sealed, aad = '') {
  const buf = Buffer.from(sealed, 'base64');
  const decipher = crypto.createDecipheriv(ALG, key, buf.subarray(0, 12));
  decipher.setAAD(Buffer.from(aad));
  decipher.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]);
}

export function newWrappedDataKey(userId) {
  return seal(config.masterKey, crypto.randomBytes(32), `dek:${userId}`);
}

export function unwrapDataKey(userId, wrapped) {
  return open(config.masterKey, wrapped, `dek:${userId}`);
}

/** AAD binds ciphertext to its row so it can't be swapped between records/users. */
export function encryptJson(dek, value, aad) {
  return seal(dek, Buffer.from(JSON.stringify(value)), aad);
}

export function decryptJson(dek, sealed, aad) {
  return JSON.parse(open(dek, sealed, aad).toString('utf8'));
}

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password, salt);
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export async function verifyPassword(password, stored) {
  const [scheme, saltB64, hashB64] = String(stored).split('$');
  if (scheme !== 'scrypt') return false;
  const expected = Buffer.from(hashB64, 'base64');
  const actual = await scrypt(password, Buffer.from(saltB64, 'base64'));
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function scrypt(password, salt) {
  return new Promise((resolve, reject) =>
    crypto.scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 }, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

export const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');
