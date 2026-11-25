import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as aiModule from 'ai';
import { generateJSON, generateText, AIUnavailableError, router } from '../lib/ai/provider';
import { z } from 'zod';

// Mock Vercel AI SDK methods
vi.mock('ai', () => ({
  generateObject: vi.fn(),
  generateText: vi.fn(),
}));

// Mock Supabase admin client for ai_logs
vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn(() => ({
      insert: vi.fn().mockResolvedValue({ error: null }),
    })),
  })),
}));

describe('AI Provider Resilience & Fallback Engine', () => {
  const mockGenerateObject = vi.mocked(aiModule.generateObject);
  const mockGenerateText = vi.mocked(aiModule.generateText);

  beforeEach(() => {
    vi.clearAllMocks();
    router.getCircuitBreaker().reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('successfully returns on primary model success without triggering fallback', async () => {
    mockGenerateObject.mockResolvedValueOnce({
      object: { band: 'Strong', score: 85 },
    } as unknown as Awaited<ReturnType<typeof aiModule.generateObject>>);

    const schema = z.object({ band: z.string(), score: z.number() });
    const result = await generateJSON({
      tier: 'fast',
      schema,
      prompt: 'Test prompt',
      task: 'qa_test_primary',
    });

    expect(result).toEqual({ band: 'Strong', score: 85 });
    expect(mockGenerateObject).toHaveBeenCalledTimes(1);
  });

  it('automatically triggers fallback model when primary model encounters 429 rate limit or 5xx error', async () => {
    // 1st call fails (Simulated Google 429 quota exhaustion)
    mockGenerateObject.mockRejectedValueOnce(new Error('429 Rate limit exceeded'));
    // 2nd call succeeds (Anthropic Fallback model)
    mockGenerateObject.mockResolvedValueOnce({
      object: { band: 'Fair', score: 55 },
    } as unknown as Awaited<ReturnType<typeof aiModule.generateObject>>);

    const schema = z.object({ band: z.string(), score: z.number() });
    const result = await generateJSON({
      tier: 'mid',
      schema,
      prompt: 'Evaluate candidate odds',
      task: 'qa_test_fallback',
    });

    expect(result).toEqual({ band: 'Fair', score: 55 });
    // Verify it attempted primary, failed, and retried once on fallback
    expect(mockGenerateObject).toHaveBeenCalledTimes(2);
  });

  it('raises typed AIUnavailableError when both primary and fallback fail (Double Failure)', async () => {
    mockGenerateObject.mockRejectedValueOnce(new Error('503 Service Unavailable'));
    mockGenerateObject.mockRejectedValueOnce(new Error('Overloaded'));

    const schema = z.object({ band: z.string() });

    await expect(
      generateJSON({
        tier: 'strong',
        schema,
        prompt: 'Generate autopsy',
        task: 'qa_test_double_fail',
      })
    ).rejects.toThrow(AIUnavailableError);

    expect(mockGenerateObject).toHaveBeenCalledTimes(2);
  });

  it('successfully falls back for text generation in interview rounds', async () => {
    mockGenerateText.mockRejectedValueOnce(new Error('500 Internal Error'));
    mockGenerateText.mockResolvedValueOnce({
      text: 'Tell me about how you handled database deadlocks in your project.',
    } as unknown as Awaited<ReturnType<typeof aiModule.generateText>>);

    const result = await generateText({
      tier: 'fast',
      messages: [{ role: 'user', content: 'Candidate response' }],
      task: 'qa_interview_fallback',
    });

    expect(result).toBe('Tell me about how you handled database deadlocks in your project.');
    expect(mockGenerateText).toHaveBeenCalledTimes(2);
  });
});
