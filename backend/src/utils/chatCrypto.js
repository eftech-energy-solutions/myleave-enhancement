import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV_PATH = path.resolve(__dirname, '../../../.env');
const ENV_KEY_NAME = 'CHAT_ENC_KEY';
const ENC_PREFIX = 'mlv1:';

let cachedKey = null;

function readKeyFromFile() {
  let raw = '';
  try {
    raw = fs.readFileSync(ENV_PATH, 'utf8');
  } catch {
    raw = '';
  }
  const match = raw.match(new RegExp(`^${ENV_KEY_NAME}\\s*=\\s*(.+)$`, 'm'));
  return match && match[1].trim() ? match[1].trim() : null;
}

function getKey() {
  if (cachedKey) return cachedKey;

  let b64 = process.env[ENV_KEY_NAME] || readKeyFromFile();

  if (!b64) {
    cachedKey = crypto.randomBytes(32);
    try {
      fs.appendFileSync(
        ENV_PATH,
        `\n# AES-256-GCM key for chat at-rest encryption (generated ${new Date().toISOString()})\n${ENV_KEY_NAME}=${cachedKey.toString('base64')}\n`
      );
      console.log(`🔐 Generated ${ENV_KEY_NAME} and appended to .env`);
    } catch (err) {
      console.warn(`⚠️  Could not persist ${ENV_KEY_NAME} to .env (messages will be unreadable after restart):`, err.message);
    }
    return cachedKey;
  }

  cachedKey = Buffer.from(b64, 'base64');
  if (cachedKey.length !== 32) {
    cachedKey = crypto.createHash('sha256').update(cachedKey).digest();
  }
  return cachedKey;
}

export function encryptChatText(plain) {
  const text = String(plain ?? '');
  if (!text) return text;

  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${ENC_PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

export function decryptChatText(payload) {
  const s = String(payload ?? '');
  if (!s || !s.startsWith(ENC_PREFIX)) {
    return s;
  }

  const body = s.slice(ENC_PREFIX.length);
  const [ivB64, tagB64, dataB64] = body.split(':');
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error('Malformed encrypted message payload');
  }

  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    getKey(),
    Buffer.from(ivB64, 'base64')
  );
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final()
  ]).toString('utf8');
}