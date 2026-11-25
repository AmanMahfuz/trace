import { generateObject, generateText as sdkGenerateText } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createAnthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import {
  ModelRouter,
  ProviderConfig,
  CapacityError,
  LLMRequest,
} from '@trace/engine';
import { SupabaseStore } from '@/lib/store/supabase-store';

export class AIUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AIUnavailableError';
  }
}

export type ModelTier = 'fast' | 'mid' | 'strong';

interface GenerateJSONParams<T extends z.ZodTypeAny> {
  tier: ModelTier;
  schema: T;
  system?: string;
  prompt: string;
  userId?: string;
  task?: string;
  temperature?: number;
  sensitivity?: 'personal' | 'public';
}

interface GenerateTextParams {
  tier: ModelTier;
  system?: string;
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  userId?: string;
  task?: string;
  temperature?: number;
  sensitivity?: 'personal' | 'public';
}

function getGoogleClient() {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || 'dummy_test_key';
  return createGoogleGenerativeAI({ apiKey });
}

function getAnthropicClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  return createAnthropic({ apiKey });
}

// Global engine store and router instances
const store = new SupabaseStore();

function createEngineProviders(): ProviderConfig[] {
  const googleClient = getGoogleClient();
  const anthropicClient = getAnthropicClient();

  const googleFast = process.env.AI_MODEL_FAST || 'gemini-2.5-flash';
  const googleMid = process.env.AI_MODEL_MID || 'gemini-2.5-flash';
  const googleStrong = process.env.AI_MODEL_STRONG || 'gemini-2.5-flash';

  const claudeFast = process.env.AI_FALLBACK_MODEL || 'claude-3-5-haiku-latest';
  const claudeMid = process.env.AI_FALLBACK_MODEL || 'claude-3-5-haiku-latest';
  const claudeStrong = process.env.AI_FALLBACK_MODEL || 'claude-3-5-haiku-latest';

  const providers: ProviderConfig[] = [
    {
      id: 'gemini',
      name: 'Google Gemini',
      tiers: {
        fast: googleFast,
        mid: googleMid,
        strong: googleStrong,
      },
      json: true,
      strictSchema: true,
      pdf: true,
      noTraining: true,
      maxContext: 1_000_000,
      paid: false,
      dailyQuota: {
        calls: 1500,
        tokens: 1_000_000,
      },
      call: async (req) => {
        const model = googleClient(req.model);
        if (req.jsonMode && req.schema) {
          const res = await generateObject({
            model,
            schema: req.schema,
            system: req.system,
            prompt: req.prompt,
            temperature: req.temperature ?? 0,
          });
          const resUsage = (res as { usage?: { inputTokens?: number; outputTokens?: number; promptTokens?: number; completionTokens?: number } }).usage;
          return {
            rawText: JSON.stringify(res.object),
            tokensIn: resUsage?.inputTokens ?? resUsage?.promptTokens,
            tokensOut: resUsage?.outputTokens ?? resUsage?.completionTokens,
          };
        } else {
          const res = await sdkGenerateText({
            model,
            system: req.system,
            prompt: req.prompt,
            temperature: req.temperature ?? 0,
          });
          return {
            rawText: res.text,
            tokensIn: res.usage?.inputTokens,
            tokensOut: res.usage?.outputTokens,
          };
        }
      },
    },
    {
      id: 'claude',
      name: 'Anthropic Claude',
      tiers: {
        fast: claudeFast,
        mid: claudeMid,
        strong: claudeStrong,
      },
      json: true,
      strictSchema: true,
      pdf: true,
      noTraining: true,
      maxContext: 200_000,
      paid: true,
      call: async (req) => {
        const client = anthropicClient || googleClient;
        const model = client(req.model);
        if (req.jsonMode && req.schema) {
          const res = await generateObject({
            model,
            schema: req.schema,
            system: req.system,
            prompt: req.prompt,
            temperature: req.temperature ?? 0,
          });
          const resUsage = (res as { usage?: { inputTokens?: number; outputTokens?: number; promptTokens?: number; completionTokens?: number } }).usage;
          return {
            rawText: JSON.stringify(res.object),
            tokensIn: resUsage?.inputTokens ?? resUsage?.promptTokens,
            tokensOut: resUsage?.outputTokens ?? resUsage?.completionTokens,
          };
        } else {
          const res = await sdkGenerateText({
            model,
            system: req.system,
            prompt: req.prompt,
            temperature: req.temperature ?? 0,
          });
          return {
            rawText: res.text,
            tokensIn: res.usage?.inputTokens,
            tokensOut: res.usage?.outputTokens,
          };
        }
      },
    },
  ];

  return providers;
}

export const router = new ModelRouter({
  store,
  providers: createEngineProviders(),
});

export async function generateJSON<T extends z.ZodTypeAny>(
  params: GenerateJSONParams<T>
): Promise<z.infer<T>> {
  const taskName = params.task || 'unspecified';
  const promptVersion = `${taskName}@1`;

  try {
    const req: LLMRequest<z.infer<T>> = {
      tier: params.tier,
      task: taskName,
      system: params.system,
      prompt: params.prompt,
      schema: params.schema as unknown as z.ZodType<z.infer<T>>,
      sensitivity: params.sensitivity || 'personal',
      userId: params.userId,
      promptVersion,
      temperature: params.temperature ?? 0,
    };

    const result = await router.json(req);
    return result.data;
  } catch (err: unknown) {
    if (err instanceof CapacityError) {
      throw new AIUnavailableError(
        'Our diagnostic intelligence engine is momentarily overloaded. Please retry in a few moments.'
      );
    }
    const msg = err instanceof Error ? err.message : String(err);
    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
      throw new AIUnavailableError(
        'AI service configuration missing. Please add your GOOGLE_GENERATIVE_AI_API_KEY in .env.local.'
      );
    }
    throw new AIUnavailableError(
      msg.includes('429') || msg.includes('overloaded') || msg.includes('quota')
        ? 'Our diagnostic intelligence engine is momentarily overloaded. Please retry in a few moments.'
        : `Diagnostic AI Error: ${msg}`
    );
  }
}

export async function generateText(params: GenerateTextParams): Promise<string> {
  const taskName = params.task || 'unspecified';
  const promptVersion = `${taskName}@1`;
  const combinedPrompt = params.messages.map((m) => `${m.role}: ${m.content}`).join('\n\n');

  try {
    const result = await router.text({
      tier: params.tier,
      task: taskName,
      system: params.system,
      prompt: combinedPrompt,
      sensitivity: params.sensitivity || 'personal',
      userId: params.userId,
      promptVersion,
      temperature: params.temperature ?? 0,
    });
    return result.text;
  } catch (err: unknown) {
    if (err instanceof CapacityError) {
      throw new AIUnavailableError('Voice sparring engine is briefly offline. Try once again.');
    }
    throw new AIUnavailableError('Voice sparring engine is briefly offline. Try once again.');
  }
}
