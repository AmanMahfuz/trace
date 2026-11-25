import { Tier } from '../types';

export interface LogAiCallParams {
  userId?: string;
  task: string;
  tier: Tier;
  provider: string;
  model: string;
  latencyMs: number;
  fallbackDepth: number;
  ok: boolean;
  errorClass?: string;
  promptVersion: string;
  tokensIn?: number;
  tokensOut?: number;
}

export interface BudgetCounters {
  day: string; // YYYY-MM-DD
  provider: string;
  calls: number;
  tokens: number;
  failures: number;
}

export interface CacheEntry {
  output: unknown;
  promptVersion: string;
}

export interface Store {
  // llm_cache
  getCache(key: string): Promise<CacheEntry | null>;
  setCache(key: string, output: unknown, promptVersion: string): Promise<void>;

  // budget_counters
  getBudgetCounters(day: string, provider: string): Promise<BudgetCounters | null>;
  incrementBudgetCounters(
    day: string,
    provider: string,
    calls: number,
    tokens: number,
    failures: number
  ): Promise<void>;

  // ai_logs (no personal data recorded)
  logAiCall(entry: LogAiCallParams): Promise<void>;
}

export class InMemoryStore implements Store {
  private cache = new Map<string, CacheEntry>();
  private counters = new Map<string, BudgetCounters>();
  public logs: LogAiCallParams[] = [];

  async getCache(key: string): Promise<CacheEntry | null> {
    return this.cache.get(key) || null;
  }

  async setCache(key: string, output: unknown, promptVersion: string): Promise<void> {
    this.cache.set(key, { output, promptVersion });
  }

  async getBudgetCounters(day: string, provider: string): Promise<BudgetCounters | null> {
    return this.counters.get(`${day}:${provider}`) || null;
  }

  async incrementBudgetCounters(
    day: string,
    provider: string,
    calls: number,
    tokens: number,
    failures: number
  ): Promise<void> {
    const key = `${day}:${provider}`;
    const current = this.counters.get(key) || { day, provider, calls: 0, tokens: 0, failures: 0 };
    current.calls += calls;
    current.tokens += tokens;
    current.failures += failures;
    this.counters.set(key, current);
  }

  async logAiCall(entry: LogAiCallParams): Promise<void> {
    this.logs.push(entry);
  }
}
