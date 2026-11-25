export interface CircuitBreakerOptions {
  failureThreshold?: number; // default: 3
  failureWindowMs?: number; // default: 60,000ms (60s)
  cooldownPeriodMs?: number; // default: 300,000ms (5 min)
}

export class CircuitBreaker {
  private failureTimestamps = new Map<string, number[]>();
  private cooldownUntil = new Map<string, number>();

  private threshold: number;
  private windowMs: number;
  private cooldownMs: number;

  constructor(options?: CircuitBreakerOptions) {
    this.threshold = options?.failureThreshold ?? 3;
    this.windowMs = options?.failureWindowMs ?? 60_000;
    this.cooldownMs = options?.cooldownPeriodMs ?? 300_000;
  }

  isAvailable(providerId: string, now = Date.now()): boolean {
    const cooldownTime = this.cooldownUntil.get(providerId);
    if (cooldownTime && now < cooldownTime) {
      return false;
    }
    return true;
  }

  getCooldownRemainingMs(providerId: string, now = Date.now()): number {
    const cooldownTime = this.cooldownUntil.get(providerId);
    if (!cooldownTime || now >= cooldownTime) return 0;
    return cooldownTime - now;
  }

  recordSuccess(providerId: string): void {
    // Clear failure window on successful completion
    this.failureTimestamps.delete(providerId);
    this.cooldownUntil.delete(providerId);
  }

  reset(): void {
    this.failureTimestamps.clear();
    this.cooldownUntil.clear();
  }

  recordFailure(providerId: string, error: unknown, now = Date.now()): void {
    // 1. Check for Rate Limit 429 with Retry-After
    const retryAfterSeconds = this.extractRetryAfter(error);
    if (retryAfterSeconds !== null) {
      this.cooldownUntil.set(providerId, now + retryAfterSeconds * 1000);
      return;
    }

    // 2. Sliding window failure counter
    const history = this.failureTimestamps.get(providerId) || [];
    const recent = history.filter((ts) => now - ts < this.windowMs);
    recent.push(now);
    this.failureTimestamps.set(providerId, recent);

    // After 3 failures within 60s, trip circuit breaker for 5 minutes
    if (recent.length >= this.threshold) {
      this.cooldownUntil.set(providerId, now + this.cooldownMs);
    }
  }

  private extractRetryAfter(error: unknown): number | null {
    if (!error) return null;

    if (typeof error === 'object') {
      const errObj = error as Record<string, unknown>;

      // Explicit retryAfter property
      if (typeof errObj.retryAfter === 'number') {
        return errObj.retryAfter;
      }

      // Check headers if present (e.g. Response or Fetch error)
      const headers = errObj.headers;
      if (headers && typeof headers === 'object' && 'get' in headers && typeof (headers as { get: (name: string) => string | null }).get === 'function') {
        const headerVal = (headers as { get: (name: string) => string | null }).get('retry-after');
        if (headerVal) {
          const parsed = parseInt(headerVal, 10);
          if (!isNaN(parsed) && parsed > 0) return parsed;
        }
      }

      // Check message for HTTP 429
      const msg = typeof errObj.message === 'string' ? errObj.message : '';
      const status = typeof errObj.status === 'number' ? errObj.status : null;

      if (status === 429 || msg.includes('429') || msg.toLowerCase().includes('rate limit')) {
        // Try regex match for "retry after X seconds" or similar
        const match = msg.match(/retry(?:-|\s+)after\s+(\d+)/i) || msg.match(/try again in (\d+)s/i);
        if (match && match[1]) {
          const parsed = parseInt(match[1], 10);
          if (!isNaN(parsed) && parsed > 0) return parsed;
        }
        // If HTTP 429 without explicit header, minimum safe backoff 60s
        return 60;
      }
    }

    return null;
  }
}
