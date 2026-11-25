import { z } from 'zod';

export type Tier = 'fast' | 'mid' | 'strong';
export type Sensitivity = 'personal' | 'public';

export class CapacityError extends Error {
  constructor(message = 'High demand, try again soon') {
    super(message);
    this.name = 'CapacityError';
  }
}

export class CircuitBreakerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CircuitBreakerError';
  }
}

export interface CallMeta {
  provider: string;
  model: string;
  latencyMs: number;
  fallbackDepth: number;
  cached: boolean;
  tokensIn?: number;
  tokensOut?: number;
}

export interface LLMRequest<T> {
  tier: Tier;
  task: string;                       // 'ingest_resume', 'match_evidence', ...
  system?: string;
  prompt: string;
  schema: z.ZodType<T>;
  files?: { mime: string; data: Uint8Array }[];
  sensitivity: 'personal' | 'public'; // routes to providers allowed for that data
  cacheKey?: string;                  // content hash; router checks llm_cache first
  userId?: string;
  promptVersion: string;              // e.g. 'match_evidence@3'
  temperature?: number;               // 0 for scoring tasks
}

export interface ProviderCallRequest {
  tier: Tier;
  model: string;
  system?: string;
  prompt: string;
  jsonMode?: boolean;
  strictSchema?: boolean;             // Native strict structured output constraint
  schema?: z.ZodTypeAny;
  temperature?: number;
}

export interface ProviderCallResponse {
  rawText: string;
  tokensIn?: number;
  tokensOut?: number;
}

export interface ProviderConfig {
  id: string;
  name: string;
  tiers: Record<Tier, string>;
  json: boolean;
  strictSchema?: boolean;             // Flag indicating native structured JSON schema enforcement
  pdf: boolean;
  noTraining: boolean;
  maxContext: number;
  paid?: boolean;
  dailyQuota?: {
    calls?: number;
    tokens?: number;
  };
  call?: (req: ProviderCallRequest) => Promise<ProviderCallResponse>;
}

export interface Router {
  json<T>(req: LLMRequest<T>): Promise<{ data: T; meta: CallMeta }>;
  text(req: Omit<LLMRequest<string>, 'schema'>): Promise<{ text: string; meta: CallMeta }>;
}
