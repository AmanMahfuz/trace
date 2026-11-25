import { ProviderConfig } from '../types';

export function createDefaultRegistry(overrides?: Partial<ProviderConfig>[]): ProviderConfig[] {
  const defaultProviders: ProviderConfig[] = [
    {
      id: 'groq',
      name: 'Groq Cloud',
      tiers: {
        fast: process.env.GROQ_MODEL_FAST || 'llama-3.3-70b-versatile',
        mid: process.env.GROQ_MODEL_MID || 'llama-3.3-70b-versatile',
        strong: process.env.GROQ_MODEL_STRONG || 'llama-3.3-70b-versatile',
      },
      json: true,
      strictSchema: true,
      pdf: false,
      noTraining: true,
      maxContext: 128_000,
      paid: false,
      dailyQuota: {
        calls: 14400,
        tokens: 500_000,
      },
    },
    {
      id: 'workers',
      name: 'Cloudflare Workers AI',
      tiers: {
        fast: process.env.WORKERS_AI_MODEL_FAST || '@cf/meta/llama-3.3-70b-instruct',
        mid: process.env.WORKERS_AI_MODEL_MID || '@cf/meta/llama-3.3-70b-instruct',
        strong: process.env.WORKERS_AI_MODEL_STRONG || '@cf/meta/llama-3.3-70b-instruct',
      },
      json: true,
      strictSchema: false,
      pdf: false,
      noTraining: true,
      maxContext: 64_000,
      paid: false,
      dailyQuota: {
        calls: 10000,
        tokens: 250_000,
      },
    },
    {
      id: 'gemini',
      name: 'Google Gemini',
      tiers: {
        fast: process.env.AI_MODEL_FAST || 'gemini-2.5-flash',
        mid: process.env.AI_MODEL_MID || 'gemini-2.5-flash',
        strong: process.env.AI_MODEL_STRONG || 'gemini-2.5-flash',
      },
      json: true,
      strictSchema: true,
      pdf: true,
      noTraining: false, // Free tier may use data for training unless enterprise
      maxContext: 1_000_000,
      paid: false,
      dailyQuota: {
        calls: 1500,
        tokens: 1_000_000,
      },
    },
    {
      id: 'openrouter',
      name: 'OpenRouter Free',
      tiers: {
        fast: process.env.OPENROUTER_MODEL_FAST || 'meta-llama/llama-3.3-70b-instruct:free',
        mid: process.env.OPENROUTER_MODEL_MID || 'meta-llama/llama-3.3-70b-instruct:free',
        strong: process.env.OPENROUTER_MODEL_STRONG || 'meta-llama/llama-3.3-70b-instruct:free',
      },
      json: true,
      strictSchema: false,
      pdf: false,
      noTraining: false,
      maxContext: 64_000,
      paid: false,
      dailyQuota: {
        calls: 1000,
        tokens: 200_000,
      },
    },
    {
      id: 'claude',
      name: 'Anthropic Claude',
      tiers: {
        fast: process.env.CLAUDE_MODEL_FAST || 'claude-3-5-haiku-latest',
        mid: process.env.CLAUDE_MODEL_MID || 'claude-3-5-haiku-latest',
        strong: process.env.CLAUDE_MODEL_STRONG || 'claude-3-5-sonnet-latest',
      },
      json: true,
      strictSchema: true,
      pdf: true,
      noTraining: true,
      maxContext: 200_000,
      paid: true, // Paid backup tier
    },
  ];

  if (!overrides) return defaultProviders;

  return defaultProviders.map((def) => {
    const match = overrides.find((o) => o.id === def.id);
    return match ? { ...def, ...match } : def;
  });
}
