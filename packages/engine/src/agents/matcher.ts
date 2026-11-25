import { z } from 'zod';
import { Router, LLMRequest } from '../types';
import { IngestResumeOutput } from './ingest';
import { JobRequirementItem } from './jobReader';
import { wrapUntrustedContent } from '../guards/injection';

export const EvaluatedRequirementSchema = z.object({
  requirement: z.string(),
  type: z.enum(['must', 'nice']),
  jd_quote: z.string(),
  status: z.enum(['met', 'partial', 'missing']),
  resume_quote: z.string().optional(),
});

export type EvaluatedRequirement = z.infer<typeof EvaluatedRequirementSchema>;

export const MatcherOutputSchema = z.object({
  requirements: z.array(EvaluatedRequirementSchema).max(15),
  domain_relevance: z.number().min(0).max(100),
  domain_evidence: z.string(),
  top_gaps: z.array(z.string()).max(3),
  one_change_to_move_up: z.string(),
  confidence: z.enum(['Low', 'Medium', 'High']),
});

export type MatcherOutput = z.infer<typeof MatcherOutputSchema>;

export interface MatcherAgentParams {
  resume: IngestResumeOutput;
  rawJobText: string;
  requirements?: JobRequirementItem[];
  router: Router;
  userId?: string;
}

export interface MatcherAgentResult {
  data: MatcherOutput;
  verifiedRequirements: EvaluatedRequirement[];
}

function normalizeSearchText(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
}

function buildResumeSearchCorpus(resume: IngestResumeOutput): string {
  const parts: string[] = [];
  if (resume.summary) parts.push(resume.summary);
  (resume.skills || []).forEach((s) => parts.push(s));
  (resume.experience || []).forEach((exp) => {
    parts.push(exp.company, exp.title);
    exp.bullets?.forEach((b) => parts.push(b.text));
  });
  (resume.projects || []).forEach((proj) => {
    parts.push(proj.name, ...(proj.tech || []));
    proj.bullets?.forEach((b) => parts.push(b.text));
  });
  (resume.education || []).forEach((ed) => {
    parts.push(ed.school, ed.degree || '');
  });
  return normalizeSearchText(parts.join(' '));
}

/**
 * Verifies that all 'met' requirements cite an authentic, verifiable quote from the resume.
 * Downgrades ungrounded claims to 'partial' or 'missing'.
 */
export function verifyMatcherQuotes(
  requirements: EvaluatedRequirement[],
  resume: IngestResumeOutput
): EvaluatedRequirement[] {
  const corpus = buildResumeSearchCorpus(resume);
  const normalizedSkills = (resume.skills || []).map((s) => normalizeSearchText(s));

  return requirements.map((req) => {
    if (req.status !== 'met') return req;

    const quote = req.resume_quote ? normalizeSearchText(req.resume_quote) : '';
    const quoteVerified = quote.length > 5 && corpus.includes(quote);

    if (quoteVerified) return req;

    // Check if the skill is at least listed in the skills array
    const reqNorm = normalizeSearchText(req.requirement);
    const inSkills = normalizedSkills.some((s) => s.includes(reqNorm) || reqNorm.includes(s));

    return {
      ...req,
      status: inSkills ? 'partial' : 'missing',
      resume_quote: undefined,
    };
  });
}

/**
 * Evidence Matcher Agent: Matches requirements against resume evidence.
 * Cache-friendly prompt order: static rubric/system first, untrusted candidate & JD text last.
 */
export async function runMatcherAgent({
  resume,
  rawJobText,
  requirements,
  router,
  userId,
}: MatcherAgentParams): Promise<MatcherAgentResult> {
  const reqContext = requirements && requirements.length > 0
    ? `Identified Job Requirements:\n${JSON.stringify(requirements, null, 2)}\n\n`
    : '';

  const req: LLMRequest<MatcherOutput> = {
    tier: 'mid',
    task: 'match_evidence',
    promptVersion: 'matcher@2',
    sensitivity: 'personal',
    schema: MatcherOutputSchema,
    temperature: 0,
    userId,
    system: `You are an honest, rigorous hiring diagnostic engine for tech freshers.
SCORING ANCHORS:
- A typical fresher with one internship and one project scores 45-65.
- Reserve 85+ for rare, clearly evidenced commercial matches.
- In evaluating requirements:
  - 'met' REQUIRES a direct verbatim quote from the resume proving the skill was applied in work or a substantial project.
  - A skill listed only in the skills list with NO project/work bullet proof is 'partial'.
  - No quote or evidence means 'missing'.
- Domain relevance anchors:
  - 100: Same commercial domain and exact same stack in production work.
  - 60: Adjacent domain or similar modern stack.
  - 30: Academic coursework or hobby projects only.
  - 0: Unrelated domain.
Do not invent facts or inflate candidate scores.`,
    prompt: `${reqContext}Candidate Resume:
${wrapUntrustedContent(JSON.stringify(resume, null, 2), 'candidate_resume')}

Target Job Description:
${wrapUntrustedContent(rawJobText.slice(0, 8000), 'job_description')}`,
  };

  const { data } = await router.json(req);
  const verifiedRequirements = verifyMatcherQuotes(data.requirements, resume);

  return {
    data: {
      ...data,
      requirements: verifiedRequirements,
    },
    verifiedRequirements,
  };
}
