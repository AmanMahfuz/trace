'use client';

import React, { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/design-system/primitives/Button';
import { Chip } from '@/design-system/primitives/Chip';
import {
  checkEligibility,
  deriveOverallStatus,
  EligibilityCriteria,
  EligibilityItem,
  EligibilityStatus,
  UserProfile,
} from '@/lib/eligibility';
import { ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';

interface EligibilitySectionProps {
  applicationId: string;
  criteria: EligibilityCriteria | null; // null = Job Reader didn't extract any criteria
  initialProfile: UserProfile | null;
  initialSkipped?: boolean;
  initialResults?: EligibilityItem[] | null;
}

type SectionState = 'empty' | 'form-open' | 'results' | 'skipped';

function statusToVariant(status: EligibilityStatus) {
  switch (status) {
    case 'ok':          return 'strong' as const;
    case 'not-eligible': return 'risk' as const;
    case 'at-risk':     return 'caution' as const;
    case 'not-stated':  return 'neutral' as const;
  }
}

function statusLabel(status: EligibilityStatus) {
  switch (status) {
    case 'ok':           return '✓ OK';
    case 'not-eligible': return 'Not eligible';
    case 'at-risk':      return 'At risk';
    case 'not-stated':   return 'Not stated';
  }
}

function overallLabel(status: ReturnType<typeof deriveOverallStatus>) {
  switch (status) {
    case 'ok':           return '✓ Eligible by stated criteria';
    case 'not-eligible': return 'Not eligible by the stated criteria';
    case 'at-risk':      return 'At risk — check the criteria';
    case 'not-stated':   return 'No criteria stated in this post';
  }
}

function overallVariant(status: ReturnType<typeof deriveOverallStatus>) {
  switch (status) {
    case 'ok':           return 'strong' as const;
    case 'not-eligible': return 'risk' as const;
    case 'at-risk':      return 'caution' as const;
    case 'not-stated':   return 'neutral' as const;
  }
}

const GRAD_YEARS = [2023, 2024, 2025, 2026, 2027, 2028];
const BRANCHES = [
  'B.Tech CSE', 'B.Tech IT', 'B.Tech ECE', 'B.Tech EEE', 'B.Tech Mechanical',
  'B.Tech Civil', 'B.E CSE', 'B.E IT', 'B.E ECE', 'MCA', 'M.Tech CSE', 'M.Tech IT', 'Other',
];

export function EligibilitySection({
  applicationId,
  criteria,
  initialProfile,
  initialSkipped = false,
  initialResults = null,
}: EligibilitySectionProps) {
  const supabase = createClient();

  const [sectionState, setSectionState] = useState<SectionState>(() => {
    if (initialResults) return 'results';
    if (initialSkipped) return 'skipped';
    if (!initialProfile?.grad_year) return 'empty';
    return 'results';
  });

  const [gradYear, setGradYear] = useState(initialProfile?.grad_year ?? '');
  const [branch, setBranch] = useState(initialProfile?.branch ?? '');
  const [aggregatePct, setAggregatePct] = useState(initialProfile?.aggregate_pct ?? '');
  const [activeBacklogs, setActiveBacklogs] = useState(initialProfile?.active_backlogs ?? 0);
  const [saving, setSaving] = useState(false);
  const [results, setResults] = useState<EligibilityItem[] | null>(initialResults);
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [correctionTarget, setCorrectionTarget] = useState<string | null>(null);

  const overallStatus = results ? deriveOverallStatus(results) : null;

  async function saveProfileAndCheck() {
    if (!gradYear || !branch) return;
    setSaving(true);

    const profile: UserProfile = {
      grad_year: Number(gradYear),
      branch: String(branch),
      aggregate_pct: aggregatePct !== '' ? Number(aggregatePct) : null,
      active_backlogs: Number(activeBacklogs),
    };

    // Save to profiles table
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('profiles').upsert({
        id: user.id,
        grad_year: profile.grad_year,
        branch: profile.branch,
        aggregate_pct: profile.aggregate_pct,
        active_backlogs: profile.active_backlogs,
      }, { onConflict: 'id' });
    }

    // Run pure-code check
    const checkedCriteria = criteria ?? {};
    const items = checkEligibility(checkedCriteria, profile);

    // Persist eligibility result to this application
    await supabase.from('applications').update({
      eligibility: items,
      eligibility_skipped: false,
    }).eq('id', applicationId);

    setResults(items);
    setSectionState('results');
    setSaving(false);
  }

  async function skip() {
    await supabase.from('applications').update({ eligibility_skipped: true }).eq('id', applicationId);
    setSectionState('skipped');
  }

  return (
    <section aria-labelledby="elig-heading" className="border-t border-border-subtle pt-[--space-stack-lg]">
      {/* Section header */}
      <div className="flex items-baseline justify-between mb-[--space-stack-sm]">
        <div>
          <p className="text-eyebrow uppercase tracking-widest text-content-tertiary mb-[--space-stack-xs]">
            Eligibility
          </p>
          <h2 id="elig-heading" className="text-heading-3 text-content-primary flex items-center gap-3 flex-wrap">
            Can you apply?
            {overallStatus && sectionState === 'results' && (
              <Chip label={overallLabel(overallStatus)} variant={overallVariant(overallStatus)} />
            )}
          </h2>
        </div>
        {sectionState === 'results' && (
          <button
            onClick={() => setSectionState('form-open')}
            className="text-small text-content-tertiary hover:text-content-secondary transition-colors"
          >
            Edit details
          </button>
        )}
      </div>

      {/* ── State: empty — prompt ── */}
      {sectionState === 'empty' && (
        <div className="flex items-center justify-between gap-4 p-[--space-stack-md] bg-surface-sunken border border-border-subtle rounded-[--radius-md]">
          <p className="text-small text-content-secondary">
            Add 4 details to check if you&apos;re eligible for this role.
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <Button size="compact" onClick={() => setSectionState('form-open')}>
              Add details
            </Button>
            <button
              onClick={skip}
              className="text-small text-content-tertiary hover:text-content-secondary transition-colors px-2 py-1"
            >
              Skip
            </button>
          </div>
        </div>
      )}

      {/* ── State: form-open ── */}
      {sectionState === 'form-open' && (
        <div className="p-[--space-stack-md] bg-surface-sunken border border-border-subtle rounded-[--radius-md]">
          <p className="text-small font-medium text-content-secondary mb-[--space-stack-sm]">
            Your details — saved to your profile
          </p>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <label className="flex flex-col gap-1">
              <span className="text-eyebrow uppercase tracking-widest text-content-tertiary">Graduation year</span>
              <select
                value={gradYear}
                onChange={e => setGradYear(Number(e.target.value))}
                className="h-8 px-2.5 border border-border-control rounded-[--radius-md] text-small text-content-primary bg-surface-raised focus:outline-action-primary"
              >
                <option value="">Select…</option>
                {GRAD_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-eyebrow uppercase tracking-widest text-content-tertiary">Branch</span>
              <select
                value={branch}
                onChange={e => setBranch(e.target.value)}
                className="h-8 px-2.5 border border-border-control rounded-[--radius-md] text-small text-content-primary bg-surface-raised focus:outline-action-primary"
              >
                <option value="">Select…</option>
                {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-[--space-stack-sm]">
            <label className="flex flex-col gap-1">
              <span className="text-eyebrow uppercase tracking-widest text-content-tertiary">Aggregate %</span>
              <input
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={aggregatePct}
                onChange={e => setAggregatePct(e.target.value)}
                placeholder="e.g. 72.5"
                className="h-8 px-2.5 border border-border-control rounded-[--radius-md] text-small text-content-primary bg-surface-raised focus:outline-action-primary"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-eyebrow uppercase tracking-widest text-content-tertiary">Active backlogs</span>
              <select
                value={activeBacklogs}
                onChange={e => setActiveBacklogs(Number(e.target.value))}
                className="h-8 px-2.5 border border-border-control rounded-[--radius-md] text-small text-content-primary bg-surface-raised focus:outline-action-primary"
              >
                <option value={0}>0 (none)</option>
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3+</option>
              </select>
            </label>
          </div>

          <div className="flex items-center gap-3">
            <Button
              size="compact"
              loading={saving}
              disabled={!gradYear || !branch}
              onClick={saveProfileAndCheck}
            >
              Check eligibility
            </Button>
            <button
              onClick={skip}
              className="text-small text-content-tertiary hover:text-content-secondary transition-colors"
            >
              Skip for now
            </button>
          </div>
        </div>
      )}

      {/* ── State: results ── */}
      {sectionState === 'results' && results && (
        <>
          {/* Collapsed view when all OK */}
          {overallStatus === 'ok' && !detailsExpanded ? (
            <div>
              <p className="text-small text-content-tertiary">
                {results
                  .filter(r => r.status === 'ok')
                  .map(r => r.criterion)
                  .join(', ')}{' '}
                all meet the stated criteria.{' '}
                {results.some(r => r.status === 'not-stated') && (
                  <span>
                    {results.filter(r => r.status === 'not-stated').map(r => r.criterion).join(' and ')} not stated.
                  </span>
                )}
              </p>
              <button
                onClick={() => setDetailsExpanded(true)}
                className="mt-2 text-small text-content-link hover:underline inline-flex items-center gap-1"
              >
                View details <ChevronDown className="w-3 h-3" />
              </button>
            </div>
          ) : (
            /* Full results table */
            <div>
              <div className="divide-y divide-border-subtle">
                {results.map(item => (
                  <div key={item.criterion} className="grid grid-cols-[140px_1fr_auto] gap-4 items-start py-3">
                    <span className="text-small font-medium text-content-tertiary pt-0.5">
                      {item.criterion}
                    </span>
                    <div>
                      {item.status === 'not-stated' && !item.jd_quote ? (
                        <span className="text-small text-content-tertiary italic">
                          {item.detail}
                        </span>
                      ) : (
                        <>
                          <p className="text-small text-content-primary mb-0.5">{item.detail}</p>
                          {item.jd_quote && (
                            <p className="text-small text-content-tertiary italic">
                              &ldquo;{item.jd_quote}&rdquo;
                            </p>
                          )}
                          {item.status === 'not-eligible' && correctionTarget !== item.criterion && (
                            <button
                              onClick={() => setCorrectionTarget(item.criterion)}
                              className="mt-1 text-small text-content-link hover:underline"
                            >
                              ↳ Trace read this wrong? Correct it
                            </button>
                          )}
                          {correctionTarget === item.criterion && (
                            <p className="mt-1 text-small text-content-tertiary">
                              Go to{' '}
                              <a href="/settings" className="text-content-link hover:underline">
                                Settings → Profile
                              </a>{' '}
                              to update your details, then re-check here.
                            </p>
                          )}
                        </>
                      )}
                    </div>
                    <Chip label={statusLabel(item.status)} variant={statusToVariant(item.status)} />
                  </div>
                ))}
              </div>

              {overallStatus === 'ok' && (
                <button
                  onClick={() => setDetailsExpanded(false)}
                  className="mt-2 text-small text-content-tertiary hover:text-content-secondary inline-flex items-center gap-1"
                >
                  Collapse <ChevronUp className="w-3 h-3" />
                </button>
              )}

              {/* Disclaimer */}
              <div className="mt-3 pt-3 border-t border-border-subtle">
                <p className="text-small text-content-tertiary flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-content-disabled" />
                  <span>
                    Some employers make exceptions. Check directly with the company.
                    Trace only checks stated criteria — anything not stated is shown as &ldquo;Not stated&rdquo;, not OK.
                  </span>
                </p>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── State: skipped ── */}
      {sectionState === 'skipped' && (
        <div className="flex items-center justify-between gap-4 p-[--space-stack-sm] border border-dashed border-border-default rounded-[--radius-md]">
          <span className="text-small text-content-tertiary">
            Not checked ·{' '}
            <button
              onClick={() => setSectionState('form-open')}
              className="text-content-link hover:underline"
            >
              Add your details to check
            </button>
          </span>
          <Chip label="Not checked" variant="neutral" />
        </div>
      )}
    </section>
  );
}
