export interface ThrottlerOptions {
  primary: string;
  fast: string;
  upgradeBackAfterMs: number;
}

/**
 * Tracks which Groq model tier the Consumer should use.
 * Downgrades from primary (70B) to fast (8B) on 429.
 * Upgrades back to primary after a clean window with no 429s.
 */
export class ModelThrottler {
  private tier: 'primary' | 'fast' = 'primary';
  private lastRateLimitAt: number | null = null;

  constructor(private readonly opts: ThrottlerOptions) {}

  currentModel(): string {
    if (this.tier === 'primary') return this.opts.primary;
    if (this.lastRateLimitAt !== null) {
      const elapsed = Date.now() - this.lastRateLimitAt;
      if (elapsed > this.opts.upgradeBackAfterMs) {
        this.tier = 'primary';
        this.lastRateLimitAt = null;
        return this.opts.primary;
      }
    }
    return this.opts.fast;
  }

  reportRateLimit(): void {
    this.tier = 'fast';
    this.lastRateLimitAt = Date.now();
  }

  reportSuccess(): void {
    // Intentionally no-op. currentModel() handles upgrade-back timing
    // based on lastRateLimitAt delta so success pings do not reset the timer.
  }
}
