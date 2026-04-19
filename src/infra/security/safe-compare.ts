/**
 * Timing-safe string comparison.
 *
 * Direct === comparison leaks information via branch timing when lengths differ or
 * when the CPU short-circuits on first mismatch. This function:
 *   1. Hashes both sides with HMAC-SHA-256 to normalise length.
 *   2. Compares the fixed-length digests with crypto.timingSafeEqual.
 *
 * Result: ~constant-time regardless of where (or whether) strings differ.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

// Internal discriminator — keeps the HMAC domain-separated from any user data.
const DOMAIN = 'rpg-companion:safe-compare:v1';

export function safeCompare(a: string, b: string): boolean {
  const ha = createHmac('sha256', DOMAIN).update(a).digest();
  const hb = createHmac('sha256', DOMAIN).update(b).digest();
  return timingSafeEqual(ha, hb);
}
