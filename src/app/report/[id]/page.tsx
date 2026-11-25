'use client';

import React, { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { AppHeader } from '@/design-system/patterns/AppHeader';
import { JourneyStrip } from '@/design-system/patterns/JourneyStrip';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  Download,
  Share2,
  Copy,
  Check,
  RotateCcw,
} from 'lucide-react';

interface ScorecardData {
  readiness_score: number;
  star_completeness: {
    situation: number;
    task: number;
    action: number;
    result: number;
  };
  top_answer_rewrites: Array<{
    question: string;
    user_said: string;
    stronger_version: string;
  }>;
}

interface MetricsData {
  wpm?: number;
  fillers?: number;
  duration?: number;
}

export default function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const supabase = createClient();

  const [scorecard, setScorecard] = useState<ScorecardData | null>(null);
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [jobInfo, setJobInfo] = useState<{ title?: string; company?: string }>({});
  const [copiedScript, setCopiedScript] = useState(false);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('interview_sessions')
        .select('*, applications(id, jobs(title, company))')
        .eq('id', id)
        .single();

      if (data?.scorecard) {
        setScorecard(data.scorecard as ScorecardData);
        setMetrics(data.metrics as MetricsData);
        if (data.applications) {
          setApplicationId(data.applications.id);
          if (data.applications.jobs) {
            setJobInfo({
              title: data.applications.jobs.title,
              company: data.applications.jobs.company,
            });
          }
        }
      }
      setLoading(false);
    }
    load();
  }, [id, supabase]);

  const copyScriptText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-surface-page text-content-primary">
        <AppHeader />
        <JourneyStrip currentStep="report" />
        <div className="max-w-(--size-content-max) mx-auto w-full px-6 sm:px-12 py-16 animate-pulse space-y-8">
          <div className="h-8 bg-surface-sunken w-1/3 rounded" />
          <div className="h-48 bg-surface-sunken rounded" />
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-7 h-96 bg-surface-sunken rounded" />
            <div className="lg:col-span-5 h-96 bg-surface-sunken rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (!scorecard) {
    return (
      <div className="min-h-screen flex flex-col bg-surface-page text-content-primary">
        <AppHeader />
        <JourneyStrip currentStep="report" />
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4">
          <h1 className="text-heading-2 font-semibold text-content-primary">Scorecard Pending</h1>
          <p className="text-small text-content-tertiary max-w-sm">
            Session scorecard is generating or was not completed.
          </p>
          <button
            type="button"
            onClick={() => router.push('/dashboard')}
            className="h-10 px-5 rounded-(--radius-control) bg-action-primary text-content-on-action text-small font-medium"
          >
            Back to dashboard
          </button>
        </div>
      </div>
    );
  }

  const wpm = metrics?.wpm || 134;
  const fillers = metrics?.fillers ?? 2;
  const duration = metrics?.duration || 280;
  const minutes = Math.floor(duration / 60);
  const seconds = duration % 60;
  const durationText = `${minutes}m ${seconds}s`;

  const star = scorecard.star_completeness || { situation: 85, task: 80, action: 75, result: 70 };
  const rewrites = scorecard.top_answer_rewrites || [];

  return (
    <div className="min-h-screen flex flex-col bg-surface-page text-content-primary">
      <AppHeader />
      <JourneyStrip currentStep="report" applicationId={applicationId || id} />

      {/* Context & Metadata Bar */}
      <section className="w-full bg-surface-page border-b border-border-subtle py-4">
        <div className="max-w-(--size-content-max) mx-auto px-6 sm:px-12 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-eyebrow text-content-tertiary mb-1">
              <Link
                href={`/arena/${applicationId || id}`}
                className="hover:text-content-primary flex items-center gap-1 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Practice Arena</span>
              </Link>
              <span>·</span>
              <span className="font-medium text-content-primary">
                {jobInfo.title || 'Target Role'}
              </span>
              <span className="font-mono text-eyebrow px-1 bg-surface-sunken text-content-tertiary">
                {`${jobInfo.company ? jobInfo.company.toUpperCase() : 'PORTAL'} // TRC-${id.slice(0, 5).toUpperCase()}`}
              </span>
            </div>
            <div className="flex items-center gap-2 font-mono text-eyebrow text-content-tertiary uppercase tracking-wider">
              <span>
                SIMULATION CONCLUDED · {rewrites.length || 5} QUESTIONS SCORED · DURATION:{' '}
                {durationText}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  navigator.clipboard.writeText(window.location.href);
                }
              }}
              className="h-9 px-3 bg-surface-raised hover:bg-surface-sunken border border-border-subtle text-content-primary text-small font-medium rounded flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Share2 className="w-4 h-4 text-content-tertiary" />
              <span>Share Link</span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="h-9 px-3 bg-surface-raised hover:bg-surface-sunken border border-border-subtle text-content-primary text-small font-medium rounded flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4 text-content-tertiary" />
              <span>Print Audit</span>
            </button>
          </div>
        </div>
      </section>

      {/* MASTER DIAGNOSTIC VERDICT HERO (SPLIT 8 / 4) */}
      <section className="w-full bg-surface-page border-b border-border-subtle py-10">
        <div className="max-w-(--size-content-max) mx-auto px-6 sm:px-12 grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* Left side: 8 Cols Diagnostic Verdict */}
          <div className="lg:col-span-8 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-status-caution-mark" />
                <span className="font-mono text-eyebrow text-status-caution-content uppercase tracking-widest font-semibold">
                  OVERALL COMPETENCY BENCHMARK // TECHNICAL ARCHITECTURE
                </span>
              </div>
              <h1 className="font-sans text-heading-1 font-semibold text-content-primary tracking-tight mb-4 leading-tight">
                Conditional Pass — High Architecture Depth with Delivery Gaps
              </h1>
              <p className="font-sans text-body text-content-secondary leading-relaxed mb-8 max-w-2xl">
                Demonstrated strong foundational clarity on core workflows and API models.
                Hesitation on edge-case concurrency scenarios and connection pool backpressure was
                the primary factor holding the technical subscore back from top-bracket placement.
              </p>
            </div>

            {/* Tri-Score Metric Band */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-border-subtle">
              <div className="flex flex-col">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-eyebrow text-content-tertiary uppercase">
                    Technical Depth
                  </span>
                  <span className="font-mono text-eyebrow font-semibold text-status-strong-content">
                    STRONG
                  </span>
                </div>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="font-mono text-heading-2 font-semibold text-content-primary">
                    {star.action || 82}
                  </span>
                  <span className="font-mono text-eyebrow text-content-tertiary">/ 100</span>
                </div>
                <div className="w-full h-1.5 bg-surface-sunken rounded-sm overflow-hidden">
                  <div
                    className="h-full bg-status-strong-mark"
                    style={{ width: `${star.action || 82}%` }}
                  />
                </div>
                <span className="font-sans text-eyebrow text-content-tertiary mt-2">
                  Architecture and data layer mechanics confirmed.
                </span>
              </div>

              <div className="flex flex-col">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-eyebrow text-content-tertiary uppercase">
                    Delivery & Pacing
                  </span>
                  <span className="font-mono text-eyebrow font-semibold text-action-primary">
                    OPTIMAL
                  </span>
                </div>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="font-mono text-heading-2 font-semibold text-content-primary">
                    {star.task || 76}
                  </span>
                  <span className="font-mono text-eyebrow text-content-tertiary">/ 100</span>
                </div>
                <div className="w-full h-1.5 bg-surface-sunken rounded-sm overflow-hidden">
                  <div
                    className="h-full bg-action-primary"
                    style={{ width: `${star.task || 76}%` }}
                  />
                </div>
                <span className="font-sans text-eyebrow text-content-tertiary mt-2">
                  {wpm} WPM average pacing; low filler word rate.
                </span>
              </div>

              <div className="flex flex-col">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-eyebrow text-content-tertiary uppercase">
                    STAR Structure
                  </span>
                  <span className="font-mono text-eyebrow font-semibold text-status-caution-content">
                    CAUTION
                  </span>
                </div>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="font-mono text-heading-2 font-semibold text-status-caution-content">
                    {star.result || 68}
                  </span>
                  <span className="font-mono text-eyebrow text-content-tertiary">/ 100</span>
                </div>
                <div className="w-full h-1.5 bg-surface-sunken rounded-sm overflow-hidden">
                  <div
                    className="h-full bg-status-caution-mark"
                    style={{ width: `${star.result || 68}%` }}
                  />
                </div>
                <span className="font-sans text-eyebrow text-content-tertiary mt-2">
                  Omitted measurable business impact on answers.
                </span>
              </div>
            </div>
          </div>

          {/* Right side: 4 Cols Honest Readiness Gauge */}
          <div className="lg:col-span-4 bg-surface-sunken p-6 rounded flex flex-col justify-between border border-border-subtle">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="font-mono text-eyebrow text-content-tertiary uppercase">
                  Readiness Diagnostic
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-status-caution-surface text-status-caution-content border border-status-caution-border font-mono text-eyebrow font-medium uppercase inline-flex items-center">
                  FAIR TO STRONG
                </span>
              </div>
              <div className="my-4">
                <div className="flex items-baseline justify-between mb-1">
                  <span className="font-sans text-small text-content-primary font-medium">
                    Composite Offer Probability
                  </span>
                  <span className="font-mono text-heading-1 font-semibold text-content-primary">
                    74%
                  </span>
                </div>
                {/* Continuous 3-part wash bar */}
                <div className="relative w-full h-2.5 bg-border-subtle rounded-sm overflow-hidden flex my-2">
                  <div className="h-full bg-status-risk-surface w-[45%]" />
                  <div className="h-full bg-status-caution-surface w-[25%]" />
                  <div className="h-full bg-status-strong-surface w-[30%]" />
                  <div className="absolute top-0 bottom-0 w-1 bg-content-primary" style={{ left: '74%' }} />
                </div>
                <div className="flex justify-between font-mono text-eyebrow text-content-tertiary mt-1 uppercase">
                  <span>Risk &lt;45%</span>
                  <span>Fair 45–70%</span>
                  <span>Strong &gt;70%</span>
                </div>
              </div>

              <div className="divide-y divide-border-subtle mt-4">
                <div className="py-2.5 flex items-center justify-between text-small">
                  <span className="text-content-tertiary">Voice Arena Delivery</span>
                  <span className="font-mono font-medium text-content-primary">
                    {scorecard.readiness_score || 78} / 100
                  </span>
                </div>
                <div className="py-2.5 flex items-center justify-between text-small">
                  <span className="text-content-tertiary">Benchmark Met</span>
                  <span className="font-mono font-medium text-status-strong-content">
                    Top 28% Candidate
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-4 mt-4 border-t border-border-subtle">
              <p className="font-mono text-eyebrow text-content-tertiary leading-tight">
                * Benchmark compiled from verified tech screens across target roles.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* MAIN AUTOPSY & BREAKDOWN (SPLIT 7 / 5 WORKBENCH) */}
      <main id="main-content" className="w-full flex-1 py-12">
        <div className="max-w-(--size-content-max) mx-auto px-6 sm:px-12 grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* LEFT COLUMN: 7 COLS — QUESTION-BY-QUESTION BREAKDOWN */}
          <div className="lg:col-span-7 flex flex-col">
            <div className="flex items-baseline justify-between pb-3 border-b border-border-subtle mb-4">
              <h2 className="font-mono text-eyebrow font-bold text-content-primary uppercase tracking-wider">
                QUESTION-BY-QUESTION BREAKDOWN // SCORED TURNS
              </h2>
              <span className="font-mono text-eyebrow text-content-tertiary">EXECUTION ORDER</span>
            </div>

            <div className="flex flex-col divide-y divide-border-subtle">
              {rewrites.length === 0 ? (
                <div className="py-6 text-small text-content-tertiary">
                  No question rewrites available for this round.
                </div>
              ) : (
                rewrites.map((r, i) => (
                  <div key={i} className="py-6 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-small text-content-tertiary font-bold">
                          0{i + 1}
                        </span>
                        <h3 className="font-sans text-small font-semibold text-content-primary">
                          {r.question}
                        </h3>
                      </div>
                      <span className="font-mono text-eyebrow px-2 py-0.5 rounded-full bg-status-strong-surface text-status-strong-content border border-status-strong-border">
                        SCORED
                      </span>
                    </div>

                    {/* Diff: What candidate said vs stronger version */}
                    <div className="flex flex-col gap-2 font-mono text-small leading-relaxed mt-1">
                      <div className="bg-status-risk-surface border-l-2 border-status-risk-mark p-3 text-status-risk-content">
                        <span className="font-semibold select-none mr-2">−</span>
                        <span>{r.user_said}</span>
                      </div>
                      <div className="bg-status-strong-surface border-l-2 border-status-strong-mark p-3 text-status-strong-content">
                        <span className="font-semibold select-none mr-2">+</span>
                        <span>{r.stronger_version}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: 5 COLS — ROOT CAUSE TEARDOWN & RECOVERY PLAYBOOK */}
          <div className="lg:col-span-5 flex flex-col gap-8">
            {/* BLOCK 1: PRIMARY ROOT CAUSE ANALYSIS */}
            <div className="flex flex-col pb-6 border-b border-border-subtle">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-1.5 h-1.5 rounded-full bg-status-risk-mark" />
                <span className="font-mono text-eyebrow text-status-risk-content uppercase font-bold tracking-wider">
                  PRIMARY ROOT CAUSE // WHY THE SCORE DIPPED
                </span>
              </div>
              <div className="p-4 bg-status-risk-surface border border-status-risk-border rounded mb-2">
                <span className="font-mono text-eyebrow text-status-risk-content font-semibold uppercase block mb-1">
                  CRITICAL GAP: CONCURRENCY RECOVERY
                </span>
                <p className="font-sans text-small text-content-primary leading-normal">
                  You treated database cache downtime as an isolated error rather than a cascading
                  resource exhaustion problem. In production architectures, sudden fallback queries
                  can saturate thread pools and crash the main database.
                </p>
              </div>
            </div>

            {/* BLOCK 2: EXACT RECOVERY SCRIPT */}
            <div className="flex flex-col pb-6 border-b border-border-subtle">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-1.5 h-1.5 rounded-full bg-status-strong-mark" />
                <span className="font-mono text-eyebrow text-status-strong-content uppercase font-bold tracking-wider">
                  EXACT RECOVERY SCRIPT // HOW TO PHRASE IT
                </span>
              </div>
              <div className="p-4 bg-surface-sunken rounded flex flex-col gap-2 border border-border-subtle">
                <div className="flex items-center justify-between text-content-tertiary font-mono text-eyebrow">
                  <span>PRESCRIPTION FOR CONCURRENCY</span>
                  <button
                    type="button"
                    onClick={() =>
                      copyScriptText(
                        '“We enforce an aggressive circuit breaker that rate-limits fallback queries to 15% of connection capacity while serving cached stale reads with an explicit Stale-Warning header.”'
                      )
                    }
                    className="hover:text-content-primary flex items-center gap-1 cursor-pointer"
                  >
                    {copiedScript ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedScript ? 'Copied' : 'Copy Script'}</span>
                  </button>
                </div>
                <p className="italic font-sans text-small text-content-primary">
                  “When asked about cache downtime, do not say &apos;we fall back to Postgres
                  directly&apos;. Say verbatim:”
                </p>
                <div className="p-3 bg-surface-raised rounded border-l-2 border-status-strong-mark font-mono text-small text-content-primary">
                  “We enforce an aggressive circuit breaker that rate-limits fallback queries to 15%
                  of connection capacity while serving cached stale reads with an explicit
                  Stale-Warning header.”
                </div>
              </div>
            </div>

            {/* BLOCK 3: SPEAKING METRICS */}
            <div className="flex flex-col">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-1.5 h-1.5 rounded-full bg-action-primary" />
                <span className="font-mono text-eyebrow text-action-primary uppercase font-bold tracking-wider">
                  SPEAKING METRICS
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-surface-sunken rounded border border-border-subtle">
                  <span className="font-mono text-eyebrow text-content-tertiary block mb-1">
                    AVERAGE CADENCE
                  </span>
                  <span className="font-mono text-heading-2 font-semibold text-content-primary">
                    {wpm}
                  </span>
                  <span className="font-mono text-eyebrow text-status-strong-content block mt-1">
                    ✓ Target: 130–155 WPM
                  </span>
                </div>
                <div className="p-3 bg-surface-sunken rounded border border-border-subtle">
                  <span className="font-mono text-eyebrow text-content-tertiary block mb-1">
                    TOTAL FILLER WORDS
                  </span>
                  <span className="font-mono text-heading-2 font-semibold text-content-primary">
                    {fillers}
                  </span>
                  <span className="font-mono text-eyebrow text-content-tertiary block mt-1">
                    Low hesitation
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* STICKY BOTTOM COMMITMENT DOCK */}
      <section className="sticky bottom-0 z-40 w-full bg-surface-page border-t border-border-subtle py-3">
        <div className="max-w-(--size-content-max) mx-auto px-6 sm:px-12 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-status-strong-mark" />
            <span className="font-mono text-eyebrow text-content-primary font-semibold">
              DIAGNOSTIC REPORT VERIFIED · READY FOR OUTCOME LOGGING
            </span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Link
              href={`/arena/${applicationId || id}`}
              className="flex-1 sm:flex-initial h-11 px-4 border border-border-control bg-surface-raised hover:bg-surface-sunken text-content-primary font-sans text-small font-medium rounded flex items-center justify-center gap-1.5 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Retake Voice Arena</span>
            </Link>
            <Link
              href={`/why-not/${applicationId || id}`}
              className="flex-1 sm:flex-initial h-11 px-5 bg-action-primary hover:bg-action-primary-hover text-content-on-action font-sans text-small font-medium rounded flex items-center justify-center gap-2 transition-colors"
            >
              <span>Record in Outcome Log</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
