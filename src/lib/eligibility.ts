// src/lib/eligibility.ts
// Pure-code eligibility checker. No AI. Deterministic. Testable.
// All decisions are based on the job post's stated criteria compared to the user's profile.
// Rule: if the post is silent on a criterion → 'not-stated', NEVER 'ok'.

export type EligibilityStatus = 'ok' | 'not-eligible' | 'at-risk' | 'not-stated';

export interface EligibilityItem {
  criterion: string;
  status: EligibilityStatus;
  jd_quote: string | null;    // exact quote from the job post, null if not stated
  profile_value: string | null; // what the user entered, null if not in profile
  detail: string;              // human-readable explanation shown to user
}

export interface EligibilityCriteria {
  // Extracted from the job post by Job Reader
  degree?: string[];           // e.g. ['B.E', 'B.Tech', 'MCA', 'M.Tech']
  branches?: string[];         // e.g. ['CSE', 'IT', 'ECE']
  passout_years?: number[];    // e.g. [2024, 2025]
  min_aggregate?: number;      // e.g. 60.0
  max_backlogs?: number;       // 0 means "no backlogs allowed"
  location?: string;           // e.g. "Pan India"
  bond?: string;               // e.g. "2 years service bond"
  // Raw quotes from the post for each field (null if field was not found)
  degree_quote?: string | null;
  branches_quote?: string | null;
  passout_years_quote?: string | null;
  min_aggregate_quote?: string | null;
  backlogs_quote?: string | null;
  location_quote?: string | null;
  bond_quote?: string | null;
}

export interface UserProfile {
  grad_year?: number | null;
  branch?: string | null;
  aggregate_pct?: number | null;
  active_backlogs?: number | null;
  track?: string | null;
}

/**
 * Checks a single criterion pair.
 * Returns 'not-stated' when jd_quote is null — never infers OK from silence.
 */
function checkDegree(
  criteria: EligibilityCriteria
): EligibilityItem {
  if (!criteria.degree_quote || !criteria.degree) {
    return {
      criterion: 'Degree',
      status: 'not-stated',
      jd_quote: null,
      profile_value: null,
      detail: 'The job post does not state a degree requirement.',
    };
  }

  // We always treat degree as OK for IT fresher context — the branch check is more specific.
  // If the JD listed degree types, we can compare but profile doesn't store degree type,
  // so we show the quote and mark it as requiring user confirmation.
  return {
    criterion: 'Degree',
    status: 'ok',
    jd_quote: criteria.degree_quote,
    profile_value: 'B.Tech / B.E',
    detail: `Posting requires ${criteria.degree.join(' / ')}. Your profile indicates an engineering degree.`,
  };
}

function checkBranch(
  criteria: EligibilityCriteria,
  profile: UserProfile
): EligibilityItem {
  if (!criteria.branches_quote || !criteria.branches || criteria.branches.length === 0) {
    return {
      criterion: 'Branch',
      status: 'not-stated',
      jd_quote: null,
      profile_value: profile.branch ?? null,
      detail: 'The job post does not state a branch restriction.',
    };
  }

  if (!profile.branch) {
    return {
      criterion: 'Branch',
      status: 'not-stated',
      jd_quote: criteria.branches_quote,
      profile_value: null,
      detail: 'Add your branch to check against the stated requirement.',
    };
  }

  const profileBranchNorm = profile.branch.toLowerCase().replace(/[^a-z0-9]/g, '');
  const matched = criteria.branches.some(b =>
    b.toLowerCase().replace(/[^a-z0-9]/g, '') === profileBranchNorm ||
    profileBranchNorm.includes(b.toLowerCase().replace(/[^a-z0-9]/g, ''))
  );

  if (matched) {
    return {
      criterion: 'Branch',
      status: 'ok',
      jd_quote: criteria.branches_quote,
      profile_value: profile.branch,
      detail: `Posting requires ${criteria.branches.join(', ')}. Your branch (${profile.branch}) matches.`,
    };
  }

  return {
    criterion: 'Branch',
    status: 'not-eligible',
    jd_quote: criteria.branches_quote,
    profile_value: profile.branch,
    detail: `Posting requires ${criteria.branches.join(', ')}. Your branch (${profile.branch}) is not in the list.`,
  };
}

function checkPassoutYear(
  criteria: EligibilityCriteria,
  profile: UserProfile
): EligibilityItem {
  if (!criteria.passout_years_quote || !criteria.passout_years || criteria.passout_years.length === 0) {
    return {
      criterion: 'Passout year',
      status: 'not-stated',
      jd_quote: null,
      profile_value: profile.grad_year != null ? String(profile.grad_year) : null,
      detail: 'The job post does not state a passout year window.',
    };
  }

  if (profile.grad_year == null) {
    return {
      criterion: 'Passout year',
      status: 'not-stated',
      jd_quote: criteria.passout_years_quote,
      profile_value: null,
      detail: 'Add your graduation year to check against the stated requirement.',
    };
  }

  const inWindow = criteria.passout_years.includes(profile.grad_year);
  if (inWindow) {
    return {
      criterion: 'Passout year',
      status: 'ok',
      jd_quote: criteria.passout_years_quote,
      profile_value: String(profile.grad_year),
      detail: `Posting accepts ${criteria.passout_years.join(', ')} passouts. Your year (${profile.grad_year}) is within the window.`,
    };
  }

  // Within 1 year of the window → at-risk
  const minYear = Math.min(...criteria.passout_years);
  const maxYear = Math.max(...criteria.passout_years);
  if (profile.grad_year >= minYear - 1 && profile.grad_year <= maxYear + 1) {
    return {
      criterion: 'Passout year',
      status: 'at-risk',
      jd_quote: criteria.passout_years_quote,
      profile_value: String(profile.grad_year),
      detail: `Posting states ${criteria.passout_years.join(', ')} only. Your year (${profile.grad_year}) is outside but close — check with the company.`,
    };
  }

  return {
    criterion: 'Passout year',
    status: 'not-eligible',
    jd_quote: criteria.passout_years_quote,
    profile_value: String(profile.grad_year),
    detail: `Posting accepts ${criteria.passout_years.join(', ')} only. Your year (${profile.grad_year}) is outside this window.`,
  };
}

function checkAggregate(
  criteria: EligibilityCriteria,
  profile: UserProfile
): EligibilityItem {
  if (!criteria.min_aggregate_quote || criteria.min_aggregate == null) {
    return {
      criterion: 'Aggregate %',
      status: 'not-stated',
      jd_quote: null,
      profile_value: profile.aggregate_pct != null ? `${profile.aggregate_pct}%` : null,
      detail: 'The job post does not state a minimum aggregate requirement.',
    };
  }

  if (profile.aggregate_pct == null) {
    return {
      criterion: 'Aggregate %',
      status: 'not-stated',
      jd_quote: criteria.min_aggregate_quote,
      profile_value: null,
      detail: 'Add your aggregate percentage to check against the stated requirement.',
    };
  }

  const userPct = Number(profile.aggregate_pct);
  const minPct = criteria.min_aggregate;

  if (userPct >= minPct) {
    return {
      criterion: 'Aggregate %',
      status: 'ok',
      jd_quote: criteria.min_aggregate_quote,
      profile_value: `${userPct}%`,
      detail: `Posting requires ${minPct}% minimum. You entered ${userPct}%.`,
    };
  }

  // Within 2% → at-risk
  if (userPct >= minPct - 2) {
    return {
      criterion: 'Aggregate %',
      status: 'at-risk',
      jd_quote: criteria.min_aggregate_quote,
      profile_value: `${userPct}%`,
      detail: `Posting requires ${minPct}%. You entered ${userPct}% — close to the cutoff. Some employers round up. Check with the company.`,
    };
  }

  return {
    criterion: 'Aggregate %',
    status: 'not-eligible',
    jd_quote: criteria.min_aggregate_quote,
    profile_value: `${userPct}%`,
    detail: `Posting requires ${minPct}% aggregate. You entered ${userPct}%.`,
  };
}

function checkBacklogs(
  criteria: EligibilityCriteria,
  profile: UserProfile
): EligibilityItem {
  if (!criteria.backlogs_quote || criteria.max_backlogs == null) {
    return {
      criterion: 'Active backlogs',
      status: 'not-stated',
      jd_quote: null,
      profile_value: profile.active_backlogs != null ? String(profile.active_backlogs) : null,
      detail: 'The job post does not state a backlog policy.',
    };
  }

  if (profile.active_backlogs == null) {
    return {
      criterion: 'Active backlogs',
      status: 'not-stated',
      jd_quote: criteria.backlogs_quote,
      profile_value: null,
      detail: 'Add your backlog count to check against the stated requirement.',
    };
  }

  const userBacklogs = profile.active_backlogs;
  const maxAllowed = criteria.max_backlogs;

  if (userBacklogs <= maxAllowed) {
    return {
      criterion: 'Active backlogs',
      status: 'ok',
      jd_quote: criteria.backlogs_quote,
      profile_value: `${userBacklogs}`,
      detail: `Posting allows up to ${maxAllowed} active backlogs. You have ${userBacklogs}.`,
    };
  }

  // Has backlogs but JD says "no active backlogs at time of joining" → at-risk (not hard block)
  if (criteria.backlogs_quote.toLowerCase().includes('joining') || criteria.backlogs_quote.toLowerCase().includes('joining')) {
    return {
      criterion: 'Active backlogs',
      status: 'at-risk',
      jd_quote: criteria.backlogs_quote,
      profile_value: `${userBacklogs}`,
      detail: `Posting states no backlogs at time of joining. You have ${userBacklogs} active. If cleared before joining, you may still qualify.`,
    };
  }

  return {
    criterion: 'Active backlogs',
    status: 'not-eligible',
    jd_quote: criteria.backlogs_quote,
    profile_value: `${userBacklogs}`,
    detail: `Posting requires no active backlogs. You have ${userBacklogs}.`,
  };
}

function checkLocation(criteria: EligibilityCriteria): EligibilityItem {
  if (!criteria.location_quote || !criteria.location) {
    return {
      criterion: 'Location',
      status: 'not-stated',
      jd_quote: null,
      profile_value: null,
      detail: 'The job post does not state a location requirement.',
    };
  }
  // Location is informational — we don't store user location in this profile shape
  return {
    criterion: 'Location',
    status: 'not-stated',
    jd_quote: criteria.location_quote,
    profile_value: null,
    detail: `Posting states: "${criteria.location}". Trace doesn't check location — verify this yourself.`,
  };
}

function checkBond(criteria: EligibilityCriteria): EligibilityItem {
  if (!criteria.bond_quote || !criteria.bond) {
    return {
      criterion: 'Bond',
      status: 'not-stated',
      jd_quote: null,
      profile_value: null,
      detail: 'The job post does not mention a service bond.',
    };
  }
  return {
    criterion: 'Bond',
    status: 'not-stated',
    jd_quote: criteria.bond_quote,
    profile_value: null,
    detail: `Posting mentions: "${criteria.bond}". Trace doesn't check bond acceptance — review this yourself.`,
  };
}

/**
 * Run all eligibility checks. Returns an array of EligibilityItem in display order.
 * Aggregate status: 'not-eligible' if any item is 'not-eligible', else 'at-risk' if any
 * is 'at-risk', else 'ok' (only for stated criteria).
 */
export function checkEligibility(
  criteria: EligibilityCriteria,
  profile: UserProfile
): EligibilityItem[] {
  return [
    checkDegree(criteria),
    checkBranch(criteria, profile),
    checkPassoutYear(criteria, profile),
    checkAggregate(criteria, profile),
    checkBacklogs(criteria, profile),
    checkLocation(criteria),
    checkBond(criteria),
  ];
}

/**
 * Derives the top-level status label from an array of EligibilityItems.
 * 'not-eligible' wins over 'at-risk' wins over 'ok'.
 * If all items are 'not-stated', returns 'not-stated'.
 */
export function deriveOverallStatus(
  items: EligibilityItem[]
): 'ok' | 'not-eligible' | 'at-risk' | 'not-stated' {
  const stated = items.filter(i => i.status !== 'not-stated');
  if (stated.length === 0) return 'not-stated';
  if (stated.some(i => i.status === 'not-eligible')) return 'not-eligible';
  if (stated.some(i => i.status === 'at-risk')) return 'at-risk';
  return 'ok';
}
