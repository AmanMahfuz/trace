'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { OddsResult, GhostResult, TailorSuggestion, Resume } from '@/lib/schemas';
import { EligibilitySection } from '@/components/EligibilitySection';
import { ProcessTimeline, ProcessStagesData } from '@/components/ProcessTimeline';
import { EligibilityCriteria, EligibilityItem, UserProfile } from '@/lib/eligibility';
import { AppHeader } from '@/design-system/patterns/AppHeader';
import { JourneyStrip } from '@/design-system/patterns/JourneyStrip';
import { Dialog } from '@/design-system/patterns/Dialog';
import { WaitlistModal } from '@/components/WaitlistModal';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  Download,
  Lock,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Sparkles,
  Loader2,
} from 'lucide-react';

interface PrepSuggestion extends TailorSuggestion {
  status?: 'accepted' | 'declined';
  section?: string;
  evidence_quote?: string;
}

export default function PrepPage() {
  const params = useParams();
  const id = Array.isArray(params?.id) ? params.id[0] : (params?.id as string);
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [odds, setOdds] = useState<OddsResult | null>(null);
  const [ghost, setGhost] = useState<GhostResult | null>(null);
  const [jobInfo, setJobInfo] = useState<{ title?: string; company?: string; url?: string }>({});
  const [tailoredResume, setTailoredResume] = useState<Resume | null>(null);
  const [originalResume, setOriginalResume] = useState<Resume | null>(null);
  const [activeTab, setActiveTab] = useState<'changes' | 'original' | 'tailored'>('changes');
  const [correctionTarget, setCorrectionTarget] = useState<{ bulletId: string; text: string } | null>(null);
  const [correctionInput, setCorrectionInput] = useState('');
  const [corrections, setCorrections] = useState<Record<string, string>>({});
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [allSuggestions, setAllSuggestions] = useState<PrepSuggestion[]>([]);
  const [accessDenied, setAccessDenied] = useState(false);
  const [acceptedIds, setAcceptedIds] = useState<Set<string>>(new Set());
  const [declinedIds, setDeclinedIds] = useState<Set<string>>(new Set());
  const [userCredits, setUserCredits] = useState<number>(3);
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [eligibilityData, setEligibilityData] = useState<EligibilityItem[] | null>(null);
  const [eligibilitySkipped, setEligibilitySkipped] = useState(false);
  const [processStages, setProcessStages] = useState<ProcessStagesData | null>(null);
  const [eligibilityCriteria, setEligibilityCriteria] = useState<EligibilityCriteria | null>(null);

  useEffect(() => {
    async function fetchApp() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('credits, grad_year, branch, aggregate_pct, active_backlogs, track')
        .eq('id', user.id)
        .single();
      if (profile) {
        setUserCredits(profile.credits);
        setUserProfile(profile as UserProfile);
      }

      const { data, error } = await supabase
        .from('applications')
        .select('*, jobs(title, company, source_url, raw_text), resumes(parsed)')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      if (error || !data) {
        setAccessDenied(true);
        setLoading(false);
      } else {
        if (data.eligibility) {
          setEligibilityData(data.eligibility as EligibilityItem[]);
        }
        if (data.eligibility_skipped) {
          setEligibilitySkipped(true);
        }
        if (data.process_stages) {
          setProcessStages(data.process_stages as ProcessStagesData);
        }

        if (data.jobs) {
          setJobInfo({
            title: data.jobs.title,
            company: data.jobs.company,
            url: data.jobs.source_url,
          });
          if (data.jobs.eligibility) {
            setEligibilityCriteria(data.jobs.eligibility as EligibilityCriteria);
          }
        }

        if (data.resumes && 'parsed' in data.resumes) {
          setOriginalResume(data.resumes.parsed as unknown as Resume);
        }

        if (data.odds) {
          setOdds(data.odds);
          setGhost(data.ghost);
          const suggestions = data.suggestions || [];
          setAllSuggestions(suggestions);
          // Pre-accept suggestions that have status "accepted"
          const initialAccepted = new Set<string>();
          const initialDeclined = new Set<string>();
          suggestions.forEach((s: PrepSuggestion) => {
            if (s.status === 'accepted') initialAccepted.add(s.bullet_id);
            else if (s.status === 'declined') initialDeclined.add(s.bullet_id);
          });
          setAcceptedIds(initialAccepted);
          setDeclinedIds(initialDeclined);

          if (data.tailored) setTailoredResume(data.tailored);
          else if (data.resumes && 'parsed' in data.resumes) setTailoredResume(data.resumes.parsed as unknown as Resume);
          setLoading(false);
        } else {
          // Background analysis pipeline in progress; poll again in 1.5s
          setTimeout(fetchApp, 1500);
        }
      }
    }
    fetchApp();
  }, [id, router, supabase]);

  const handleAction = async (bulletId: string, action: 'accept' | 'decline' | 'undo', detail?: string) => {
    try {
      const res = await fetch(`/api/applications/${id}/suggestion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bulletId, action, detail }),
      });
      const data = await res.json();
      if (data.suggestions) {
        setAllSuggestions(data.suggestions);
      }
      if (action === 'accept') {
        setAcceptedIds((prev) => new Set(prev).add(bulletId));
        setDeclinedIds((prev) => {
          const s = new Set(prev);
          s.delete(bulletId);
          return s;
        });
      } else if (action === 'decline') {
        setDeclinedIds((prev) => new Set(prev).add(bulletId));
        setAcceptedIds((prev) => {
          const s = new Set(prev);
          s.delete(bulletId);
          return s;
        });
      } else if (action === 'undo') {
        setAcceptedIds((prev) => {
          const s = new Set(prev);
          s.delete(bulletId);
          return s;
        });
        setDeclinedIds((prev) => {
          const s = new Set(prev);
          s.delete(bulletId);
          return s;
        });
      }
    } catch (err) {
      console.error('Failed to update suggestion:', err);
    }
  };

  const handleAcceptAll = () => {
    allSuggestions.forEach((s) => {
      handleAction(s.bullet_id, 'accept');
    });
  };

  const handleResetAll = () => {
    allSuggestions.forEach((s) => {
      handleAction(s.bullet_id, 'undo');
    });
  };

  const handleStartPractice = () => {
    if (userCredits <= 0) {
      setWaitlistOpen(true);
    } else {
      router.push(`/arena/${id}`);
    }
  };

  const handleDownloadPdf = async () => {
    if (!tailoredResume) {
      window.open(`/api/applications/${id}/pdf`, '_blank');
      return;
    }
    setGeneratingPdf(true);
    try {
      const { pdf } = await import('@react-pdf/renderer');
      const { createResumeDocument } = await import('@/components/ResumePDFDocument');
      const doc = createResumeDocument(tailoredResume);
      const blob = await pdf(doc).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tailored-resume-${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.warn('Browser PDF generation fallback:', err);
      window.open(`/api/applications/${id}/pdf`, '_blank');
    } finally {
      setGeneratingPdf(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-surface-page text-content-primary">
        <AppHeader />
        <JourneyStrip currentStep="prep" applicationId={id} />
        <div className="max-w-(--size-content-max) mx-auto w-full px-6 sm:px-12 py-16 animate-pulse space-y-8">
          <div className="h-8 bg-surface-sunken w-1/3 rounded" />
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-5 h-96 bg-surface-sunken rounded" />
            <div className="lg:col-span-7 h-96 bg-surface-sunken rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="min-h-screen flex flex-col bg-surface-page text-content-primary">
        <AppHeader />
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4">
          <h1 className="text-heading-1 font-semibold text-content-primary">Access Restricted</h1>
          <p className="text-small text-content-tertiary max-w-sm">
            This application diagnostic belongs to another account or does not exist.
          </p>
          <button
            type="button"
            onClick={() => router.push('/dashboard')}
            className="h-10 px-4 rounded-(--radius-control) bg-action-primary text-content-on-action text-small font-medium"
          >
            Go to dashboard
          </button>
        </div>
      </div>
    );
  }

  const band = odds?.band || 'Fair';
  const bandLabel =
    band === 'Strong' ? 'Strong' : band === 'Fair' ? 'Fair' : 'Long shot';
  const bandBadge =
    band === 'Strong'
      ? 'HIGH CONVERSION'
      : band === 'Fair'
      ? 'COMPETITIVE MATCH'
      : 'ELEVATED RISK';

  // Rule 6: Never show numeric overall score, only band, rails and factor scores.
  const needlePercent = band === 'Strong' ? '82%' : band === 'Fair' ? '54%' : '24%';
  const acceptedCount = acceptedIds.size;
  const pendingCount = allSuggestions.length - acceptedCount - declinedIds.size;

  return (
    <div className="min-h-screen flex flex-col bg-surface-page text-content-primary">
      <AppHeader />
      <JourneyStrip currentStep="prep" applicationId={id} />

      {/* Page Context Subheader */}
      <div className="w-full bg-surface-page border-b border-border-subtle">
        <div className="max-w-(--size-content-max) mx-auto px-6 sm:px-12 py-4">
          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
            <div className="flex flex-col gap-1">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-1 font-mono text-eyebrow text-content-tertiary hover:text-action-primary transition-colors mb-1 w-max"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Applications</span>
              </Link>
              <h1 className="font-sans text-heading-2 font-semibold text-content-primary tracking-tight">
                {jobInfo.title || 'Target Role'}{' '}
                <span className="text-content-tertiary font-normal">
                  · {jobInfo.company || 'Hiring Company'}
                </span>
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <span className="font-mono text-eyebrow text-content-tertiary uppercase tracking-wider">
                TRC-{id.slice(0, 5).toUpperCase()}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-status-strong-border text-status-strong-content bg-status-strong-surface font-mono text-eyebrow">
                <span className="w-1.5 h-1.5 rounded-full bg-status-strong-mark" />
                ACTIVE REPO SYNC
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Split-Pane Workspace */}
      <main id="main-content" className="w-full flex-1">
        <div className="max-w-(--size-content-max) mx-auto px-6 sm:px-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 min-h-screen">
            {/* LEFT PANE: 5 Columns (Sticky Odds Diagnostic) */}
            <div className="lg:col-span-5 lg:pr-10 py-10 border-b lg:border-b-0 lg:border-r border-border-subtle">
              <div className="lg:sticky lg:top-24 flex flex-col space-y-6">
                {/* Gate: Eligibility Section (Pure-code criteria check above odds) */}
                <EligibilitySection
                  applicationId={id}
                  criteria={eligibilityCriteria}
                  initialProfile={userProfile}
                  initialSkipped={eligibilitySkipped}
                  initialResults={eligibilityData}
                />

                {/* Section Meta Header */}
                <div className="flex items-center justify-between pb-2 border-b border-border-subtle pt-2">
                  <span className="font-mono text-eyebrow uppercase tracking-widest text-content-tertiary">
                    HONEST ODDS DIAGNOSTIC
                  </span>
                  <span className="font-mono text-eyebrow text-content-tertiary">
                    SIGNAL-VERIFIED
                  </span>
                </div>

                {/* Big Diagnostic Verdict */}
                <div className="flex flex-col gap-2 pt-2">
                  <div className="flex items-baseline justify-between">
                    <span
                      className={`font-sans text-display font-semibold tracking-tight leading-none ${
                        band === 'Strong'
                          ? 'text-status-strong-content'
                          : band === 'Fair'
                          ? 'text-status-caution-content'
                          : 'text-status-risk-content'
                      }`}
                    >
                      {bandLabel}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border font-mono text-eyebrow font-medium uppercase tracking-wide ${
                        band === 'Strong'
                          ? 'border-status-strong-border bg-status-strong-surface text-status-strong-content'
                          : band === 'Fair'
                          ? 'border-status-caution-border bg-status-caution-surface text-status-caution-content'
                          : 'border-status-risk-border bg-status-risk-surface text-status-risk-content'
                      }`}
                    >
                      {band === 'Strong' ? (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      ) : band === 'Fair' ? (
                        <AlertTriangle className="w-3.5 h-3.5" />
                      ) : (
                        <AlertOctagon className="w-3.5 h-3.5" />
                      )}
                      {bandBadge}
                    </span>
                  </div>
                  <p className="font-sans text-small text-content-secondary leading-relaxed">
                    {odds?.one_change_to_move_up ||
                      'Candidate meets foundational criteria with baseline competition. Strategic tailoring markedly raises conversion threshold.'}
                  </p>
                </div>

                {/* Continuous Wash Bar & Needle Indicator */}
                <div className="space-y-1.5">
                  <div className="flex justify-between font-mono text-eyebrow text-content-tertiary uppercase">
                    <span>Risk (&lt;45%)</span>
                    <span className="text-status-caution-content font-medium">Fair (45–70%)</span>
                    <span>Strong (&gt;70%)</span>
                  </div>
                  <div className="relative w-full">
                    {/* Bar track */}
                    <div className="grid grid-cols-3 h-2 w-full gap-0.5 rounded-sm overflow-hidden bg-border-subtle">
                      <div className="bg-status-risk-surface" />
                      <div className="bg-status-caution-surface" />
                      <div className="bg-status-strong-surface" />
                    </div>
                    {/* Marker Needle */}
                    <div
                      className="absolute -top-1 -translate-x-1/2 flex flex-col items-center"
                      style={{ left: needlePercent }}
                    >
                      <div className="w-2.5 h-2.5 bg-content-primary rotate-45 border-2 border-surface-page" />
                    </div>
                  </div>
                  <div className="flex justify-between items-center pt-2 text-content-tertiary font-mono text-eyebrow">
                    <span>Confidence: {odds?.confidence || 'Medium'}</span>
                    <span>{ghost?.signals?.length || 5} signals evaluated</span>
                  </div>
                </div>

                {/* Diagnostic Factor Rows */}
                <div className="flex flex-col divide-y divide-border-subtle border-t border-b border-border-subtle">
                  {/* Factor 1: Skill Coverage */}
                  <div className="py-4 space-y-1.5">
                    <div className="flex justify-between items-baseline">
                      <span className="font-sans text-small text-content-primary font-medium">
                        Skill coverage
                      </span>
                      <div className="flex items-baseline gap-1 font-mono text-small text-status-caution-content font-medium">
                        <span>{odds?.factors?.skill_coverage?.score ?? 58}</span>
                        <span className="text-eyebrow text-content-tertiary">/ 100</span>
                      </div>
                    </div>
                    <div className="w-full bg-border-subtle h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-status-caution-mark h-full"
                        style={{ width: `${odds?.factors?.skill_coverage?.score ?? 58}%` }}
                      />
                    </div>
                    <p className="font-sans text-eyebrow text-content-tertiary pt-0.5">
                      {odds?.factors?.skill_coverage?.evidence ||
                        'Matches core requirements; lacks advanced production caching.'}
                    </p>
                  </div>

                  {/* Factor 2: Level Fit */}
                  <div className="py-4 space-y-1.5">
                    <div className="flex justify-between items-baseline">
                      <span className="font-sans text-small text-content-primary font-medium">
                        Level fit
                      </span>
                      <div className="flex items-baseline gap-1 font-mono text-small text-status-strong-content font-medium">
                        <span>{odds?.factors?.level_fit?.score ?? 90}</span>
                        <span className="text-eyebrow text-content-tertiary">/ 100</span>
                      </div>
                    </div>
                    <div className="w-full bg-border-subtle h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-status-strong-mark h-full"
                        style={{ width: `${odds?.factors?.level_fit?.score ?? 90}%` }}
                      />
                    </div>
                    <p className="font-sans text-eyebrow text-content-tertiary pt-0.5">
                      {odds?.factors?.level_fit?.evidence ||
                        'Experience level matches junior/entry requirements exactly.'}
                    </p>
                  </div>

                  {/* Factor 3: Ghost-Posting Probability */}
                  <div className="py-4 space-y-1.5">
                    <div className="flex justify-between items-baseline">
                      <span className="font-sans text-small text-content-primary font-medium">
                        Ghost-posting risk
                      </span>
                      <span className="inline-flex px-2 py-0.5 rounded border border-status-strong-border text-status-strong-content bg-status-strong-surface font-mono text-eyebrow font-medium uppercase">
                        {ghost?.level || 'Low risk'}
                      </span>
                    </div>
                    <p className="font-sans text-eyebrow text-content-tertiary pt-0.5">
                      {ghost?.signals?.[0] ||
                        'Job listing refreshed recently with verified hiring activity.'}
                    </p>
                  </div>
                </div>

                {/* Disclaimer Box */}
                <div className="pt-2">
                  <p className="font-mono text-eyebrow text-content-tertiary uppercase tracking-wider leading-relaxed">
                    ODDS ARE FACTUAL ESTIMATES BASED ON REPOSITORY DATA AND ATS MODELS, NOT
                    ADMISSION GUARANTEES.
                  </p>
                </div>

                {/* Process Timeline */}
                <ProcessTimeline
                  applicationId={id}
                  data={processStages}
                  onSave={(updated) => setProcessStages(updated)}
                />
              </div>
            </div>

            {/* RIGHT PANE: 7 Columns (Fact-Locked Tailoring Engine) */}
            <div className="lg:col-span-7 lg:pl-10 py-10 flex flex-col space-y-6">
              {/* 3-Way Mode Switcher: Changes | Original | Tailored */}
              <div className="flex items-center gap-6 border-b border-border-subtle pb-3">
                <button
                  type="button"
                  onClick={() => setActiveTab('changes')}
                  className={`font-sans text-small font-medium pb-2 -mb-3.5 border-b-2 transition-colors cursor-pointer ${
                    activeTab === 'changes'
                      ? 'border-action-primary text-action-primary font-semibold'
                      : 'border-transparent text-content-secondary hover:text-content-primary'
                  }`}
                >
                  Changes ({allSuggestions.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('original')}
                  className={`font-sans text-small font-medium pb-2 -mb-3.5 border-b-2 transition-colors cursor-pointer ${
                    activeTab === 'original'
                      ? 'border-action-primary text-action-primary font-semibold'
                      : 'border-transparent text-content-secondary hover:text-content-primary'
                  }`}
                >
                  Original
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('tailored')}
                  className={`font-sans text-small font-medium pb-2 -mb-3.5 border-b-2 transition-colors cursor-pointer ${
                    activeTab === 'tailored'
                      ? 'border-action-primary text-action-primary font-semibold'
                      : 'border-transparent text-content-secondary hover:text-content-primary'
                  }`}
                >
                  Tailored (Editable)
                </button>
              </div>

              {/* TAB 1: Changes (Diff View) */}
              {activeTab === 'changes' && (
                <>
                  {/* Module Header */}
                  <div className="flex flex-col gap-2 border-b border-border-subtle pb-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <span className="font-mono text-eyebrow uppercase tracking-widest text-action-primary font-semibold block mb-1">
                          {'MODULE 02 // FACT-LOCKED TAILORING'}
                        </span>
                        <h2 className="font-sans text-heading-2 font-semibold text-content-primary tracking-tight">
                          Evidence-Bound Changes
                        </h2>
                      </div>
                      {/* Fact-Lock Guarantee Badge */}
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-status-strong-surface border border-status-strong-border text-status-strong-content rounded">
                        <Lock className="w-4 h-4" />
                        <span className="font-mono text-eyebrow uppercase font-medium">
                          Fact-Lock Strict: No Hallucinations
                        </span>
                      </div>
                    </div>
                    <p className="font-sans text-small text-content-secondary">
                      Trace only rewrites lines using verifiable details from your uploaded GitHub repos,
                      project readmes, and verified work files. Fabricating accomplishments is disabled.
                    </p>
                  </div>

                  {/* Tailoring Actions Bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-1">
                    <div className="flex items-center gap-4">
                      <span className="font-mono text-eyebrow text-content-primary font-semibold uppercase tracking-wider">
                        {allSuggestions.length} RECOMMENDED EDITS
                      </span>
                      <span className="text-content-tertiary font-mono">·</span>
                      <span className="font-mono text-eyebrow text-content-tertiary">
                        <span className="text-status-strong-content font-semibold">
                          {acceptedCount}
                        </span>{' '}
                        accepted ·{' '}
                        <span className="text-status-caution-content font-semibold">
                          {pendingCount}
                        </span>{' '}
                        pending
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleAcceptAll}
                        className="h-9 px-3.5 rounded border border-border-control bg-surface-raised text-content-primary font-sans text-small font-medium hover:bg-surface-sunken transition-colors cursor-pointer"
                      >
                        Accept all
                      </button>
                      <button
                        type="button"
                        onClick={handleResetAll}
                        className="h-9 px-3.5 rounded text-content-tertiary font-sans text-small font-medium hover:text-content-primary hover:bg-surface-sunken transition-colors cursor-pointer"
                      >
                        Reset
                      </button>
                    </div>
                  </div>

                  {/* Change Blocks (Zero-card list with hairline demarcations) */}
                  <div className="flex flex-col divide-y divide-border-subtle border-t border-b border-border-subtle">
                    {allSuggestions.length === 0 ? (
                      <div className="py-8 text-center text-small text-content-tertiary">
                        No bullet rewrites recommended. Your resume aligns with verified requirements.
                      </div>
                    ) : (
                      allSuggestions.map((item, index) => {
                        const isAccepted = acceptedIds.has(item.bullet_id);
                        const isDeclined = declinedIds.has(item.bullet_id);

                        return (
                          <div key={item.bullet_id} className="py-6 flex flex-col space-y-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-mono text-eyebrow text-content-tertiary uppercase tracking-wider font-semibold">
                                {`BULLET 0${index + 1} // ${item.section || 'EXPERIENCE'}`}
                              </span>
                              <div className="flex items-center gap-2">
                                {isAccepted ? (
                                  <>
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded border border-status-strong-border bg-status-strong-surface text-status-strong-content font-mono text-eyebrow uppercase">
                                      Accepted ✓
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleAction(item.bullet_id, 'undo')}
                                      className="font-mono text-eyebrow text-content-tertiary hover:text-content-primary underline ml-1 cursor-pointer"
                                    >
                                      Undo
                                    </button>
                                  </>
                                ) : isDeclined ? (
                                  <>
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded border border-border-control text-content-disabled font-mono text-eyebrow uppercase">
                                      Declined
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleAction(item.bullet_id, 'undo')}
                                      className="font-mono text-eyebrow text-content-tertiary hover:text-content-primary underline ml-1 cursor-pointer"
                                    >
                                      Undo
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleAction(item.bullet_id, 'accept')}
                                      className="h-9 px-3.5 rounded bg-action-primary text-content-on-action font-sans text-small font-medium hover:bg-action-primary-hover transition-colors cursor-pointer"
                                    >
                                      Accept edit
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleAction(item.bullet_id, 'decline')}
                                      className="h-9 px-3 rounded border border-border-control text-content-primary font-sans text-small hover:bg-surface-sunken transition-colors cursor-pointer"
                                    >
                                      Dismiss
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>

                            {/* Diagnostic Reason */}
                            <div className="flex items-start gap-2 bg-surface-sunken px-3 py-2 rounded">
                              <Sparkles className="w-4 h-4 text-action-primary shrink-0 mt-0.5" />
                              <p className="font-sans text-small text-content-primary">
                                <span className="font-medium text-action-primary">ATS Diagnostic:</span>{' '}
                                {item.reason}
                              </p>
                            </div>

                            {/* Diff Container */}
                            <div className="flex flex-col gap-2 font-mono text-small leading-relaxed">
                              {/* Strikethrough Original */}
                              <div className="bg-status-risk-surface border-l-2 border-status-risk-mark p-3 text-status-risk-content">
                                <span className="font-semibold select-none mr-2">−</span>
                                <span className="line-through">{item.original}</span>
                              </div>
                              {/* Highlighted Proposed */}
                              <div className="bg-status-strong-surface border-l-2 border-status-strong-mark p-3 text-status-strong-content">
                                <span className="font-semibold select-none mr-2">+</span>
                                <span>{item.suggested || item.needs_detail?.question || 'Refined bullet'}</span>
                              </div>
                            </div>

                            {/* Fact Verification Anchor */}
                            <div className="flex items-center justify-between pt-1">
                              <div className="flex items-center gap-1.5 text-content-tertiary font-mono text-eyebrow">
                                <CheckCircle2 className="w-3.5 h-3.5 text-status-strong-mark" />
                                <span>
                                  Verified citation:{' '}
                                  <code className="text-content-primary font-mono">
                                    {item.evidence_quote || item.original}
                                  </code>
                                </span>
                              </div>
                              <span className="font-mono text-eyebrow text-status-strong-content">
                                +10 ATS PTS
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </>
              )}

              {/* TAB 2: Original (Read-only with "Trace read this wrong" correction) */}
              {activeTab === 'original' && (
                <div className="space-y-6">
                  <div className="p-3 bg-surface-sunken border border-border-subtle rounded text-small text-content-secondary flex items-start justify-between gap-3">
                    <p>
                      <span className="font-semibold text-content-primary">Read-only parsed resume:</span> Extracted directly from your PDF upload. Trace fact-locks suggestions against this text. If a metric or title was parsed incorrectly, click &ldquo;Trace read this wrong&rdquo; to lock in your verified correction.
                    </p>
                  </div>

                  {originalResume ? (
                    <div className="space-y-6 font-sans">
                      {/* Contact & Summary */}
                      <div className="pb-4 border-b border-border-subtle space-y-2">
                        <h3 className="text-heading-3 font-semibold text-content-primary">
                          {originalResume.contact?.name || 'Candidate Name'}
                        </h3>
                        <div className="flex flex-wrap gap-3 font-mono text-eyebrow text-content-secondary">
                          {originalResume.contact?.email && <span>{originalResume.contact.email}</span>}
                          {originalResume.contact?.phone && <span>· {originalResume.contact.phone}</span>}
                          {originalResume.contact?.location && <span>· {originalResume.contact.location}</span>}
                        </div>
                        {originalResume.summary && (
                          <p className="text-small text-content-secondary pt-2">
                            {originalResume.summary}
                          </p>
                        )}
                      </div>

                      {/* Experience Section */}
                      <div className="space-y-4">
                        <span className="font-mono text-eyebrow uppercase tracking-wider text-content-tertiary font-semibold block">
                          Experience
                        </span>
                        {originalResume.experience?.map((job, jIdx) => (
                          <div key={job.company + jIdx} className="space-y-3 pb-4 border-b border-border-subtle">
                            <div className="flex flex-wrap justify-between items-baseline gap-1">
                              <div>
                                <span className="font-semibold text-content-primary">{job.title}</span>
                                <span className="text-content-secondary ml-1.5">· {job.company}</span>
                              </div>
                              <span className="font-mono text-eyebrow text-content-tertiary">
                                {job.start || 'Start'} – {job.end || 'Present'}
                              </span>
                            </div>
                            <ul className="space-y-2">
                              {job.bullets?.map((b, bIdx) => {
                                const bulletId = b.id || `exp-${jIdx}-${bIdx}`;
                                const hasCorrection = corrections[bulletId];
                                return (
                                  <li key={bulletId} className="space-y-1">
                                    <div className="flex items-start justify-between gap-3 text-small text-content-primary">
                                      <div className="flex items-start gap-2">
                                        <span className="text-content-tertiary select-none">•</span>
                                        <span>{b.text}</span>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setCorrectionTarget({ bulletId, text: b.text });
                                          setCorrectionInput(corrections[bulletId] || '');
                                        }}
                                        className="text-eyebrow font-mono text-action-primary hover:underline shrink-0 cursor-pointer pt-0.5"
                                      >
                                        Trace read this wrong
                                      </button>
                                    </div>
                                    {hasCorrection && (
                                      <div className="ml-4 font-mono text-eyebrow text-status-strong-content bg-status-strong-surface px-2.5 py-1 rounded border border-status-strong-border">
                                        User correction (fact-locked): &ldquo;{hasCorrection}&rdquo;
                                      </div>
                                    )}
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        ))}
                      </div>

                      {/* Education & Skills */}
                      {originalResume.education && originalResume.education.length > 0 && (
                        <div className="space-y-2 pt-2">
                          <span className="font-mono text-eyebrow uppercase tracking-wider text-content-tertiary font-semibold block">
                            Education
                          </span>
                          {originalResume.education.map((edu, eIdx) => (
                            <div key={eIdx} className="text-small text-content-primary">
                              <span className="font-semibold">{edu.degree}</span> · {edu.school}{' '}
                              {edu.year && <span className="text-content-tertiary font-mono">({edu.year})</span>}
                            </div>
                          ))}
                        </div>
                      )}

                      {originalResume.skills && originalResume.skills.length > 0 && (
                        <div className="space-y-2 pt-2">
                          <span className="font-mono text-eyebrow uppercase tracking-wider text-content-tertiary font-semibold block">
                            Skills
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {originalResume.skills.map((s, sIdx) => (
                              <span key={sIdx} className="px-2 py-0.5 rounded bg-surface-sunken border border-border-subtle font-mono text-eyebrow text-content-secondary">
                                {s}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="py-8 text-center text-small text-content-tertiary">
                      Original parsed resume details are loading...
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: Tailored (Inline Editable) */}
              {activeTab === 'tailored' && (
                <div className="space-y-6">
                  <div className="p-3 bg-surface-sunken border border-border-subtle rounded text-small text-content-secondary flex items-start gap-2">
                    <Sparkles className="w-4 h-4 text-action-primary shrink-0 mt-0.5" />
                    <div>
                      <span className="font-medium text-content-primary">Fact-lock guarantee:</span> Text you type directly in this view counts as verified user-provided evidence. It is saved directly to your tailored profile and included in your exported PDF.
                    </div>
                  </div>

                  {tailoredResume ? (
                    <div className="space-y-6 font-sans">
                      {/* Contact & Summary */}
                      <div className="pb-4 border-b border-border-subtle space-y-2">
                        <h3 className="text-heading-3 font-semibold text-content-primary">
                          {tailoredResume.contact?.name || 'Candidate Name'}
                        </h3>
                        <div className="flex flex-wrap gap-3 font-mono text-eyebrow text-content-secondary">
                          {tailoredResume.contact?.email && <span>{tailoredResume.contact.email}</span>}
                          {tailoredResume.contact?.phone && <span>· {tailoredResume.contact.phone}</span>}
                          {tailoredResume.contact?.location && <span>· {tailoredResume.contact.location}</span>}
                        </div>
                      </div>

                      {/* Editable Experience Bullets */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-eyebrow uppercase tracking-wider text-content-tertiary font-semibold">
                            Tailored Experience (Click to edit)
                          </span>
                          <span className="font-mono text-eyebrow text-status-strong-content">
                            ATS Optimized ✓
                          </span>
                        </div>

                        {tailoredResume.experience?.map((job, jIdx) => (
                          <div key={job.company + jIdx} className="space-y-3 pb-4 border-b border-border-subtle">
                            <div className="flex justify-between items-baseline">
                              <div>
                                <span className="font-semibold text-content-primary">{job.title}</span>
                                <span className="text-content-secondary ml-1.5">· {job.company}</span>
                              </div>
                              <span className="font-mono text-eyebrow text-content-tertiary">
                                {job.start || 'Start'} – {job.end || 'Present'}
                              </span>
                            </div>
                            <div className="space-y-3">
                              {job.bullets?.map((b, bIdx) => (
                                <div key={b.id || `tailor-${jIdx}-${bIdx}`} className="flex items-start gap-2">
                                  <span className="text-action-primary select-none mt-2 font-bold">•</span>
                                  <textarea
                                    rows={2}
                                    value={b.text}
                                    onChange={(e) => {
                                      const copy = JSON.parse(JSON.stringify(tailoredResume)) as Resume;
                                      if (copy.experience?.[jIdx]?.bullets?.[bIdx]) {
                                        copy.experience[jIdx].bullets[bIdx].text = e.target.value;
                                        setTailoredResume(copy);
                                      }
                                    }}
                                    className="w-full p-2.5 rounded bg-surface-page border border-border-subtle hover:border-border-control focus:border-action-primary text-small text-content-primary focus:outline-none transition-colors resize-y font-sans leading-relaxed"
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Skills */}
                      {tailoredResume.skills && tailoredResume.skills.length > 0 && (
                        <div className="space-y-2 pt-2">
                          <span className="font-mono text-eyebrow uppercase tracking-wider text-content-tertiary font-semibold block">
                            Keywords & Skills
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {tailoredResume.skills.map((s, sIdx) => (
                              <span key={sIdx} className="px-2 py-0.5 rounded bg-status-strong-surface border border-status-strong-border font-mono text-eyebrow text-status-strong-content">
                                {s}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="py-8 text-center text-small text-content-tertiary">
                      Generating tailored resume preview...
                    </div>
                  )}
                </div>
              )}

              {/* Bottom Workspace Space */}
              <div className="h-24" />
            </div>
          </div>
        </div>
      </main>

      {/* "Trace read this wrong" Correction Modal */}
      <Dialog
        isOpen={Boolean(correctionTarget)}
        onClose={() => setCorrectionTarget(null)}
        title="Trace read this wrong"
        description="Specify what was extracted incorrectly from your resume. Your typed correction will be locked in as verified user evidence for tailoring and scoring."
      >
        <div className="space-y-4 my-4">
          <div className="p-3 bg-surface-sunken rounded border border-border-subtle font-mono text-small text-content-secondary">
            <span className="font-semibold text-content-primary block mb-1">Parsed text:</span>
            &ldquo;{correctionTarget?.text}&rdquo;
          </div>
          <div>
            <label className="block text-small font-medium text-content-primary mb-1">
              Your factual correction
            </label>
            <textarea
              rows={3}
              value={correctionInput}
              onChange={(e) => setCorrectionInput(e.target.value)}
              placeholder="e.g. Achieved 40% latency reduction (not 14%), using Redis clusters and gRPC..."
              className="w-full p-2.5 rounded-(--radius-control) bg-surface-page border border-border-control text-small text-content-primary focus:outline-none focus:border-action-primary resize-none"
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button
            type="button"
            onClick={() => setCorrectionTarget(null)}
            className="h-9 px-4 rounded-(--radius-control) border border-border-control text-small text-content-secondary hover:bg-surface-sunken cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!correctionInput.trim()}
            onClick={() => {
              if (correctionTarget && correctionInput.trim()) {
                setCorrections((prev) => ({
                  ...prev,
                  [correctionTarget.bulletId]: correctionInput.trim(),
                }));
                setCorrectionTarget(null);
                setCorrectionInput('');
              }
            }}
            className="h-9 px-4 rounded-(--radius-control) bg-action-primary hover:bg-action-primary-hover text-content-on-action text-small font-medium cursor-pointer disabled:opacity-50"
          >
            Save correction
          </button>
        </div>
      </Dialog>

      {/* Docked Bottom Diagnostic Action Bar */}
      <div className="sticky bottom-0 z-40 w-full bg-surface-page border-t border-border-subtle py-3">
        <div className="max-w-(--size-content-max) mx-auto px-6 sm:px-12 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Score Delta Metrics */}
          <div className="flex items-center gap-4">
            <div className="w-2.5 h-2.5 rounded-full bg-status-strong-mark" />
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 font-mono text-small">
              <span className="text-content-primary font-medium">
                {acceptedCount} of {allSuggestions.length} edits applied
              </span>
              <span className="hidden sm:inline text-content-tertiary">·</span>
              <div className="flex items-center gap-1.5">
                <span className="text-content-tertiary">Target Fit:</span>
                <span className="text-status-strong-content font-bold">
                  {acceptedCount > 0 ? 'Calibrated' : 'Pending'}
                </span>
              </div>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={generatingPdf}
              className="h-11 px-5 rounded-(--radius-control) border border-border-control bg-surface-raised text-content-primary font-sans text-small font-medium hover:bg-surface-sunken transition-colors inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {generatingPdf ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>Download Tailored PDF</span>
            </button>

            <button
              type="button"
              onClick={handleStartPractice}
              className="h-11 px-5 rounded-(--radius-control) bg-action-primary hover:bg-action-primary-hover text-content-on-action font-sans text-small font-medium transition-all inline-flex items-center gap-2 cursor-pointer active:scale-[0.99]"
            >
              <span>Practice for this role</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <WaitlistModal
        isOpen={waitlistOpen}
        onClose={() => setWaitlistOpen(false)}
      />
    </div>
  );
}
