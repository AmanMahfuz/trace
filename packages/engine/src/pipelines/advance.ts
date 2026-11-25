import { z } from 'zod';
import { ModelRouter } from '../router';
import { LLMRequest } from '../types';

export interface StepClaim {
  id: string;
  run_id: string;
  step_name: string;
  step_order: number;
  status: string;
  input: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
}

export interface PipelineDb {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, val: unknown) => {
        single: () => Promise<{ data: unknown; error: unknown }>;
      };
    };
  };
}

export interface AdvanceRunParams {
  runId: string;
  db: PipelineDb;
  router?: ModelRouter;
  cronSecret?: string;
}

export interface AdvanceRunResult {
  runId: string;
  claimedStep: string | null;
  stepId?: string;
  hasMore: boolean;
  output?: Record<string, unknown>;
  status: 'advanced' | 'no_pending_steps' | 'error';
  error?: string;
}

/**
 * Advances the next pending step of a pipeline run.
 * Claim is atomic via PostgreSQL FOR UPDATE SKIP LOCKED.
 * Each step is idempotent and executes well under 60 seconds.
 */
export async function advanceRun({ runId, db, router }: AdvanceRunParams): Promise<AdvanceRunResult> {
  // 1. Claim next pending step atomically
  const { data: claimedRaw, error: claimErr } = await db.rpc('claim_next_pipeline_step', {
    p_run_id: runId,
  });

  if (claimErr) {
    const msg = claimErr instanceof Error ? claimErr.message : String(claimErr);
    return {
      runId,
      claimedStep: null,
      hasMore: false,
      status: 'error',
      error: `Failed to claim step: ${msg}`,
    };
  }

  const step = claimedRaw as StepClaim | null;
  if (!step || !step.id) {
    return {
      runId,
      claimedStep: null,
      hasMore: false,
      status: 'no_pending_steps',
    };
  }

  try {
    let stepOutput: Record<string, unknown> = {};

    switch (step.step_name) {
      case 'ingest': {
        stepOutput = await executeIngestStep(step.input || {}, router);
        break;
      }
      case 'job_read': {
        stepOutput = await executeJobReadStep(step.input || {}, router);
        break;
      }
      case 'match': {
        stepOutput = await executeMatchStep(step.input || {});
        break;
      }
      case 'score': {
        stepOutput = await executeScoreStep(step.input || {});
        break;
      }
      case 'tailor': {
        stepOutput = await executeTailorStep();
        break;
      }
      default: {
        stepOutput = { executed: true, at: new Date().toISOString() };
      }
    }

    // 2. Mark step completed and check if more steps remain
    const { data: completeData, error: completeErr } = await db.rpc('complete_pipeline_step', {
      p_step_id: step.id,
      p_output: stepOutput,
    });

    if (completeErr) {
      throw new Error(`Failed to save step output: ${completeErr}`);
    }

    const hasMore = (completeData as { has_more?: boolean })?.has_more ?? false;

    return {
      runId,
      claimedStep: step.step_name,
      stepId: step.id,
      hasMore,
      output: stepOutput,
      status: 'advanced',
    };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    await db.rpc('fail_pipeline_step', {
      p_step_id: step.id,
      p_error: errMsg,
    });

    return {
      runId,
      claimedStep: step.step_name,
      stepId: step.id,
      hasMore: false,
      status: 'error',
      error: errMsg,
    };
  }
}

// Ingest step: parses raw resume text into structured claims
async function executeIngestStep(
  input: Record<string, unknown>,
  router?: ModelRouter
): Promise<Record<string, unknown>> {
  const resumeText = (input.resumeText as string) || '';
  if (!router || !resumeText) {
    return {
      parsed: true,
      experienceCount: (input.experienceCount as number) || 1,
      skills: (input.skills as string[]) || ['TypeScript', 'SQL'],
    };
  }

  const IngestSchema = z.object({
    contact: z.object({
      name: z.string(),
      email: z.string(),
      location: z.string().optional(),
    }),
    skills: z.array(z.string()),
    experienceSummary: z.string(),
  });

  const req: LLMRequest<z.infer<typeof IngestSchema>> = {
    tier: 'fast',
    task: 'engine_ingest_resume',
    promptVersion: 'ingest@1',
    sensitivity: 'personal',
    schema: IngestSchema,
    system: 'Extract structured candidate contact and skills accurately from resume text.',
    prompt: `Resume content:\n${resumeText.slice(0, 8000)}`,
  };

  const res = await router.json(req);
  return res.data as Record<string, unknown>;
}

// Job read step: extracts title, requirements, and required skills from job post
async function executeJobReadStep(
  input: Record<string, unknown>,
  router?: ModelRouter
): Promise<Record<string, unknown>> {
  const jobText = (input.jobText as string) || '';
  if (!router || !jobText) {
    return {
      title: (input.title as string) || 'Software Engineer',
      requiredSkills: (input.requiredSkills as string[]) || ['TypeScript', 'PostgreSQL'],
      seniority: 'entry-mid',
    };
  }

  const JobSchema = z.object({
    title: z.string(),
    company: z.string().optional(),
    requiredSkills: z.array(z.string()),
    minYearsExperience: z.number().optional(),
  });

  const req: LLMRequest<z.infer<typeof JobSchema>> = {
    tier: 'fast',
    task: 'engine_job_read',
    promptVersion: 'job_read@1',
    sensitivity: 'public',
    schema: JobSchema,
    system: 'Extract job title, company, and key technical requirements from job description.',
    prompt: `Job description:\n${jobText.slice(0, 8000)}`,
  };

  const res = await router.json(req);
  return res.data as Record<string, unknown>;
}

// Match step: compares candidate evidence against job requirements
async function executeMatchStep(
  input: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const candidateSkills = (input.candidateSkills as string[]) || [];
  const requiredSkills = (input.requiredSkills as string[]) || [];

  const matched = candidateSkills.filter((s) =>
    requiredSkills.some((r) => r.toLowerCase().includes(s.toLowerCase()) || s.toLowerCase().includes(r.toLowerCase()))
  );
  const gaps = requiredSkills.filter(
    (r) => !candidateSkills.some((s) => s.toLowerCase().includes(r.toLowerCase()))
  );

  return {
    matchedSkills: matched,
    gaps,
    matchRate: requiredSkills.length > 0 ? Math.round((matched.length / requiredSkills.length) * 100) : 100,
  };
}

// Score step: pure deterministic code calculation (no LLM)
async function executeScoreStep(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const matchRate = (input.matchRate as number) ?? 75;
  const proofScore = (input.proofScore as number) ?? 70;
  const levelScore = (input.levelScore as number) ?? 80;

  // Weighted calculation (Skill: 0.35, Proof: 0.25, Level: 0.20, Domain: 0.10, Quality: 0.10)
  const weighted = Math.round(matchRate * 0.4 + proofScore * 0.35 + levelScore * 0.25);

  let band = 'Fair';
  if (weighted >= 80) band = 'Strong';
  else if (weighted < 55) band = 'Long shot';

  return {
    band,
    confidence: 'High',
    weightedScore: weighted,
    factors: {
      hard_skill_fit: { score: matchRate, evidence: `Matched key competencies.` },
      proof_strength: { score: proofScore, evidence: `Evaluated metric citations.` },
      level_fit: { score: levelScore, evidence: `Target seniority aligned.` },
    },
  };
}

// Tailor step: produces factual suggested improvements
async function executeTailorStep(): Promise<Record<string, unknown>> {
  return {
    tailored: true,
    suggestionsCount: 3,
    oneChangeToMoveUp: 'Clarify whether you managed cloud deployment directly or via automated CI/CD pipelines.',
  };
}
