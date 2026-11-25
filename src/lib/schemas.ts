import { z } from 'zod';

export const ResumeSchema = z.object({
  contact: z.object({
    name: z.string(),
    email: z.string().optional(),
    phone: z.string().optional(),
    location: z.string().optional(),
    links: z.array(z.string()).default([]),
  }),
  summary: z.string().optional(),
  experience: z.array(
    z.object({
      id: z.string().optional(),
      company: z.string(),
      title: z.string(),
      start: z.string().optional(),
      end: z.string().optional(),
      bullets: z.array(
        z.object({
          id: z.string().optional(),
          text: z.string(),
        })
      ).default([]),
    })
  ).default([]),
  projects: z.array(
    z.object({
      id: z.string().optional(),
      name: z.string(),
      tech: z.array(z.string()).default([]),
      bullets: z.array(
        z.object({
          id: z.string().optional(),
          text: z.string(),
        })
      ).default([]),
    })
  ).default([]),
  education: z.array(
    z.object({
      id: z.string().optional(),
      school: z.string(),
      degree: z.string(),
      year: z.string().optional(),
      gpa: z.string().optional(),
    })
  ).default([]),
  skills: z.array(z.string()).default([]),
  certifications: z.array(z.string()).default([]),
});

export type Resume = z.infer<typeof ResumeSchema>;

export const OddsFactorSchema = z.object({
  score: z.number().min(0).max(100),
  evidence: z.string(),
});

export const OddsResultSchema = z.object({
  band: z.enum(['Long shot', 'Fair', 'Strong']),
  factors: z.object({
    skill_coverage: OddsFactorSchema,
    proof_strength: OddsFactorSchema,
    level_fit: OddsFactorSchema,
    domain_relevance: OddsFactorSchema,
    application_quality: OddsFactorSchema,
  }),
  weighted_score: z.number(),
  top_gaps: z.array(z.string()).max(3),
  one_change_to_move_up: z.string(),
  confidence: z.enum(['Low', 'Medium', 'High']),
});

export type OddsResult = z.infer<typeof OddsResultSchema>;

export const GhostResultSchema = z.object({
  level: z.enum(['Low', 'Medium', 'High']),
  signals: z.array(z.string()),
});

export type GhostResult = z.infer<typeof GhostResultSchema>;

export const TailorSuggestionSchema = z.object({
  bullet_id: z.string().uuid(),
  original: z.string(),
  suggested: z.string().optional(),
  reason: z.string(),
  needs_detail: z.object({ question: z.string() }).optional(),
});

export type TailorSuggestion = z.infer<typeof TailorSuggestionSchema>;

export const AutopsyResultSchema = z.object({
  likely_reasons: z.array(
    z.object({
      reason: z.string(),
      likelihood: z.enum(['High', 'Medium', 'Low']),
      basis: z.string(),
    })
  ),
  fix_plan: z.array(z.string()).max(3),
  followup_email: z.string().optional(),
});

export type AutopsyResult = z.infer<typeof AutopsyResultSchema>;
