import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { ModelRouter } from '../router';
import { InMemoryStore } from '../store';
import { ProviderConfig, CapacityError, LLMRequest } from '../types';

describe('ModelRouter (Milestone E1 Acceptance Tests)', () => {
  it('forced 429 on A and timeout on B still succeeds through C', async () => {
    const store = new InMemoryStore();

    const providerA: ProviderConfig = {
      id: 'provider-a',
      name: 'Provider A',
      tiers: { fast: 'mod-a', mid: 'mod-a', strong: 'mod-a' },
      json: true,
      pdf: false,
      noTraining: true,
      maxContext: 32000,
      paid: false,
      call: vi.fn().mockRejectedValue(new Error('HTTP 429: Rate limit exceeded, retry-after 30')),
    };

    const providerB: ProviderConfig = {
      id: 'provider-b',
      name: 'Provider B',
      tiers: { fast: 'mod-b', mid: 'mod-b', strong: 'mod-b' },
      json: true,
      pdf: false,
      noTraining: true,
      maxContext: 32000,
      paid: false,
      call: vi.fn().mockRejectedValue(new Error('Request timed out after 5000ms')),
    };

    const providerC: ProviderConfig = {
      id: 'provider-c',
      name: 'Provider C',
      tiers: { fast: 'mod-c', mid: 'mod-c', strong: 'mod-c' },
      json: true,
      pdf: false,
      noTraining: true,
      maxContext: 32000,
      paid: false,
      call: vi.fn().mockResolvedValue({
        rawText: JSON.stringify({ score: 85, summary: 'Passed through provider C' }),
        tokensIn: 50,
        tokensOut: 20,
      }),
    };

    const router = new ModelRouter({
      store,
      providers: [providerA, providerB, providerC],
    });

    const schema = z.object({
      score: z.number(),
      summary: z.string(),
    });

    const req: LLMRequest<z.infer<typeof schema>> = {
      tier: 'fast',
      task: 'score_odds',
      prompt: 'Evaluate odds',
      schema,
      sensitivity: 'personal',
      promptVersion: 'score_odds@1',
    };

    const result = await router.json(req);

    expect(result.data.score).toBe(85);
    expect(result.data.summary).toBe('Passed through provider C');
    expect(result.meta.provider).toBe('provider-c');
    expect(result.meta.fallbackDepth).toBe(2);
    expect(result.meta.cached).toBe(false);

    // Check store logs
    expect(store.logs.length).toBe(3);
    expect(store.logs[0].provider).toBe('provider-a');
    expect(store.logs[0].ok).toBe(false);
    expect(store.logs[1].provider).toBe('provider-b');
    expect(store.logs[1].ok).toBe(false);
    expect(store.logs[2].provider).toBe('provider-c');
    expect(store.logs[2].ok).toBe(true);

    // Verify no personal text logged
    for (const log of store.logs) {
      const record = log as unknown as Record<string, unknown>;
      expect(record.prompt).toBeUndefined();
      expect(record.resume).toBeUndefined();
    }
  });

  it('all down throws CapacityError', async () => {
    const store = new InMemoryStore();

    const providerA: ProviderConfig = {
      id: 'provider-a',
      name: 'Provider A',
      tiers: { fast: 'mod-a', mid: 'mod-a', strong: 'mod-a' },
      json: true,
      pdf: false,
      noTraining: true,
      maxContext: 32000,
      paid: false,
      call: vi.fn().mockRejectedValue(new Error('500 Internal Error')),
    };

    const router = new ModelRouter({
      store,
      providers: [providerA],
    });

    const schema = z.object({ val: z.string() });

    await expect(
      router.json({
        tier: 'fast',
        task: 'test',
        prompt: 'test prompt',
        schema,
        sensitivity: 'personal',
        promptVersion: 'test@1',
      })
    ).rejects.toThrow(CapacityError);
  });

  it('a personal request never reaches a provider with noTraining false', async () => {
    const store = new InMemoryStore();

    const freeTrainingProvider: ProviderConfig = {
      id: 'training-model',
      name: 'Training Model',
      tiers: { fast: 'mod-training', mid: 'mod-training', strong: 'mod-training' },
      json: true,
      pdf: false,
      noTraining: false, // Training allowed
      maxContext: 32000,
      paid: false,
      call: vi.fn().mockResolvedValue({
        rawText: JSON.stringify({ allowed: false }),
      }),
    };

    const privateProvider: ProviderConfig = {
      id: 'private-model',
      name: 'Private Model',
      tiers: { fast: 'mod-private', mid: 'mod-private', strong: 'mod-private' },
      json: true,
      pdf: false,
      noTraining: true, // No training
      maxContext: 32000,
      paid: false,
      call: vi.fn().mockResolvedValue({
        rawText: JSON.stringify({ allowed: true }),
      }),
    };

    const router = new ModelRouter({
      store,
      providers: [freeTrainingProvider, privateProvider],
    });

    const schema = z.object({ allowed: z.boolean() });

    const result = await router.json({
      tier: 'fast',
      task: 'ingest_resume',
      prompt: 'Confidential Resume Details',
      schema,
      sensitivity: 'personal',
      promptVersion: 'ingest@1',
    });

    expect(result.data.allowed).toBe(true);
    expect(result.meta.provider).toBe('private-model');
    // freeTrainingProvider must never have been called!
    expect(freeTrainingProvider.call).not.toHaveBeenCalled();
    expect(privateProvider.call).toHaveBeenCalledTimes(1);
  });

  it('cache hit skips the network', async () => {
    const store = new InMemoryStore();

    const providerMock = vi.fn().mockResolvedValue({
      rawText: JSON.stringify({ calculated: 42 }),
      tokensIn: 10,
      tokensOut: 5,
    });

    const provider: ProviderConfig = {
      id: 'calc-provider',
      name: 'Calc Provider',
      tiers: { fast: 'mod', mid: 'mod', strong: 'mod' },
      json: true,
      pdf: false,
      noTraining: true,
      maxContext: 32000,
      paid: false,
      call: providerMock,
    };

    const router = new ModelRouter({
      store,
      providers: [provider],
    });

    const schema = z.object({ calculated: z.number() });

    const req: LLMRequest<z.infer<typeof schema>> = {
      tier: 'fast',
      task: 'match_evidence',
      prompt: 'Check evidence for skill X',
      schema,
      sensitivity: 'public',
      promptVersion: 'match@1',
    };

    // First call: calls provider, populates cache
    const firstCall = await router.json(req);
    expect(firstCall.data.calculated).toBe(42);
    expect(firstCall.meta.cached).toBe(false);
    expect(providerMock).toHaveBeenCalledTimes(1);

    // Second identical call: hits cache, network skipped!
    const secondCall = await router.json(req);
    expect(secondCall.data.calculated).toBe(42);
    expect(secondCall.meta.cached).toBe(true);
    expect(secondCall.meta.provider).toBe('cache');
    expect(providerMock).toHaveBeenCalledTimes(1); // Still 1!
  });

  it('performs one repair attempt on schema validation failure', async () => {
    const store = new InMemoryStore();

    // Call 1 returns malformed output, Call 2 returns repaired valid output
    const providerMock = vi
      .fn()
      .mockResolvedValueOnce({
        rawText: '```json\n{"wrongKey": 123}\n```',
      })
      .mockResolvedValueOnce({
        rawText: '```json\n{"correctKey": "repaired-value"}\n```',
      });

    const provider: ProviderConfig = {
      id: 'repair-provider',
      name: 'Repair Provider',
      tiers: { fast: 'mod', mid: 'mod', strong: 'mod' },
      json: true,
      pdf: false,
      noTraining: true,
      maxContext: 32000,
      paid: false,
      call: providerMock,
    };

    const router = new ModelRouter({
      store,
      providers: [provider],
    });

    const schema = z.object({ correctKey: z.string() });

    const result = await router.json({
      tier: 'fast',
      task: 'repair_test',
      prompt: 'Test prompt',
      schema,
      sensitivity: 'public',
      promptVersion: 'repair@1',
    });

    expect(result.data.correctKey).toBe('repaired-value');
    expect(providerMock).toHaveBeenCalledTimes(2);
  });
});
