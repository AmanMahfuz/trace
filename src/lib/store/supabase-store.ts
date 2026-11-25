import { Store, CacheEntry, BudgetCounters, LogAiCallParams } from '@trace/engine';
import { createAdminClient } from '@/lib/supabase/server';

export class SupabaseStore implements Store {
  // In-memory fallback if Supabase DB is offline or in local test environment
  private memoryCache = new Map<string, CacheEntry>();
  private memoryCounters = new Map<string, BudgetCounters>();

  async getCache(key: string): Promise<CacheEntry | null> {
    try {
      const supabase = createAdminClient();
      const { data, error } = await supabase
        .from('llm_cache')
        .select('output, prompt_version')
        .eq('key', key)
        .single();

      if (!error && data) {
        return {
          output: data.output,
          promptVersion: data.prompt_version,
        };
      }
    } catch {
      // Fall through to memoryCache
    }
    return this.memoryCache.get(key) || null;
  }

  async setCache(key: string, output: unknown, promptVersion: string): Promise<void> {
    this.memoryCache.set(key, { output, promptVersion });
    try {
      const supabase = createAdminClient();
      await supabase.from('llm_cache').upsert({
        key,
        output,
        prompt_version: promptVersion,
      });
    } catch {
      // Silent catch for resilience
    }
  }

  async getBudgetCounters(day: string, provider: string): Promise<BudgetCounters | null> {
    try {
      const supabase = createAdminClient();
      const { data, error } = await supabase
        .from('budget_counters')
        .select('day, provider, calls, tokens, failures')
        .eq('day', day)
        .eq('provider', provider)
        .single();

      if (!error && data) {
        return data as BudgetCounters;
      }
    } catch {
      // Fall through
    }
    return this.memoryCounters.get(`${day}:${provider}`) || null;
  }

  async incrementBudgetCounters(
    day: string,
    provider: string,
    calls: number,
    tokens: number,
    failures: number
  ): Promise<void> {
    const key = `${day}:${provider}`;
    const current = this.memoryCounters.get(key) || { day, provider, calls: 0, tokens: 0, failures: 0 };
    current.calls += calls;
    current.tokens += tokens;
    current.failures += failures;
    this.memoryCounters.set(key, current);

    try {
      const supabase = createAdminClient();
      // Try to upsert into budget_counters
      await supabase.from('budget_counters').upsert({
        day,
        provider,
        calls: current.calls,
        tokens: current.tokens,
        failures: current.failures,
      });
    } catch {
      // Silent catch
    }
  }

  async logAiCall(entry: LogAiCallParams): Promise<void> {
    try {
      const supabase = createAdminClient();
      await supabase.from('ai_logs').insert({
        user_id: entry.userId || null,
        task: entry.task,
        tier: entry.tier,
        model: entry.model,
        latency_ms: entry.latencyMs,
        used_fallback: entry.fallbackDepth > 0,
        ok: entry.ok,
        error: entry.errorClass || null,
        provider: entry.provider,
        prompt_version: entry.promptVersion,
        tokens_in: entry.tokensIn || 0,
        tokens_out: entry.tokensOut || 0,
      });
    } catch (err) {
      console.error('Failed to write to ai_logs table:', err);
    }
  }
}
