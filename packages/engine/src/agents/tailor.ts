import { z } from 'zod';
import { Router, LLMRequest } from '../types';
import { IngestResumeOutput } from './ingest';
import { verifyRewriteWithFactLock } from '../guards/factLock';
import { wrapUntrustedContent } from '../guards/injection';

export const TailorSuggestionItemSchema = z.object({
  bullet_id: z.string(),
  original: z.string(),
  suggested: z.string().optional(),
  reason: z.string(),
  needs_detail: z.object({ question: z.string() }).optional(),
});

export type TailorSuggestionItem = z.infer<typeof TailorSuggestionItemSchema>;

export const TailorOutputSchema = z.array(TailorSuggestionItemSchema);

export type TailorOutput = z.infer<typeof TailorOutputSchema>;

export interface TailorAgentParams {
  resume: IngestResumeOutput;
  rawJobText: string;
  router: Router;
  userId?: string;
  userDetails?: string[];
  transcript?: string;
}

export interface TailorAgentResult {
  suggestions: TailorSuggestionItem[];
  factLockViolationsFixed: number;
  factLockDowngradedCount: number;
}

function collectSourceTexts(
  resume: IngestResumeOutput,
  userDetails: string[] = [],
  transcript?: string
): string[] {
  const sources: string[] = [...userDetails];
  if (transcript) sources.push(transcript);
  if (resume.summary) sources.push(resume.summary);
  (resume.skills || []).forEach((s) => sources.push(s));
  (resume.experience || []).forEach((exp) => {
    sources.push(exp.company, exp.title);
    exp.bullets?.forEach((b) => sources.push(b.text));
  });
  (resume.projects || []).forEach((proj) => {
    sources.push(proj.name, ...(proj.tech || []));
    proj.bullets?.forEach((b) => sources.push(b.text));
  });
  return sources;
}

/**
 * Tailor Agent: Generates grounded resume bullet rewrites.
 * Enforces Fact-Lock:
 * Extracts numbers, percentages, currencies, entities, and tool names.
 * Any unverified claim triggers one retry; persistent hallucinations are downgraded to needs_detail.
 */
export async function runTailorAgent({
  resume,
  rawJobText,
  router,
  userId,
  userDetails = [],
  transcript,
}: TailorAgentParams): Promise<TailorAgentResult> {
  const candidateBullets = [
    ...(resume.experience?.flatMap((e) => e.bullets || []) || []),
    ...(resume.projects?.flatMap((p) => p.bullets || []) || []),
  ];

  if (candidateBullets.length === 0) {
    return {
      suggestions: [],
      factLockViolationsFixed: 0,
      factLockDowngradedCount: 0,
    };
  }

  const sourceTexts = collectSourceTexts(resume, userDetails, transcript);

  const req: LLMRequest<TailorOutput> = {
    tier: 'mid',
    task: 'tailor_rewrites',
    promptVersion: 'tailor@2',
    sensitivity: 'personal',
    schema: TailorOutputSchema,
    temperature: 0,
    userId,
    system: `You are an honest career engineer specializing in resume impact.
Suggest targeted bullet rewrites strictly grounded in the candidate's existing experience.
CRITICAL HONESTY RULES:
1. NEVER invent facts, metrics, percentages, dollar values, or tools that the candidate did not mention.
2. If a bullet point is vague, missing scale, or lacks quantifiable proof, DO NOT fabricate numbers.
   Leave suggested empty and set needs_detail with a clarifying question asking the candidate for the real facts.
3. Every suggested rewrite must pass strict Fact-Lock verification against the candidate's original text.`,
    prompt: `Candidate Bullets with IDs:
${wrapUntrustedContent(
  JSON.stringify(
    candidateBullets.map((b) => ({ id: b.id, text: b.text })),
    null,
    2
  ),
  'candidate_bullets'
)}

Target Job Description:
${wrapUntrustedContent(rawJobText.slice(0, 8000), 'job_description')}`,
  };

  const { data: initialSuggestions } = await router.json(req);

  let factLockViolationsFixed = 0;
  let factLockDowngradedCount = 0;

  const finalSuggestions: TailorSuggestionItem[] = [];

  for (const item of initialSuggestions) {
    if (!item.suggested) {
      finalSuggestions.push(item);
      continue;
    }

    const check = verifyRewriteWithFactLock(item.suggested, sourceTexts);
    if (check.passed) {
      finalSuggestions.push(item);
      continue;
    }

    // Step 2 requirement: 1 regeneration attempt on violation
    try {
      const retryReq: LLMRequest<TailorSuggestionItem> = {
        tier: 'mid',
        task: 'tailor_rewrite_repair',
        promptVersion: 'tailor_repair@1',
        sensitivity: 'personal',
        schema: TailorSuggestionItemSchema,
        temperature: 0,
        userId,
        system: `You are correcting a resume rewrite that failed Fact-Lock verification.
The suggested rewrite introduced unverified tokens: [${check.unverifiedTokens.join(', ')}].
Either:
A) Rewrite the bullet using ONLY facts, tools, and metrics present in the original text.
B) If metrics are missing, leave suggested empty and provide a needs_detail question asking the candidate.`,
        prompt: `Original bullet text: "${item.original}"
Failed suggested text: "${item.suggested}"
Failing tokens: ${JSON.stringify(check.unverifiedTokens)}`,
      };

      const { data: repaired } = await router.json(retryReq);
      if (repaired.suggested) {
        const recheck = verifyRewriteWithFactLock(repaired.suggested, sourceTexts);
        if (recheck.passed) {
          finalSuggestions.push(repaired);
          factLockViolationsFixed++;
          continue;
        }
      }

      // If retry still fails or still contains hallucinations, downgrade to needs_detail
      factLockDowngradedCount++;
      finalSuggestions.push({
        bullet_id: item.bullet_id,
        original: item.original,
        suggested: undefined,
        reason: item.reason,
        needs_detail: {
          question: `Could you share more detail or measurable impact for: "${item.original}"?`,
        },
      });
    } catch {
      // On error, safely downgrade to needs_detail
      factLockDowngradedCount++;
      finalSuggestions.push({
        bullet_id: item.bullet_id,
        original: item.original,
        suggested: undefined,
        reason: item.reason,
        needs_detail: {
          question: `Could you provide specific scale or metrics for: "${item.original}"?`,
        },
      });
    }
  }

  return {
    suggestions: finalSuggestions,
    factLockViolationsFixed,
    factLockDowngradedCount,
  };
}
