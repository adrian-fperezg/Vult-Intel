import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const ALGORITHM = 'aes-256-cbc';
const DEFAULT_KEY = 'vult_intel_default_secret_key_32b';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || DEFAULT_KEY;

if (!process.env.ENCRYPTION_KEY) {
  console.warn("⚠️ [WARN] ENCRYPTION_KEY environment variable is missing. Using default key.");
}

function getKey(): Buffer {
  let key = ENCRYPTION_KEY;
  if (key.length < 32) {
    key = key.padEnd(32, '0');
  } else if (key.length > 32) {
    key = key.substring(0, 32);
  }
  return Buffer.from(key, 'utf8');
}

export function encryptToken(plain: string): string {
  if (!plain) return '';
  if (!ENCRYPTION_KEY) {
    throw new Error("CRITICAL: ENCRYPTION_KEY environment variable is not set.");
  }
  try {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
    const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
  } catch (err: any) {
    console.error('[ENCRYPT ERROR]:', err.message);
    return '';
  }
}

export function decryptToken(cipherText: string): string {
  if (!cipherText || !cipherText.includes(':')) return '';
  if (!ENCRYPTION_KEY) {
    console.warn("CRITICAL: ENCRYPTION_KEY environment variable is not set. Decryption will fail.");
    return '';
  }
  try {
    const [ivHex, encHex] = cipherText.split(':');
    if (!ivHex || !encHex) return '';
    const iv = Buffer.from(ivHex, 'hex');
    const enc = Buffer.from(encHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
    const decrypted = Buffer.concat([decipher.update(enc), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (err: any) {
    console.error('[DECRYPT ERROR] Possible key mismatch or malformed token:', err.message);
    return '';
  }
}
