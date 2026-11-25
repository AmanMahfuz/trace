// src/lib/planner.ts
// Pure-function "This week" planner. No AI. Deterministic. Max 3 items. Testable.

export type WeekItemKind =
  | 'deadline'       // date within 7 days
  | 'overdue-log'    // applied 14+ days, no outcome logged
  | 'prep-stage'     // upcoming stage that has a practice mode
  | 'proof-gap'      // top gap on most promising application
  | 'triage';        // "not eligible by stated criteria, consider dropping"

export interface WeekItem {
  kind: WeekItemKind;
  applicationId: string;
  title: string;
  reason: string;
  cta: string;
  href: string;
  priority: number; // lower = higher priority, used for sort
}

export interface ApplicationForPlanner {
  id: string;
  status: string;
  outcome?: string | null;
  outcome_at?: string | null;
  created_at: string;
  applied_at?: string | null; // when status changed to 'applied'
  jobs?: {
    title?: string;
    company?: string;
  };
  odds?: { band?: string; weighted_score?: number } | null;
  eligibility?: Array<{ status: string }> | null;
  eligibility_skipped?: boolean;
  process_stages?: {
    stages?: Array<{
      status: 'done' | 'current' | 'upcoming' | 'locked';
      name: string;
      date?: string | null;
      practiceMode?: string | null;
    }>;
  } | null;
  top_gap?: string | null;
}

function roleName(app: ApplicationForPlanner): string {
  if (app.jobs?.title && app.jobs?.company) {
    return `${app.jobs.title} at ${app.jobs.company}`;
  }
  return app.jobs?.title ?? app.jobs?.company ?? 'this application';
}

function daysAgo(dateStr: string): number {
  const ms = Date.now() - new Date(dateStr).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function daysFromNow(dateStr: string): number {
  const ms = new Date(dateStr).getTime() - Date.now();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

const PRACTICE_MODE_LABELS: Record<string, string> = {
  'self-intro': 'self-introduction',
  'project-deepdive': 'project deep-dive',
  'hr': 'HR round',
  'full-round': 'full round',
};

/**
 * Returns up to 3 WeekItems in priority order.
 * Priority rules (strict):
 *  1. Dates within 7 days (test, interview, deadline), soonest first
 *  2. Overdue outcome logs (applied 14+ days, nothing logged)
 *  3. Prep for next stage (upcoming stage with a practiceMode)
 *  4. Biggest proof or resume gap on most promising application
 *  5. Triage: "not eligible by stated criteria" when nothing else fills slots
 *
 * One item per application maximum.
 * Never repeat a finished item.
 * Never return empty filler — if nothing qualifies, returns [].
 */
export function planThisWeek(applications: ApplicationForPlanner[]): WeekItem[] {
  const items: WeekItem[] = [];
  const usedAppIds = new Set<string>();

  const openApps = applications.filter(
    a => a.status !== 'closed' && !a.outcome
  );

  // ── Priority 1: Upcoming dates within 7 days ──
  const withDates: Array<{ app: ApplicationForPlanner; stage: NonNullable<NonNullable<ApplicationForPlanner['process_stages']>['stages']>[number]; daysLeft: number }> = [];

  for (const app of openApps) {
    const stages = app.process_stages?.stages ?? [];
    for (const stage of stages) {
      if (stage.date && stage.status !== 'done') {
        const days = daysFromNow(stage.date);
        if (days >= 0 && days <= 7) {
          withDates.push({ app, stage, daysLeft: days });
        }
      }
    }
  }

  // Sort soonest first
  withDates.sort((a, b) => a.daysLeft - b.daysLeft);

  for (const { app, stage, daysLeft } of withDates) {
    if (items.length >= 3) break;
    if (usedAppIds.has(app.id)) continue;

    const when = daysLeft === 0 ? 'today' : daysLeft === 1 ? 'tomorrow' : `in ${daysLeft} days`;
    items.push({
      kind: 'deadline',
      applicationId: app.id,
      title: `${stage.name} — ${when}`,
      reason: `${stage.date ? new Date(stage.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''} · ${roleName(app)}`,
      cta: 'Practice →',
      href: `/practice?application=${app.id}&mode=${stage.practiceMode ?? 'self-intro'}`,
      priority: daysLeft,
    });
    usedAppIds.add(app.id);
  }

  // ── Priority 2: Overdue outcome logs ──
  const appliedApps = applications.filter(
    a =>
      !usedAppIds.has(a.id) &&
      (a.status === 'applied' || a.outcome === 'applied') &&
      !a.outcome_at
  );

  for (const app of appliedApps) {
    if (items.length >= 3) break;

    const appliedDate = app.applied_at ?? app.created_at;
    const days = daysAgo(appliedDate);
    if (days >= 14) {
      items.push({
        kind: 'overdue-log',
        applicationId: app.id,
        title: `Log what happened with ${app.jobs?.company ?? 'this application'}`,
        reason: `Applied ${days} days ago · no update logged`,
        cta: 'Log outcome →',
        href: `/dashboard`,
        priority: 100 + days, // further back = higher urgency within this tier
      });
      usedAppIds.add(app.id);
    }
  }

  // ── Priority 3: Prep for next stage ──
  // Pick the application with the highest odds score that has an upcoming stage with a practiceMode
  const withNextStage = openApps
    .filter(a => !usedAppIds.has(a.id))
    .flatMap(app => {
      const stages = app.process_stages?.stages ?? [];
      const nextStage = stages.find(s => s.status === 'upcoming' || s.status === 'current');
      if (!nextStage?.practiceMode) return [];
      return [{ app, stage: nextStage, score: app.odds?.weighted_score ?? 0 }];
    })
    .sort((a, b) => b.score - a.score);

  for (const { app, stage } of withNextStage) {
    if (items.length >= 3) break;
    const modeLabel = PRACTICE_MODE_LABELS[stage.practiceMode!] ?? stage.practiceMode!;
    items.push({
      kind: 'prep-stage',
      applicationId: app.id,
      title: `Practice your ${modeLabel}`,
      reason: `${stage.name} coming up · ${app.jobs?.company ?? 'next role'}`,
      cta: 'Start →',
      href: `/practice?application=${app.id}&mode=${stage.practiceMode}`,
      priority: 200,
    });
    usedAppIds.add(app.id);
  }

  // ── Priority 4: Biggest proof gap on most promising application ──
  const withGap = openApps
    .filter(a => !usedAppIds.has(a.id) && a.top_gap)
    .sort((a, b) => (b.odds?.weighted_score ?? 0) - (a.odds?.weighted_score ?? 0));

  for (const app of withGap) {
    if (items.length >= 3) break;
    items.push({
      kind: 'proof-gap',
      applicationId: app.id,
      title: app.top_gap!,
      reason: `Top gap on ${roleName(app)}`,
      cta: 'View →',
      href: `/prep/${app.id}`,
      priority: 300,
    });
    usedAppIds.add(app.id);
  }

  // ── Priority 5: Triage (only when slots still open) ──
  if (items.length < 3) {
    const ineligible = openApps.filter(a => {
      if (usedAppIds.has(a.id)) return false;
      if (!a.eligibility || a.eligibility_skipped) return false;
      return a.eligibility.some((e: { status: string }) => e.status === 'not-eligible');
    });

    for (const app of ineligible) {
      if (items.length >= 3) break;
      items.push({
        kind: 'triage',
        applicationId: app.id,
        title: `Not eligible by stated criteria for ${app.jobs?.company ?? 'this role'}`,
        reason: 'Consider dropping this application',
        cta: 'Review →',
        href: `/prep/${app.id}`,
        priority: 400,
      });
      usedAppIds.add(app.id);
    }
  }

  return items.slice(0, 3);
}
