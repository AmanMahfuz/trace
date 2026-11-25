import { OddsResult, Resume } from './schemas';

export interface JobRequirementItem {
  requirement: string;
  type: 'must' | 'nice';
  jd_quote: string;
  status: 'met' | 'partial' | 'missing';
  resume_quote?: string;
}

export interface FactorInputs {
  skill_coverage: { score: number; evidence: string };
  proof_strength: { score: number; evidence: string };
  level_fit: { score: number; evidence: string };
  domain_relevance: { score: number; evidence: string };
  application_quality: { score: number; evidence: string };
}

/**
 * Whitespace normalization helper
 */
export function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * Extracts all resume text into a single normalized searchable string
 */
export function getFullResumeSearchText(resume: Resume): string {
  const parts: string[] = [];
  if (resume.contact?.name) parts.push(resume.contact.name);
  if (resume.skills?.length) parts.push(resume.skills.join(' '));

  resume.experience?.forEach((e) => {
    parts.push(e.company, e.title);
    e.bullets?.forEach((b) => parts.push(b.text));
  });

  resume.projects?.forEach((p) => {
    parts.push(p.name, ...(p.tech || []));
    p.bullets?.forEach((b) => parts.push(b.text));
  });

  resume.education?.forEach((ed) => {
    parts.push(ed.school, ed.degree || '');
  });

  return normalizeText(parts.join(' '));
}

/**
 * 1. Verify Requirement Quotes against Resume Text:
 * After the model returns requirements, verify each resume_quote appears in the
 * resume text (case-insensitive substring after whitespace normalization). If not,
 * downgrade 'met' to 'partial' (if the skill is in the skills list) or 'missing'.
 */
export function verifyRequirementQuotes(
  requirements: JobRequirementItem[],
  resume: Resume
): JobRequirementItem[] {
  const fullSearchText = getFullResumeSearchText(resume);
  const normalizedSkills = (resume.skills || []).map((s) => normalizeText(s));

  return requirements.map((req) => {
    if (req.status !== 'met') {
      return req;
    }

    const quote = req.resume_quote ? normalizeText(req.resume_quote) : '';
    const quoteVerified = quote.length > 0 && fullSearchText.includes(quote);

    if (quoteVerified) {
      return req;
    }

    // Quote does not appear in resume text! Check if the requirement/skill is at least listed in skills array
    const reqNormalized = normalizeText(req.requirement);
    const hasSkillListed = normalizedSkills.some(
      (s) => s.includes(reqNormalized) || reqNormalized.includes(s)
    );

    if (hasSkillListed) {
      return {
        ...req,
        status: 'partial',
        resume_quote: undefined,
      };
    }

    return {
      ...req,
      status: 'missing',
      resume_quote: undefined,
    };
  });
}

/**
 * 1. Skill Coverage Computation:
 * must requirements weighted 2x, nice weighted 1x.
 * status: 'met' = 1.0, 'partial' = 0.5, 'missing' = 0.0
 */
export function computeSkillCoverage(requirements: JobRequirementItem[]): {
  score: number;
  evidence: string;
} {
  if (!requirements || requirements.length === 0) {
    return { score: 50, evidence: 'No specific requirements extracted from the posting.' };
  }

  let totalWeight = 0;
  let earnedWeight = 0;
  const metCount = requirements.filter((r) => r.status === 'met').length;
  const partialCount = requirements.filter((r) => r.status === 'partial').length;
  const missingCount = requirements.filter((r) => r.status === 'missing').length;

  for (const req of requirements) {
    const weight = req.type === 'must' ? 2 : 1;
    totalWeight += weight;

    if (req.status === 'met') {
      earnedWeight += weight * 1.0;
    } else if (req.status === 'partial') {
      earnedWeight += weight * 0.5;
    }
  }

  const score = totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 100) : 50;
  const evidence = `Evidenced ${metCount} of ${requirements.length} requirements in actual work/projects; ${partialCount} listed without proof, ${missingCount} unaddressed.`;

  return { score, evidence };
}

/**
 * 2. Proof Strength Computation (Rule-based on Resume tree):
 * Counts bullets with quantified metrics, deployed links / repos, and professional work/internships vs coursework.
 * Caps at 60 if no bullet has verifiable metrics or links.
 */
export function computeProofStrength(resume: Resume): { score: number; evidence: string } {
  const allBullets = [
    ...(resume.experience?.flatMap((e) => e.bullets || []) || []),
    ...(resume.projects?.flatMap((p) => p.bullets || []) || []),
  ];

  // Regex patterns for quantified outcomes and links
  const metricPattern = /\b\d+([.,]\d+)?\s*(%|x|ms|s|users|req\/s|rps|queries|lpa|k|mb|gb|stars|commits)\b|\b\d{2,}\b/i;
  const linkPattern = /https?:\/\/|github\.com|gitlab\.com|\.vercel\.app|\.app|\.dev|\.io|\.com\b/i;

  let metricBullets = 0;
  for (const b of allBullets) {
    if (metricPattern.test(b.text)) {
      metricBullets++;
    }
  }

  // Links in contact links or project bullets
  const contactLinks = resume.contact?.links?.length || 0;
  let projectLinks = 0;
  for (const b of allBullets) {
    if (linkPattern.test(b.text)) projectLinks++;
  }
  const totalLinks = contactLinks + projectLinks;

  const internships = resume.experience?.length || 0;
  const projects = resume.projects?.length || 0;

  // Base score from demonstrated work
  let rawScore = 20; // base for completing a resume
  rawScore += Math.min(internships * 15, 30); // up to 30 for internships
  rawScore += Math.min(projects * 8, 16); // up to 16 for projects
  rawScore += Math.min(metricBullets * 8, 24); // up to 24 for metrics
  rawScore += Math.min(totalLinks * 5, 10); // up to 10 for verifiable links

  const hasVerifiableProof = metricBullets > 0 || totalLinks > 0;
  const score = hasVerifiableProof ? Math.min(Math.round(rawScore), 100) : Math.min(Math.round(rawScore), 50);

  const evidence = hasVerifiableProof
    ? `${internships} work/internship experience(s), ${projects} project(s), ${metricBullets} quantified bullet metric(s), and ${totalLinks} public repository/artifact link(s).`
    : `No measurable metrics or verifiable project links found across ${allBullets.length} bullet points (capped at 50).`;

  return { score, evidence };
}

/**
 * 3. Level Fit Computation:
 * Compute ONLY from years_required vs candidate's commercial experience years.
 * Fresher-friendly roles (years_required === 0 or isFresherRole) score 95 for anyone with no commercial experience.
 * Does not penalize skills or invent requirements.
 */
export function computeLevelFit(
  resume: Resume,
  yearsRequired: number,
  isFresherRole: boolean
): { score: number; evidence: string } {
  const internships = resume.experience?.length || 0;
  const candidateYears = Math.min(internships * 0.35, 1.5);

  let score = 50;
  let evidence = '';

  if (isFresherRole || yearsRequired === 0) {
    // A fresher role welcomes 0-experience candidates without penalty!
    score = 95;
    evidence =
      internships > 0
        ? `Fresher-friendly entry-level role matches candidate profile (${internships} prior internship(s)).`
        : `Fresher-friendly entry-level role perfectly accommodates 0 years required experience.`;
  } else {
    const gap = yearsRequired - candidateYears;
    if (gap <= 0) {
      score = 95;
      evidence = `Candidate meets or exceeds stated ${yearsRequired} year(s) commercial requirement (~${candidateYears.toFixed(1)} yr experience).`;
    } else if (gap <= 1) {
      score = 65;
      evidence = `Close level alignment: role requests ${yearsRequired} yr(s), candidate presents ~${candidateYears.toFixed(1)} yr(s) internship history.`;
    } else if (gap <= 2) {
      score = 40;
      evidence = `Experience deficit: role asks for ${yearsRequired}+ years; candidate has ~${candidateYears.toFixed(1)} yr commercial history.`;
    } else {
      score = 20;
      evidence = `Significant seniority mismatch: position mandates ${yearsRequired}+ years commercial experience.`;
    }
  }

  return { score, evidence };
}

/**
 * 4. Application Quality Computation (Rules only, no JD keyword overlap):
 * Checks contact info, sensible bullet counts, and action verb starts.
 * Grade application quality on:
 * - Contact completeness: up to 25
 * - Action verb openers: up to 25
 * - Bullet depth & structure: up to 25
 */
export function computeApplicationQuality(
  resume: Resume
): { score: number; evidence: string } {
  let score = 10; // Base starting anchor
  const checks: string[] = [];

  // Contact info check (up to 25)
  if (resume.contact?.email && resume.contact?.name) {
    score += 15;
    if (resume.contact.links && resume.contact.links.length > 0) {
      score += 10;
      checks.push('complete contact & portfolio links');
    } else {
      checks.push('contact email/name present');
    }
  }

  const allBullets = [
    ...(resume.experience?.flatMap((e) => e.bullets || []) || []),
    ...(resume.projects?.flatMap((p) => p.bullets || []) || []),
  ];

  // Action verb starts (up to 25)
  const actionVerbPattern = /^(built|developed|architected|engineered|created|implemented|designed|led|lead|spearheaded|deployed|integrated|optimized|automated|managed|resolved|refactored|reduced|increased|improved|executed|tested)\b/i;
  const verbStarts = allBullets.filter((b) => actionVerbPattern.test(b.text.trim())).length;
  const verbRatio = allBullets.length > 0 ? verbStarts / allBullets.length : 0;

  if (verbRatio >= 0.7) {
    score += 25;
    checks.push('strong action-verb openers');
  } else if (verbRatio >= 0.4) {
    score += 15;
    checks.push('moderate action-verb openers');
  } else if (verbRatio > 0) {
    score += 5;
  }

  // Bullet depth check (up to 25)
  if (allBullets.length >= 6) {
    score += 25;
    checks.push('substantial work/project bullet depth');
  } else if (allBullets.length >= 4) {
    score += 15;
    checks.push('moderate bullet depth');
  } else if (allBullets.length >= 2) {
    score += 5;
    checks.push('initial bullet depth');
  }

  score = Math.min(Math.max(score, 10), 100);
  const evidence = `Application presentation scored on professional formatting and depth: ${checks.join(', ')}.`;

  return { score, evidence };
}

/**
 * Final Weighted Odds Calculation:
 * skill*0.30 + proof*0.20 + level*0.20 + domain*0.15 + application*0.15
 * Band: <35 Long shot, 35-64 Fair, >=65 Strong
 */
export function computeOdds(
  factors: FactorInputs,
  topGaps: string[],
  oneChange: string,
  confidence: 'Low' | 'Medium' | 'High'
): OddsResult {
  const weighted =
    factors.skill_coverage.score * 0.30 +
    factors.proof_strength.score * 0.20 +
    factors.level_fit.score * 0.20 +
    factors.domain_relevance.score * 0.15 +
    factors.application_quality.score * 0.15;

  const finalScore = Math.round(weighted);

  let band: 'Long shot' | 'Fair' | 'Strong' = 'Fair';
  if (finalScore < 35) {
    band = 'Long shot';
  } else if (finalScore >= 65) {
    band = 'Strong';
  }

  return {
    band,
    factors,
    weighted_score: finalScore,
    top_gaps: topGaps.slice(0, 3),
    one_change_to_move_up: oneChange,
    confidence,
  };
}
