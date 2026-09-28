import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(process.env.DATA_DIR ?? path.join(here, '..', 'data'));
fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });

const isProd = process.env.NODE_ENV === 'production';

/** 32-byte master key (KEK). Production must supply it; dev generates one on disk. */
function loadMasterKey() {
  const raw = process.env.APP_ENCRYPTION_KEY;
  if (raw) {
    const key = Buffer.from(raw, 'base64');
    if (key.length !== 32) throw new Error('APP_ENCRYPTION_KEY must be 32 bytes, base64-encoded');
    return key;
  }
  if (isProd) throw new Error('APP_ENCRYPTION_KEY is required in production');
  const keyFile = path.join(dataDir, '.dev-master-key');
  if (!fs.existsSync(keyFile)) {
    fs.writeFileSync(keyFile, crypto.randomBytes(32).toString('base64'), { mode: 0o600 });
    console.warn('[security] Generated a dev master key at', keyFile, '— set APP_ENCRYPTION_KEY in production.');
  }
  return Buffer.from(fs.readFileSync(keyFile, 'utf8').trim(), 'base64');
}

export const config = {
  isProd,
  port: Number(process.env.PORT ?? 8787),
  dataDir,
  dbFile: process.env.DB_FILE ?? path.join(dataDir, 'finance.db'),
  masterKey: loadMasterKey(),
  sessionTtlMs: 7 * 24 * 60 * 60 * 1000,
  sessionIdleMs: Number(process.env.SESSION_IDLE_MINUTES ?? 30) * 60 * 1000,
  corsOrigins: (process.env.CORS_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean),
  ai: {
    enabled: Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN),
    model: process.env.ADVISOR_MODEL ?? 'claude-opus-5',
    guardModel: process.env.GUARD_MODEL ?? process.env.ADVISOR_MODEL ?? 'claude-opus-5',
    effort: process.env.ADVISOR_EFFORT ?? 'medium',
    maxInputChars: 2000,
    maxHistory: 20,
  },
  clientDist: path.resolve(here, '..', '..', 'client', 'dist'),
};
