/**
 * Scrypt-based key hashing using Node.js built-in crypto.
 *
 * Why scrypt over bcrypt:
 *   - Memory-hard: resists GPU/ASIC attacks (bcrypt is not memory-hard)
 *   - OWASP 2024 recommendation when argon2 native build is not available
 *   - Zero external dependencies — uses Node's built-in crypto module
 *
 * Why scryptSync vs async:
 *   - The surrounding Drizzle/SQLite stack is synchronous (better-sqlite3)
 *   - scryptSync keeps the call-site simple with no promise wrapping
 *   - The CPU cost (~100ms) is intentional and bounded; it's not called in a hot path
 *
 * Hash format stored in DB:
 *   `$scrypt$N=<N>,r=<r>,p=<p>$<salt_base64>$<hash_base64>`
 *
 * Parameters (OWASP minimum for interactive login, 2024):
 *   N = 65536  (2^16 — ~64 MB RAM per hash operation)
 *   r = 8      (block size)
 *   p = 1      (parallelism factor)
 *   keylen = 64 bytes
 *
 * Why maxmem = 128 MB:
 *   Node.js default maxmem is 32 MB. scrypt with N=65536, r=8 needs
 *   128 × N × r = 64 MB, which exceeds the default and throws
 *   ERR_CRYPTO_INVALID_SCRYPT_PARAMS at runtime. 128 MB gives 2× headroom.
 */
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const PARAMS = { N: 65536, r: 8, p: 1 } as const;
const SCRYPT_MAXMEM = 128 * 1024 * 1024; // 128 MB
const KEY_LEN = 64;
const PREFIX = '$scrypt$';

export function hashKey(plaintext: string): string {
  const salt = randomBytes(32);
  const hash = scryptSync(plaintext, salt, KEY_LEN, { ...PARAMS, maxmem: SCRYPT_MAXMEM });
  return `${PREFIX}N=${PARAMS.N},r=${PARAMS.r},p=${PARAMS.p}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export function verifyKey(plaintext: string, stored: string): boolean {
  if (!stored.startsWith(PREFIX)) return false;

  const parts = stored.slice(PREFIX.length).split('$');
  if (parts.length !== 3) return false;

  const [paramStr, saltB64, hashB64] = parts;
  const params = Object.fromEntries(paramStr.split(',').map((s) => s.split('=')));

  const N = Number(params['N']);
  const r = Number(params['r']);
  const p = Number(params['p']);
  if (!N || !r || !p) return false;

  const salt = Buffer.from(saltB64, 'base64');
  const expectedHash = Buffer.from(hashB64, 'base64');

  // maxmem must also be set on verify — same params, same memory requirement.
  const maxmem = Math.max(SCRYPT_MAXMEM, 128 * N * r * 2);

  let actualHash: Buffer;
  try {
    actualHash = scryptSync(plaintext, salt, expectedHash.length, { N, r, p, maxmem }) as Buffer;
  } catch {
    return false;
  }

  return timingSafeEqual(actualHash, expectedHash);
}

/** Minimum key strength gate — enforced when GM sets the library player key. */
export function validateKeyStrength(key: string): string | null {
  if (key.length < 12) return 'Key must be at least 12 characters.';
  if (key.length > 256) return 'Key must be at most 256 characters.';
  const classes = [/[A-Z]/, /[a-z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((r) => r.test(key)).length;
  if (classes < 2)
    return 'Key must contain at least 2 character classes (upper, lower, digits, symbols).';
  return null;
}
