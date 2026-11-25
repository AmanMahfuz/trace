import { Store } from '../store';
import { ProviderConfig } from '../types';

export class BudgetGuard {
  constructor(private store: Store) {}

  getTodayString(now = new Date()): string {
    return now.toISOString().slice(0, 10);
  }

  async isWithinBudget(provider: ProviderConfig, now = new Date()): Promise<boolean> {
    if (!provider.dailyQuota) return true;

    const today = this.getTodayString(now);
    const counters = await this.store.getBudgetCounters(today, provider.id);
    if (!counters) return true;

    // Shift traffic away when calls reach 80% of quota
    if (provider.dailyQuota.calls) {
      const callLimit = provider.dailyQuota.calls * 0.8;
      if (counters.calls >= callLimit) {
        return false;
      }
    }

    if (provider.dailyQuota.tokens) {
      const tokenLimit = provider.dailyQuota.tokens * 0.8;
      if (counters.tokens >= tokenLimit) {
        return false;
      }
    }

    return true;
  }

  async recordUsage(
    providerId: string,
    calls: number,
    tokens: number,
    failures: number,
    now = new Date()
  ): Promise<void> {
    const today = this.getTodayString(now);
    await this.store.incrementBudgetCounters(today, providerId, calls, tokens, failures);
  }
}
