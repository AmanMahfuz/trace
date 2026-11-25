import { z } from 'zod';
import {
  Router,
  LLMRequest,
  CallMeta,
  ProviderConfig,
  Tier,
  CapacityError,
  ProviderCallResponse,
} from '../types';
import { Store } from '../store';
import { CircuitBreaker } from './circuit-breaker';
import { BudgetGuard } from './budget';
import { RouterCache } from './cache';
import { createDefaultRegistry } from './registry';

export interface ModelRouterOptions {
  store: Store;
  providers?: ProviderConfig[];
  circuitBreaker?: CircuitBreaker;
  budgetGuard?: BudgetGuard;
  cache?: RouterCache;
}

export class ModelRouter implements Router {
  private store: Store;
  private providers: ProviderConfig[];
  private circuitBreaker: CircuitBreaker;
  private budgetGuard: BudgetGuard;
  private cache: RouterCache;

  constructor(options: ModelRouterOptions) {
    this.store = options.store;
    this.providers = options.providers || createDefaultRegistry();
    this.circuitBreaker = options.circuitBreaker || new CircuitBreaker();
    this.budgetGuard = options.budgetGuard || new BudgetGuard(options.store);
    this.cache = options.cache || new RouterCache(options.store);
  }

  getProviders(): ProviderConfig[] {
    return this.providers;
  }

  private cleanJsonString(str: string): string {
    const trimmed = str.trim();
    const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    return match ? match[1].trim() : trimmed;
  }

  private async selectCandidateProviders(
    tier: Tier,
    sensitivity: 'personal' | 'public'
  ): Promise<ProviderConfig[]> {
    const candidates: ProviderConfig[] = [];

    for (const p of this.providers) {
      // 1. Sensitivity rule: personal data ONLY to noTraining providers
      if (sensitivity === 'personal' && !p.noTraining) {
        continue;
      }

      // 2. Circuit breaker check
      if (!this.circuitBreaker.isAvailable(p.id)) {
        continue;
      }

      // 3. Budget guard check (within 80% quota)
      const withinBudget = await this.budgetGuard.isWithinBudget(p);
      if (!withinBudget) {
        continue;
      }

      candidates.push(p);
    }

    // Sort by: free first (paid === false), then order in registry
    candidates.sort((a, b) => {
      const aPaid = Boolean(a.paid);
      const bPaid = Boolean(b.paid);
      if (aPaid === bPaid) return 0;
      return aPaid ? 1 : -1;
    });

    return candidates;
  }

  async json<T>(req: LLMRequest<T>): Promise<{ data: T; meta: CallMeta }> {
    const start = Date.now();
    const effectiveTemp = req.temperature ?? 0; // Default temperature 0 for scoring/extraction

    // 1. Cache lookup
    const cacheKey = req.cacheKey || (await this.cache.generateKey(req.task, req.promptVersion, req.prompt));
    const cachedData = await this.cache.get<T>(cacheKey, req.promptVersion);
    if (cachedData !== null) {
      const parsed = req.schema.safeParse(cachedData);
      if (parsed.success) {
        return {
          data: parsed.data,
          meta: {
            provider: 'cache',
            model: 'cached',
            latencyMs: Date.now() - start,
            fallbackDepth: 0,
            cached: true,
          },
        };
      }
    }

    // 2. Select eligible providers
    const candidates = await this.selectCandidateProviders(req.tier, req.sensitivity);
    if (candidates.length === 0) {
      throw new CapacityError();
    }

    let fallbackDepth = 0;
    let lastError: unknown = null;

    for (const provider of candidates) {
      const model = provider.tiers[req.tier];
      const attemptStart = Date.now();

      try {
        if (!provider.call) {
          throw new Error(`Provider ${provider.id} has no execution handler configured.`);
        }

        // Initial model call
        const response: ProviderCallResponse = await provider.call({
          tier: req.tier,
          model,
          system: req.system,
          prompt: req.prompt,
          jsonMode: provider.json,
          strictSchema: provider.strictSchema ?? false,
          schema: req.schema,
          temperature: effectiveTemp,
        });

        // Parse JSON
        let parsedResult: { success: true; data: T } | { success: false; error: z.ZodError };
        try {
          const rawParsed = JSON.parse(this.cleanJsonString(response.rawText));
          parsedResult = req.schema.safeParse(rawParsed) as { success: true; data: T } | { success: false; error: z.ZodError };
        } catch (parseErr) {
          parsedResult = {
            success: false,
            error: new z.ZodError([
              {
                code: 'custom',
                path: [],
                message: parseErr instanceof Error ? parseErr.message : 'Invalid JSON string',
              },
            ]),
          };
        }

        // If schema validation failed, execute exactly ONE repair attempt
        if (!parsedResult.success) {
          try {
            const repairResponse = await provider.call({
              tier: req.tier,
              model,
              system: 'You are a JSON schema repair assistant. Respond with ONLY valid JSON adhering to the specified schema.',
              prompt: `The following output failed validation:\n\nERROR:\n${parsedResult.error.message}\n\nORIGINAL OUTPUT:\n${response.rawText}\n\nProvide the corrected JSON object only:`,
              jsonMode: true,
              temperature: 0,
            });

            const rawRepaired = JSON.parse(this.cleanJsonString(repairResponse.rawText));
            parsedResult = req.schema.safeParse(rawRepaired) as { success: true; data: T } | { success: false; error: z.ZodError };
          } catch {
            // Repair failed, fall through to fallback
          }
        }

        if (!parsedResult.success) {
          throw new Error(`Validation failed for provider ${provider.id}: ${parsedResult.error.message}`);
        }

        // Success! Record metrics & breaker success
        this.circuitBreaker.recordSuccess(provider.id);
        const tokensIn = response.tokensIn || 0;
        const tokensOut = response.tokensOut || 0;
        await this.budgetGuard.recordUsage(provider.id, 1, tokensIn + tokensOut, 0);

        // Save to cache
        await this.cache.set(cacheKey, parsedResult.data, req.promptVersion);

        // Log AI call (no personal text!)
        await this.store.logAiCall({
          userId: req.userId,
          task: req.task,
          tier: req.tier,
          provider: provider.id,
          model,
          latencyMs: Date.now() - attemptStart,
          fallbackDepth,
          ok: true,
          promptVersion: req.promptVersion,
          tokensIn,
          tokensOut,
        });

        return {
          data: parsedResult.data,
          meta: {
            provider: provider.id,
            model,
            latencyMs: Date.now() - start,
            fallbackDepth,
            cached: false,
            tokensIn,
            tokensOut,
          },
        };
      } catch (err: unknown) {
        lastError = err;
        this.circuitBreaker.recordFailure(provider.id, err);
        await this.budgetGuard.recordUsage(provider.id, 1, 0, 1);

        const errorClass = err instanceof Error ? err.name : 'UnknownError';
        await this.store.logAiCall({
          userId: req.userId,
          task: req.task,
          tier: req.tier,
          provider: provider.id,
          model,
          latencyMs: Date.now() - attemptStart,
          fallbackDepth,
          ok: false,
          errorClass,
          promptVersion: req.promptVersion,
        });

        fallbackDepth++;
      }
    }

    // All candidate providers failed
    throw new CapacityError(
      lastError instanceof Error ? lastError.message : 'High demand, all providers exhausted'
    );
  }

  getCircuitBreaker(): CircuitBreaker {
    return this.circuitBreaker;
  }

  async text(req: Omit<LLMRequest<string>, 'schema'>): Promise<{ text: string; meta: CallMeta }> {
    const start = Date.now();
    const effectiveTemp = req.temperature ?? 0;

    // 1. Cache lookup
    const cacheKey = req.cacheKey || (await this.cache.generateKey(req.task, req.promptVersion, req.prompt));
    const cachedText = await this.cache.get<string>(cacheKey, req.promptVersion);
    if (cachedText !== null && typeof cachedText === 'string') {
      return {
        text: cachedText,
        meta: {
          provider: 'cache',
          model: 'cached',
          latencyMs: Date.now() - start,
          fallbackDepth: 0,
          cached: true,
        },
      };
    }

    // 2. Select eligible providers
    const candidates = await this.selectCandidateProviders(req.tier, req.sensitivity);
    if (candidates.length === 0) {
      throw new CapacityError();
    }

    let fallbackDepth = 0;
    let lastError: unknown = null;

    for (const provider of candidates) {
      const model = provider.tiers[req.tier];
      const attemptStart = Date.now();

      try {
        if (!provider.call) {
          throw new Error(`Provider ${provider.id} has no execution handler configured.`);
        }

        const response: ProviderCallResponse = await provider.call({
          tier: req.tier,
          model,
          system: req.system,
          prompt: req.prompt,
          jsonMode: false,
          temperature: effectiveTemp,
        });

        this.circuitBreaker.recordSuccess(provider.id);
        const tokensIn = response.tokensIn || 0;
        const tokensOut = response.tokensOut || 0;
        await this.budgetGuard.recordUsage(provider.id, 1, tokensIn + tokensOut, 0);

        await this.cache.set(cacheKey, response.rawText, req.promptVersion);

        await this.store.logAiCall({
          userId: req.userId,
          task: req.task,
          tier: req.tier,
          provider: provider.id,
          model,
          latencyMs: Date.now() - attemptStart,
          fallbackDepth,
          ok: true,
          promptVersion: req.promptVersion,
          tokensIn,
          tokensOut,
        });

        return {
          text: response.rawText,
          meta: {
            provider: provider.id,
            model,
            latencyMs: Date.now() - start,
            fallbackDepth,
            cached: false,
            tokensIn,
            tokensOut,
          },
        };
      } catch (err: unknown) {
        lastError = err;
        this.circuitBreaker.recordFailure(provider.id, err);
        await this.budgetGuard.recordUsage(provider.id, 1, 0, 1);

        const errorClass = err instanceof Error ? err.name : 'UnknownError';
        await this.store.logAiCall({
          userId: req.userId,
          task: req.task,
          tier: req.tier,
          provider: provider.id,
          model,
          latencyMs: Date.now() - attemptStart,
          fallbackDepth,
          ok: false,
          errorClass,
          promptVersion: req.promptVersion,
        });

        fallbackDepth++;
      }
    }

    throw new CapacityError(
      lastError instanceof Error ? lastError.message : 'High demand, all providers exhausted'
    );
  }
}
