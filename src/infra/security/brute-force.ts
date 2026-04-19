/**
 * In-memory brute-force guard with sliding-window counters per IP.
 *
 * Complements @fastify/rate-limit (which throttles request volume).
 * This guard specifically locks out an IP after N *failed auth* attempts,
 * regardless of total request count — a standard defence against slow-and-low attacks.
 *
 * Tradeoffs accepted:
 *   - In-memory only (resets on restart). Acceptable for a single-process server.
 *   - IPv4/IPv6 aware (uses req.ip which Fastify normalises).
 *   - No persistent storage needed — keys expire automatically via maxAge eviction.
 */

interface Entry {
  count: number;
  firstFailAt: number;
  lockedUntil: number;
}

export class BruteForceGuard {
  private readonly map = new Map<string, Entry>();

  constructor(
    private readonly maxAttempts: number = 5,
    private readonly windowMs: number = 15 * 60 * 1000, // 15 min sliding window
    private readonly lockoutMs: number = 30 * 60 * 1000, // 30 min lockout
  ) {}

  /** Returns true when the IP is allowed to attempt auth. */
  isAllowed(ip: string): boolean {
    this.evict();
    const entry = this.map.get(ip);
    if (!entry) return true;
    if (Date.now() < entry.lockedUntil) return false;
    // Lockout expired — allow but keep the entry (reset on next recordSuccess)
    return true;
  }

  /** Call on every failed auth attempt. */
  recordFailure(ip: string): void {
    const now = Date.now();
    const entry = this.map.get(ip);

    if (!entry || now - entry.firstFailAt > this.windowMs) {
      // New window
      this.map.set(ip, { count: 1, firstFailAt: now, lockedUntil: 0 });
      return;
    }

    entry.count += 1;
    if (entry.count >= this.maxAttempts) {
      entry.lockedUntil = now + this.lockoutMs;
    }
  }

  /** Call on successful auth — resets the counter for this IP. */
  recordSuccess(ip: string): void {
    this.map.delete(ip);
  }

  /** Remaining lockout in seconds (0 if not locked). */
  lockoutRemaining(ip: string): number {
    const entry = this.map.get(ip);
    if (!entry) return 0;
    const remaining = entry.lockedUntil - Date.now();
    return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
  }

  /** Purge expired entries to prevent unbounded memory growth. */
  private evict(): void {
    if (this.map.size < 1000) return; // only evict when the map grows large
    const now = Date.now();
    for (const [ip, entry] of this.map) {
      if (now - entry.firstFailAt > this.windowMs && entry.lockedUntil < now) {
        this.map.delete(ip);
      }
    }
  }
}

// Shared instances — one per auth surface.
export const gmBruteForce = new BruteForceGuard(5, 15 * 60_000, 30 * 60_000);
export const libraryBruteForce = new BruteForceGuard(8, 15 * 60_000, 30 * 60_000);
