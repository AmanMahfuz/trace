import { z } from 'zod';
import { ModelRouter } from '../router';
import { LLMRequest } from '../types';

export interface AutopsyParams {
  jobTitle: string;
  companyName: string;
  oddsBand: string;
  outcome: 'rejected' | 'ghosted' | 'interview_no_offer';
  factorScores?: Record<string, { score: number; evidence?: string }>;
  topGaps?: string[];
  router?: ModelRouter;
  userId?: string;
}

export interface AutopsyResult {
  reasons: Array<{
    title: string;
    factorCited: string;
    detail: string;
  }>;
  pivotPlan: {
    immediateAction: string;
    skillToDemonstrate: string;
    recommendedTimeline: string;
  };
  followUpEmail: {
    subject: string;
    body: string;
  };
  generatedAt: string;
}

export async function generateAutopsy({
  jobTitle,
  companyName,
  oddsBand,
  outcome,
  factorScores = {},
  topGaps = [],
  router,
  userId,
}: AutopsyParams): Promise<AutopsyResult> {
  const AutopsySchema = z.object({
    reasons: z.array(
      z.object({
        title: z.string(),
        factorCited: z.string(),
        detail: z.string(),
      })
    ).min(2).max(4),
    pivotPlan: z.object({
      immediateAction: z.string(),
      skillToDemonstrate: z.string(),
      recommendedTimeline: z.string(),
    }),
    followUpEmail: z.object({
      subject: z.string(),
      body: z.string(),
    }),
  });

  if (!router) {
    return {
      reasons: [
        {
          title: 'Skill Gap & Seniority Threshold',
          factorCited: 'hard_skill_fit',
          detail: topGaps[0]
            ? `Application lacked demonstrated evidence for: ${topGaps[0]}.`
            : 'Candidate qualifications leaned entry-level relative to candidate pool depth.',
        },
        {
          title: 'Evidence Specificity',
          factorCited: 'proof_strength',
          detail: 'Resume bullet points listed technical stack responsibilities without verified impact scale.',
        },
      ],
      pivotPlan: {
        immediateAction: 'Build a targeted GitHub proof repository solving a core operational bottleneck for this company.',
        skillToDemonstrate: topGaps[0] || 'Distributed backend architecture',
        recommendedTimeline: '7 to 10 days before re-approaching engineering team',
      },
      followUpEmail: {
        subject: `Thank you for the update - ${jobTitle} application - ${companyName}`,
        body: `Dear Hiring Team,\n\nThank you for letting me know regarding the ${jobTitle} position. I appreciated learning more about your team's engineering goals.\n\nI remain enthusiastic about ${companyName}'s mission and will continue sharpening my background. If future roles matching my skills open up, I would welcome staying in touch.\n\nBest regards,`,
      },
      generatedAt: new Date().toISOString(),
    };
  }

  const prompt = `Application Context:
- Role: ${jobTitle} at ${companyName}
- Diagnostic Predicted Band: ${oddsBand}
- Logged Outcome: ${outcome}
- Identified Gaps: ${topGaps.join(', ') || 'General seniority competition'}
- Factor Evidence: ${JSON.stringify(factorScores)}

Generate an objective diagnostic autopsy:
1. 2-3 specific root causes, each directly citing one factor.
2. A concrete 3-part pivot plan.
3. A courteous, professional follow-up email draft.`;

  const req: LLMRequest<z.infer<typeof AutopsySchema>> = {
    tier: 'fast',
    task: 'application_autopsy',
    promptVersion: 'autopsy@2',
    sensitivity: 'personal',
    schema: AutopsySchema,
    temperature: 0,
    userId,
    system:
      'You are a career autopsy specialist. Produce an honest, constructive diagnostic post-mortem explaining why an application or interview stalled, citing specific evaluation factors without speculation.',
    prompt,
  };

  try {
    const res = await router.json(req);
    return {
      ...res.data,
      generatedAt: new Date().toISOString(),
    };
  } catch {
    return {
      reasons: [
        {
          title: 'Skill Evidence & Pool Depth',
          factorCited: 'hard_skill_fit',
          detail: 'Screening pool prioritized applicants with verified production metrics on core requirements.',
        },
      ],
      pivotPlan: {
        immediateAction: 'Refactor current portfolio projects to include performance benchmarks and scale metrics.',
        skillToDemonstrate: 'Production systems engineering',
        recommendedTimeline: '1-2 weeks',
      },
      followUpEmail: {
        subject: `Thank you - ${jobTitle} at ${companyName}`,
        body: `Hi Hiring Team,\n\nThank you for following up regarding the ${jobTitle} role. I enjoyed exploring the position and hope to cross paths again in the future.\n\nBest,`,
      },
      generatedAt: new Date().toISOString(),
    };
  }
}
