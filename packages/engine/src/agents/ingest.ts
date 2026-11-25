import { z } from 'zod';
import { Router, LLMRequest } from '../types';
import { wrapUntrustedContent, scanForInjection } from '../guards/injection';

export const ResumeContactSchema = z.object({
  name: z.string(),
  email: z.string().optional(),
  phone: z.string().optional(),
  location: z.string().optional(),
  github: z.string().optional(),
  linkedin: z.string().optional(),
  links: z.array(z.string()).optional().default([]),
});

export const ResumeBulletSchema = z.object({
  id: z.string(),
  text: z.string(),
  verified: z.boolean().default(true),
});

export const ResumeExperienceSchema = z.object({
  id: z.string(),
  company: z.string(),
  title: z.string(),
  location: z.string().optional(),
  start: z.string().optional(),
  end: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  bullets: z.array(ResumeBulletSchema).default([]),
});

export const ResumeProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  tech: z.array(z.string()).default([]),
  bullets: z.array(ResumeBulletSchema).default([]),
});

export const ResumeEducationSchema = z.object({
  id: z.string(),
  school: z.string(),
  degree: z.string().optional(),
  year: z.string().optional(),
});

export const IngestResumeOutputSchema = z.object({
  contact: ResumeContactSchema,
  summary: z.string().optional(),
  skills: z.array(z.string()).default([]),
  experience: z.array(ResumeExperienceSchema).default([]),
  projects: z.array(ResumeProjectSchema).default([]),
  education: z.array(ResumeEducationSchema).default([]),
});

export type IngestResumeOutput = z.infer<typeof IngestResumeOutputSchema>;

export interface IngestAgentParams {
  rawText: string;
  router: Router;
  userId?: string;
  generateId?: () => string;
}

export interface IngestAgentResult {
  resume: IngestResumeOutput;
  quoteIndex: string[];
  injectionDetected: boolean;
  injectionFlags: string[];
}

function defaultId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'id_' + Math.random().toString(36).substring(2, 11);
}

/**
 * Ingest Agent: parses raw resume text into a structured ResumeTree with unique UUIDs
 * on all bullets and entries, and builds a normalized quote index in pure code.
 */
export async function runIngestAgent({
  rawText,
  router,
  userId,
  generateId = defaultId,
}: IngestAgentParams): Promise<IngestAgentResult> {
  const scan = scanForInjection(rawText);
  if (scan.detected) {
    console.warn(`[IngestAgent] Potential prompt injection flags detected (warn only): ${scan.flags.join(', ')}`);
  }

  const req: LLMRequest<IngestResumeOutput> = {
    tier: 'fast',
    task: 'ingest_resume',
    promptVersion: 'ingest@3',
    sensitivity: 'personal',
    schema: IngestResumeOutputSchema,
    temperature: 0,
    userId,
    system:
      'You are an expert resume parser for tech freshers and software engineers. Parse raw resume text into JSON strictly matching the schema. Assign a unique UUID to every experience bullet, project bullet, experience entry, project entry, and education entry. Never invent metrics or experience.',
    prompt: `Target Resume Content to parse:\n${wrapUntrustedContent(rawText.slice(0, 15000), 'untrusted_resume')}`,
  };

  const { data: parsed } = await router.json(req);

  // Guarantee UUIDs on every entry & bullet
  parsed.experience?.forEach((e) => {
    if (!e.id) e.id = generateId();
    e.bullets?.forEach((b) => {
      if (!b.id) b.id = generateId();
    });
  });

  parsed.projects?.forEach((p) => {
    if (!p.id) p.id = generateId();
    p.bullets?.forEach((b) => {
      if (!b.id) b.id = generateId();
    });
  });

  parsed.education?.forEach((ed) => {
    if (!ed.id) ed.id = generateId();
  });

  // Build quote index in pure code (searchable lines and phrases)
  const quoteIndex: string[] = [];
  parsed.experience?.forEach((e) => {
    quoteIndex.push(e.company, e.title);
    e.bullets?.forEach((b) => quoteIndex.push(b.text));
  });
  parsed.projects?.forEach((p) => {
    quoteIndex.push(p.name);
    p.bullets?.forEach((b) => quoteIndex.push(b.text));
  });
  if (parsed.summary) quoteIndex.push(parsed.summary);

  return {
    resume: parsed,
    quoteIndex,
    injectionDetected: scan.detected,
    injectionFlags: scan.flags,
  };
}
