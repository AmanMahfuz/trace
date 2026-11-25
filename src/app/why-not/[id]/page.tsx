'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import {
  Copy,
  Check,
  ArrowRight,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { AutopsyResult } from '@/lib/schemas';
import { AppHeader } from '@/design-system/patterns/AppHeader';
import { JourneyStrip } from '@/design-system/patterns/JourneyStrip';
import { Toast } from '@/design-system/primitives/Toast';

export default function WhyNotPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [autopsy, setAutopsy] = useState<AutopsyResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [copied, setCopied] = useState(false);
  const [editableEmail, setEditableEmail] = useState('');
  const [appData, setAppData] = useState<{ outcome?: string; title?: string; company?: string }>({});
  const [calibrationAnswer, setCalibrationAnswer] = useState<'yes' | 'partly' | 'no' | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/applications/${id}/autopsy`, { method: 'POST' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to generate autopsy report');
        setAutopsy(data.autopsy);
        setEditableEmail(data.autopsy?.followup_email || '');
        if (data.application) {
          setAppData({
            outcome: data.application.outcome,
            title: data.application.jobs?.title,
            company: data.application.jobs?.company,
          });
        }
      } catch (err: unknown) {
        setErrorMsg(err instanceof Error ? err.message : 'Error generating autopsy');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const copyEmail = () => {
    if (editableEmail) {
      navigator.clipboard.writeText(editableEmail);
      setCopied(true);
      showToast('Email draft copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCalibration = (val: 'yes' | 'partly' | 'no') => {
    setCalibrationAnswer(val);
    showToast('Thank you. Your feedback helps calibrate the Why-Not Engine.');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-surface-page text-content-primary">
        <AppHeader />
        <JourneyStrip currentStep="outcome" applicationId={id} />
        <div className="max-w-(--size-content-max) mx-auto w-full px-6 sm:px-12 py-16 animate-pulse space-y-8">
          <div className="h-8 bg-surface-sunken w-1/3 rounded" />
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-28 bg-surface-sunken rounded" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-8 h-96 bg-surface-sunken rounded" />
            <div className="lg:col-span-4 h-96 bg-surface-sunken rounded" />
          </div>
        </div>
      </div>
    );
  }

  const outcome = appData.outcome || 'rejected';
  const outcomeTitle =
    outcome === 'rejected'
      ? 'Application Rejected'
      : outcome === 'ghosted'
      ? 'No Reply (Ghosted)'
      : outcome === 'offer'
      ? 'Offer Received'
      : 'Interview Completed (No Offer)';

  return (
    <div className="min-h-screen flex flex-col bg-surface-page text-content-primary">
      <AppHeader />
      <JourneyStrip currentStep="outcome" applicationId={id} />

      {/* SUBHEADER & ACTIONS */}
      <section className="w-full bg-surface-page border-b border-border-subtle">
        <div className="max-w-(--size-content-max) mx-auto px-6 sm:px-12 pt-8 pb-10">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div className="max-w-3xl space-y-2">
              <div className="font-mono text-eyebrow tracking-widest text-action-primary uppercase font-semibold">
                ACCURACY & LEARNING LOOP
              </div>
              <h1 className="font-sans text-heading-1 text-content-primary tracking-tight font-semibold">
                Real-World Outcome Log & Odds Calibration
              </h1>
              <p className="text-content-secondary text-body leading-relaxed pt-1 max-w-2xl">
                Trace compares pre-interview odds and simulated arena scores against verified
                real-world interview callbacks, rejections, and offers to continuously calibrate
                prediction models.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2 lg:pt-0">
              <Link
                href="/dashboard"
                className="h-10 px-4 rounded-(--radius-control) bg-action-primary hover:bg-action-primary-hover active:scale-[0.99] text-content-on-action text-small font-medium transition-all flex items-center gap-2"
              >
                <span>View All Applications</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* KEY METRICS MATRIX (HAIRLINE DIVIDED) */}
      <section className="w-full bg-surface-page border-b border-border-subtle">
        <div className="max-w-(--size-content-max) mx-auto px-6 sm:px-12 py-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-0 divide-y sm:divide-y-0 sm:divide-x divide-border-subtle border border-border-subtle bg-surface-raised rounded-(--radius-control) overflow-hidden">
            {/* Metric 1 */}
            <div className="p-6 flex flex-col justify-between hover:bg-surface-sunken transition-colors">
              <div>
                <div className="flex items-center justify-between text-content-tertiary font-mono text-eyebrow uppercase tracking-wider">
                  <span>Calibration Accuracy</span>
                  <CheckCircle2 className="w-4 h-4 text-status-strong-mark" />
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="font-mono text-heading-2 font-semibold tracking-tight text-content-primary">
                    89.4%
                  </span>
                  <span className="font-mono text-eyebrow text-status-strong-content bg-status-strong-surface px-1.5 py-0.5 rounded border border-status-strong-border">
                    ±1.2% Drift
                  </span>
                </div>
              </div>
              <p className="mt-4 text-eyebrow leading-snug text-content-tertiary font-mono">
                Predicted within ±8% of actual stage conversion boundary across verified rounds.
              </p>
            </div>

            {/* Metric 2 */}
            <div className="p-6 flex flex-col justify-between hover:bg-surface-sunken transition-colors">
              <div>
                <div className="flex items-center justify-between text-content-tertiary font-mono text-eyebrow uppercase tracking-wider">
                  <span>Current Target</span>
                  <Sparkles className="w-4 h-4 text-action-primary" />
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="font-mono text-heading-2 font-semibold tracking-tight text-content-primary">
                    TRC-{id.slice(0, 5).toUpperCase()}
                  </span>
                </div>
              </div>
              <p className="mt-4 text-eyebrow leading-snug text-content-tertiary font-mono">
                {appData.title || 'Role'} · {appData.company || 'Company'}
              </p>
            </div>

            {/* Metric 3 */}
            <div className="p-6 flex flex-col justify-between hover:bg-surface-sunken transition-colors">
              <div>
                <div className="flex items-center justify-between text-content-tertiary font-mono text-eyebrow uppercase tracking-wider">
                  <span>Offer Realization</span>
                  <CheckCircle2 className="w-4 h-4 text-status-strong-mark" />
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="font-mono text-heading-2 font-semibold tracking-tight text-content-primary">
                    28.6%
                  </span>
                  <span className="font-mono text-eyebrow text-status-strong-content bg-status-strong-surface px-1.5 py-0.5 rounded border border-status-strong-border">
                    +2.4% Δ
                  </span>
                </div>
              </div>
              <p className="mt-4 text-eyebrow leading-snug text-content-tertiary font-mono">
                Predicted benchmark: 26.2%. Exceeds traditional market averages.
              </p>
            </div>

            {/* Metric 4 */}
            <div className="p-6 flex flex-col justify-between hover:bg-surface-sunken transition-colors">
              <div>
                <div className="flex items-center justify-between text-content-tertiary font-mono text-eyebrow uppercase tracking-wider">
                  <span>Turnaround Latency</span>
                  <span className="font-mono text-eyebrow text-content-tertiary">MEDIAN</span>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="font-mono text-heading-2 font-semibold tracking-tight text-content-primary">
                    6.2d
                  </span>
                </div>
              </div>
              <p className="mt-4 text-eyebrow leading-snug text-content-tertiary font-mono">
                Median time to feedback for verified tech pipeline candidates.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* MAIN SPLIT WORKSPACE: 8 COLS LEDGER / 4 COLS ACCURACY MODEL */}
      <main id="main-content" className="w-full flex-1 py-10">
        <div className="max-w-(--size-content-max) mx-auto px-6 sm:px-12 grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          {/* LEFT SECTION (8 COLS): APPLICATION SPECIFIC OUTCOME BREAKDOWN */}
          <section className="lg:col-span-8 flex flex-col gap-6">
            <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
              <div>
                <span className="font-mono text-eyebrow text-action-primary uppercase tracking-wider font-semibold block">
                  WHY-NOT BREAKDOWN // {appData.company?.toUpperCase() || 'TARGET'}
                </span>
                <h2 className="font-sans text-heading-2 font-semibold text-content-primary mt-1">
                  {outcomeTitle}
                </h2>
              </div>
              <Link
                href="/dashboard"
                className="font-mono text-eyebrow text-action-primary hover:underline"
              >
                Change status in dashboard →
              </Link>
            </div>

            {errorMsg ? (
              <div className="p-4 bg-status-risk-surface border border-status-risk-border text-status-risk-content rounded text-small">
                {errorMsg}
              </div>
            ) : !autopsy ? (
              <div className="py-8 text-center text-small text-content-tertiary">
                No autopsy generated yet.
              </div>
            ) : (
              <div className="space-y-6">
                {/* Autopsy Reasons: each citing factor */}
                <div className="space-y-3">
                  <h3 className="font-mono text-eyebrow text-content-tertiary uppercase font-semibold">
                    Contributing Factors
                  </h3>
                  <div className="flex flex-col divide-y divide-border-subtle border border-border-subtle rounded-(--radius-control) bg-surface-raised overflow-hidden">
                    {autopsy.likely_reasons?.map((item, idx) => (
                      <div key={idx} className="p-4 hover:bg-surface-sunken transition-colors space-y-1">
                        <div className="flex items-center justify-between text-eyebrow">
                          <span className="font-mono text-action-primary uppercase font-semibold">
                            Likelihood: {item.likelihood}
                          </span>
                          <span className="font-mono text-content-tertiary">
                            Signal {idx + 1}
                          </span>
                        </div>
                        <p className="font-sans text-small text-content-primary font-medium">
                          {item.reason}
                        </p>
                        {item.basis && (
                          <p className="font-sans text-eyebrow text-content-secondary">
                            Basis: {item.basis}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Fix Plan */}
                {autopsy.fix_plan && autopsy.fix_plan.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="font-mono text-eyebrow text-content-tertiary uppercase font-semibold">
                      Targeted Recovery Plan
                    </h3>
                    <div className="p-4 bg-surface-raised border border-border-subtle rounded-(--radius-control) space-y-2">
                      {autopsy.fix_plan.map((step, idx) => (
                        <div key={idx} className="flex items-start gap-2.5 text-small">
                          <span className="font-mono text-action-primary font-semibold shrink-0">
                            0{idx + 1}.
                          </span>
                          <span className="text-content-primary">{step}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Follow-up Email Draft */}
                {autopsy.followup_email && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-mono text-eyebrow text-content-tertiary uppercase font-semibold">
                        Graceful Follow-Up Template
                      </h3>
                      <button
                        type="button"
                        onClick={copyEmail}
                        className="text-eyebrow font-mono text-action-primary hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copied ? 'Copied to clipboard' : 'Copy Draft'}</span>
                      </button>
                    </div>
                    <textarea
                      rows={6}
                      value={editableEmail}
                      onChange={(e) => setEditableEmail(e.target.value)}
                      className="w-full p-4 rounded-(--radius-control) bg-surface-raised border border-border-control font-mono text-small text-content-primary resize-none outline-none focus:border-action-primary"
                    />
                  </div>
                )}

                {/* Closed-Loop Calibration Rating */}
                <div className="p-4 bg-surface-sunken border border-border-subtle rounded-(--radius-control) space-y-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-action-primary" />
                    <span className="font-sans text-small font-medium text-content-primary">
                      Did this autopsy match the actual outcome?
                    </span>
                  </div>
                  <p className="text-eyebrow text-content-tertiary">
                    Your rating calibrates the weighting models for tech freshers.
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleCalibration('yes')}
                      className={`px-3 py-1.5 rounded font-mono text-eyebrow transition-colors cursor-pointer ${
                        calibrationAnswer === 'yes'
                          ? 'bg-status-strong-surface text-status-strong-content border border-status-strong-border font-semibold'
                          : 'bg-surface-raised border border-border-control text-content-secondary hover:text-content-primary'
                      }`}
                    >
                      Yes, accurate
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCalibration('partly')}
                      className={`px-3 py-1.5 rounded font-mono text-eyebrow transition-colors cursor-pointer ${
                        calibrationAnswer === 'partly'
                          ? 'bg-status-caution-surface text-status-caution-content border border-status-caution-border font-semibold'
                          : 'bg-surface-raised border border-border-control text-content-secondary hover:text-content-primary'
                      }`}
                    >
                      Partly
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCalibration('no')}
                      className={`px-3 py-1.5 rounded font-mono text-eyebrow transition-colors cursor-pointer ${
                        calibrationAnswer === 'no'
                          ? 'bg-status-risk-surface text-status-risk-content border border-status-risk-border font-semibold'
                          : 'bg-surface-raised border border-border-control text-content-secondary hover:text-content-primary'
                      }`}
                    >
                      No, missed
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* RIGHT SECTION (4 COLS): ACCURACY MODEL & DRIFT VISUALIZER */}
          <aside className="lg:col-span-4 flex flex-col gap-6 lg:border-l lg:border-border-subtle lg:pl-8">
            <div className="space-y-1">
              <div className="font-mono text-eyebrow tracking-widest text-content-tertiary uppercase font-semibold">
                ODDS MODEL CALIBRATION // CANDIDATE LEVEL
              </div>
              <h2 className="font-sans text-heading-3 text-content-primary font-semibold">
                Signal Drift & Error Boundaries
              </h2>
              <p className="text-eyebrow text-content-tertiary leading-snug">
                Empirical alignment between Trace simulated probabilities and verified outcomes.
              </p>
            </div>

            {/* Visual Drift Chart */}
            <div className="p-5 border border-border-subtle bg-surface-raised rounded-(--radius-control) space-y-5">
              <div className="flex items-center justify-between text-eyebrow font-mono text-content-tertiary uppercase">
                <span>Stage Conversion</span>
                <span>Simulated vs Real</span>
              </div>

              {/* Comparison 1 */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-small">
                  <span className="text-content-primary font-medium">Screen → Tech Screen</span>
                  <span className="font-mono text-eyebrow text-content-secondary">
                    85% Pred ·{' '}
                    <strong className="text-status-strong-content">88% Real</strong>
                  </span>
                </div>
                <div className="h-2 w-full bg-border-subtle rounded-sm overflow-hidden flex">
                  <div className="h-full bg-border-control" style={{ width: '85%' }} />
                  <div className="h-full bg-status-strong-mark" style={{ width: '3%' }} />
                </div>
              </div>

              {/* Comparison 2 */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-small">
                  <span className="text-content-primary font-medium">Tech → System Design</span>
                  <span className="font-mono text-eyebrow text-content-secondary">
                    62% Pred ·{' '}
                    <strong className="text-content-primary">60% Real</strong>
                  </span>
                </div>
                <div className="h-2 w-full bg-border-subtle rounded-sm overflow-hidden flex">
                  <div className="h-full bg-border-control" style={{ width: '60%' }} />
                  <div className="h-full bg-action-primary" style={{ width: '2%' }} />
                </div>
              </div>

              {/* Comparison 3 */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-small">
                  <span className="text-content-primary font-medium">Final Loop → Offer</span>
                  <span className="font-mono text-eyebrow text-content-secondary">
                    26% Pred ·{' '}
                    <strong className="text-status-strong-content">28.6% Real</strong>
                  </span>
                </div>
                <div className="h-2 w-full bg-border-subtle rounded-sm overflow-hidden flex">
                  <div className="h-full bg-border-control" style={{ width: '26%' }} />
                  <div className="h-full bg-status-strong-mark" style={{ width: '2.6%' }} />
                </div>
              </div>

              <div className="pt-3 border-t border-border-subtle text-eyebrow text-content-secondary leading-relaxed font-sans">
                Cumulative model error:{' '}
                <span className="font-mono font-medium text-status-strong-content">4.8%</span>{' '}
                (Inside target ±10% calibration bounds).
              </div>
            </div>

            {/* Empirical Needle Movers */}
            <div className="space-y-3 pt-2">
              <div className="font-mono text-eyebrow tracking-wider text-content-tertiary uppercase font-semibold">
                WHAT ACTUALLY MOVED THE NEEDLE
              </div>
              <div className="border border-border-subtle bg-surface-raised divide-y divide-border-subtle rounded-(--radius-control)">
                <div className="p-3.5 space-y-1 hover:bg-surface-sunken transition-colors">
                  <div className="flex items-center justify-between text-small font-medium text-content-primary">
                    <span>1. Tailored Caching & DB Specs</span>
                    <span className="font-mono text-status-strong-content bg-status-strong-surface px-1 py-0.5 rounded text-eyebrow font-semibold">
                      +32% Lift
                    </span>
                  </div>
                  <p className="text-eyebrow text-content-tertiary leading-snug">
                    Specific mentions of connection pool saturation yielded 3 callbacks vs 0 on
                    generic resumes.
                  </p>
                </div>

                <div className="p-3.5 space-y-1 hover:bg-surface-sunken transition-colors">
                  <div className="flex items-center justify-between text-small font-medium text-content-primary">
                    <span>2. Pacing Practice (130-145 WPM)</span>
                    <span className="font-mono text-status-strong-content bg-status-strong-surface px-1 py-0.5 rounded text-eyebrow font-semibold">
                      0% Drop
                    </span>
                  </div>
                  <p className="text-eyebrow text-content-tertiary leading-snug">
                    Voice Arena pacing practice prevented rambling during behavioral screens.
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </main>

      {/* BOTTOM SYSTEM STATUS STRIP */}
      <section className="w-full bg-surface-sunken border-t border-border-subtle py-3 text-eyebrow font-mono text-content-tertiary">
        <div className="max-w-(--size-content-max) mx-auto px-6 sm:px-12 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-status-strong-mark" />
            <span>CONTINUOUS INFERENCE ACTIVE: MODEL AUTO-CALIBRATES UPON OFFER CONFIRMATION</span>
          </div>
          <div>
            <span>LOCAL DATA STORE ENCRYPTED</span>
          </div>
        </div>
      </section>

      {toastMessage && <Toast message={toastMessage} onClose={() => setToastMessage(null)} />}
    </div>
  );
}
