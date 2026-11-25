import { z } from 'zod';
import { Router, LLMRequest } from '../types';
import { wrapUntrustedContent, scanForInjection } from '../guards/injection';

export const JobRequirementItemSchema = z.object({
  requirement: z.string(),
  type: z.enum(['must', 'nice']),
  jd_quote: z.string(),
});

export type JobRequirementItem = z.infer<typeof JobRequirementItemSchema>;

export const JobEligibilitySchema = z.object({
  degree: z.array(z.string()).default([]),
  degree_quote: z.string().nullable().default(null),
  branches: z.array(z.string()).default([]),
  branches_quote: z.string().nullable().default(null),
  passoutYears: z.array(z.number()).default([]),
  passout_years_quote: z.string().nullable().default(null),
  minAggregate: z.number().nullable().default(null),
  min_aggregate_quote: z.string().nullable().default(null),
  backlogRule: z.string().nullable().default(null),
  backlogs_quote: z.string().nullable().default(null),
  location: z.string().nullable().default(null),
  location_quote: z.string().nullable().default(null),
  bond: z.string().nullable().default(null),
  bond_quote: z.string().nullable().default(null),
});

export type JobEligibility = z.infer<typeof JobEligibilitySchema>;

export const DEFAULT_JOB_ELIGIBILITY: JobEligibility = {
  degree: [],
  degree_quote: null,
  branches: [],
  branches_quote: null,
  passoutYears: [],
  passout_years_quote: null,
  minAggregate: null,
  min_aggregate_quote: null,
  backlogRule: null,
  backlogs_quote: null,
  location: null,
  location_quote: null,
  bond: null,
  bond_quote: null,
};

export const JobReaderOutputSchema = z.object({
  title: z.string().default('Target Role'),
  company: z.string().default('Hiring Company'),
  requirements: z.array(JobRequirementItemSchema).max(15),
  yearsRequired: z.number().default(0),
  isFresherFriendly: z.boolean().default(true),
  keyJdKeywords: z.array(z.string()).max(10).default([]),
  eligibility: JobEligibilitySchema.default(DEFAULT_JOB_ELIGIBILITY),
});

export type JobReaderOutput = z.infer<typeof JobReaderOutputSchema>;

export interface JobReaderAgentParams {
  rawJobText: string;
  router: Router;
  userId?: string;
}

export interface JobReaderAgentResult {
  data: JobReaderOutput;
  verifiedRequirements: JobRequirementItem[];
  injectionDetected: boolean;
  injectionFlags: string[];
}

/**
 * Job Reader Agent: Extracts requirements, seniority requirements, and keywords from job descriptions.
 * Cache-friendly prompt order: static rubric/system first, untrusted JD text last.
 * Validates quotes strictly against raw text in pure code.
 */
export async function runJobReaderAgent({
  rawJobText,
  router,
  userId,
}: JobReaderAgentParams): Promise<JobReaderAgentResult> {
  const scan = scanForInjection(rawJobText);
  if (scan.detected) {
    console.warn(`[JobReaderAgent] Potential prompt injection flags detected (warn only): ${scan.flags.join(', ')}`);
  }

  const req: LLMRequest<JobReaderOutput> = {
    tier: 'fast',
    task: 'read_job_description',
    promptVersion: 'job_reader@2',
    sensitivity: 'public',
    schema: JobReaderOutputSchema,
    temperature: 0,
    userId,
    system: `You are an accurate, objective job reader for tech positions.
Extract the target role title, company name, key requirements with exact verbatim quotes from the job description, required years of experience, whether it is fresher-friendly (0-1 yrs or entry-level friendly), top tech keywords, and hard eligibility criteria.
ELIGIBILITY CRITERIA EXTRACTION:
- Extract degree (e.g. ['B.E', 'B.Tech', 'MCA']), branches (e.g. ['CSE', 'IT']), passoutYears (numbers, e.g. [2024, 2025]), minAggregate (percentage number, e.g. 60.0), backlogRule (string description), location, bond.
- For each eligibility field, provide the exact verbatim jd_quote from the posting. If a criterion is not mentioned in the text, set its quote and value to null / empty array.
RULES:
1. Every jd_quote MUST be an exact verbatim substring from the provided job posting text.
2. Mark requirements as 'must' (core requirement/minimum qualification) or 'nice' (preferred qualification).
3. Do not invent requirements or qualifications. If a criterion is not stated, return null / empty.`,
    prompt: `Target Job Description to analyze:
${wrapUntrustedContent(rawJobText.slice(0, 12000))}`,
  };

  const { data } = await router.json(req);

  // Verify all jd_quotes in pure code
  const lowerJob = rawJobText.toLowerCase();
  const verifiedRequirements: JobRequirementItem[] = (data.requirements || []).map((reqItem) => {
    const quote = (reqItem.jd_quote || '').trim();
    const isQuotePresent = quote.length > 0 && lowerJob.includes(quote.toLowerCase());
    return {
      ...reqItem,
      jd_quote: isQuotePresent ? quote : '',
    };
  });

  // Verify eligibility quotes strictly against raw text in pure code
  const rawEligibility = data.eligibility || {};
  const verifyQuote = (q: string | null | undefined): string | null => {
    if (!q) return null;
    const trimmed = q.trim();
    return trimmed.length > 0 && lowerJob.includes(trimmed.toLowerCase()) ? trimmed : null;
  };

  const degreeQuote = verifyQuote(rawEligibility.degree_quote);
  const branchesQuote = verifyQuote(rawEligibility.branches_quote);
  const passoutYearsQuote = verifyQuote(rawEligibility.passout_years_quote);
  const minAggregateQuote = verifyQuote(rawEligibility.min_aggregate_quote);
  const backlogsQuote = verifyQuote(rawEligibility.backlogs_quote);
  const locationQuote = verifyQuote(rawEligibility.location_quote);
  const bondQuote = verifyQuote(rawEligibility.bond_quote);

  const verifiedEligibility: JobEligibility = {
    degree: degreeQuote ? rawEligibility.degree || [] : [],
    degree_quote: degreeQuote,
    branches: branchesQuote ? rawEligibility.branches || [] : [],
    branches_quote: branchesQuote,
    passoutYears: passoutYearsQuote ? rawEligibility.passoutYears || [] : [],
    passout_years_quote: passoutYearsQuote,
    minAggregate: minAggregateQuote ? rawEligibility.minAggregate : null,
    min_aggregate_quote: minAggregateQuote,
    backlogRule: backlogsQuote ? rawEligibility.backlogRule : null,
    backlogs_quote: backlogsQuote,
    location: locationQuote ? rawEligibility.location : null,
    location_quote: locationQuote,
    bond: bondQuote ? rawEligibility.bond : null,
    bond_quote: bondQuote,
  };

  return {
    data: {
      ...data,
      requirements: verifiedRequirements,
      eligibility: verifiedEligibility,
    },
    verifiedRequirements,
    injectionDetected: scan.detected,
    injectionFlags: scan.flags,
  };
}
