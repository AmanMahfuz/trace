import { GhostResult } from './schemas';

export interface GhostEvaluationInput {
  raw_text: string;
  date_posted?: Date | null;
  valid_through?: Date | null;
  is_repost?: boolean;
}

/**
 * Rule-based ghost job detector:
 * Signals:
 * 1. Posted >30 days ago
 * 2. Same jd_hash seen before (repost)
 * 3. validThrough is in the past
 * 4. No salary AND no location specified
 * 5. Evergreen recruitment wording ("talent pool", "always hiring", "pipeline", etc.)
 * 6. No team or manager named (pure generic recruiter bullet list without team context)
 * 7. Fresher / entry-level role demanding 3+ years experience
 *
 * Scoring:
 * 0 - 1 signals = Low
 * 2 signals     = Medium
 * 3+ signals    = High
 */
export function evaluateGhostRisk(input: GhostEvaluationInput): GhostResult {
  const signals: string[] = [];
  const textLower = input.raw_text.toLowerCase();

  // 1. Posted >30 days ago
  if (input.date_posted) {
    const ageDays = (Date.now() - new Date(input.date_posted).getTime()) / (1000 * 3600 * 24);
    if (ageDays > 30) {
      signals.push(`Posted ${Math.floor(ageDays)} days ago (stale opening)`);
    }
  }

  // 2. Same jd_hash seen before
  if (input.is_repost) {
    signals.push('Posting hash has been cycled previously across tracked boards');
  }

  // 3. validThrough in the past
  if (input.valid_through && new Date(input.valid_through).getTime() < Date.now()) {
    signals.push('Posting validity timestamp has already expired');
  }

  // 4. No salary AND no location
  const hasSalary = /\$|₹|£|€|\b(salary|inr|usd|eur|stipend|ctc|lpa|compensation|pay rate|per hour|\/hr|\/year)\b/.test(
    textLower
  );
  const hasLocation = /\b(remote|hybrid|on-site|onsite|location|based in|bangalore|bengaluru|delhi|mumbai|pune|hyderabad|chennai|london|new york|san francisco|austin|seattle|singapore)\b/.test(
    textLower
  );

  if (!hasSalary && !hasLocation) {
    signals.push('Omitted both geographic location and compensation ranges');
  }

  // 5. Evergreen recruitment wording
  const evergreenTerms = [
    'talent pool',
    'always hiring',
    'future opportunities',
    'general application',
    'pipeline',
    'ongoing recruitment',
    'talent community',
    'prospective candidates',
  ];
  for (const term of evergreenTerms) {
    if (textLower.includes(term)) {
      signals.push(`Contains evergreen recruitment wording: "${term}"`);
      break;
    }
  }

  // 6. No team or manager named (e.g. "reports to", "our team", "hiring manager", "engineering manager", "lead by")
  const mentionsTeamOrManager = /\b(reports to|reporting to|our team|engineering manager|hiring manager|product manager|team lead|tech lead|work closely with the)\b/.test(
    textLower
  );
  if (!mentionsTeamOrManager) {
    signals.push('No specific team, manager, or reporting structure named');
  }

  // 7. Fresher / entry-level AND 3+ years experience
  const hasFresherTag = /\b(fresher|entry-level|entry level|intern|internship|college|graduate|junior|0-1 years|0-2 years)\b/.test(
    textLower
  );
  const requiresHighExp = /\b([3-9]|1[0-9])\+?\s*(years|yrs)\s*(of\s+)?experience\b/.test(textLower);

  if (hasFresherTag && requiresHighExp) {
    signals.push('Contradictory requirements: labeled entry-level/fresher but mandates 3+ years experience');
  }

  // Severity Level
  let level: 'Low' | 'Medium' | 'High' = 'Low';
  if (signals.length >= 3) {
    level = 'High';
  } else if (signals.length === 2) {
    level = 'Medium';
  }

  return { level, signals };
}
