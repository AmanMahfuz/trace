'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  savePendingUpload,
  StorageQuotaError,
} from '@/lib/storage/upload-handoff';
import { AppHeader } from '@/design-system/patterns/AppHeader';
import { Dropzone } from '@/design-system/primitives/Dropzone';
import { Banner } from '@/design-system/primitives/Banner';
import {
  ArrowRight,
  Lock,
  CheckCircle2,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';

export default function LandingPage() {
  const router = useRouter();
  const supabase = createClient();

  const [file, setFile] = useState<File | null>(null);
  const [jobInput, setJobInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [savedResumes, setSavedResumes] = useState<Array<{ id: string; fileName: string; createdAt: string }>>([]);
  const [selectedResumeId, setSelectedResumeId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get('resumeId') || '';
    }
    return '';
  });
  const [useSavedResume, setUseSavedResume] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return Boolean(new URLSearchParams(window.location.search).get('resumeId'));
    }
    return false;
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (
        params.get('message') === 'missing_upload' ||
        params.get('error') === 'upload_expired'
      ) {
        const frame = requestAnimationFrame(() => {
          setErrorMessage(
            'Your previous upload session expired or could not be found. Please add your files again.'
          );
        });
        return () => cancelAnimationFrame(frame);
      }
    }
  }, []);

  useEffect(() => {
    async function loadResumes() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        try {
          const res = await fetch('/api/resumes');
          if (res.ok) {
            const data = await res.json();
            const list = data.resumes || [];
            setSavedResumes(list);
            if (list.length > 0 && !selectedResumeId) {
              setSelectedResumeId(list[0].id);
            }
          }
        } catch {
          // Ignore
        }
      }
    }
    loadResumes();
  }, [supabase, selectedResumeId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!useSavedResume && !file) {
      setErrorMessage('Please upload your resume in PDF format (up to 5 MB).');
      return;
    }

    if (useSavedResume && !selectedResumeId) {
      setErrorMessage('Please select a saved resume or upload a new one.');
      return;
    }

    if (!jobInput.trim()) {
      setErrorMessage('Paste a job link or description to evaluate your honest odds.');
      return;
    }

    setLoading(true);
    setStatusMessage('Reading your resume…');

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      if (!file) {
        setErrorMessage('Please upload a PDF resume file to continue as a new visitor.');
        setLoading(false);
        return;
      }
      try {
        await savePendingUpload(file, jobInput.trim());
        router.push('/login?handoff=1');
      } catch (err: unknown) {
        if (err instanceof StorageQuotaError) {
          setErrorMessage(
            'Your browser storage is full. Please clear space or sign in first before uploading.'
          );
        } else {
          router.push('/login?handoff=1');
        }
      } finally {
        setLoading(false);
      }
      return;
    }

    setStatusMessage('Checking the job post…');
    const formData = new FormData();
    if (useSavedResume && selectedResumeId) {
      formData.append('resumeId', selectedResumeId);
    } else if (file) {
      formData.append('file', file);
    }

    if (jobInput.trim().startsWith('http://') || jobInput.trim().startsWith('https://')) {
      formData.append('jobUrl', jobInput.trim());
    } else {
      formData.append('jobText', jobInput.trim());
    }

    try {
      const res = await fetch('/api/analyze', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) {
        if (data.error && data.error.includes('read that page')) {
          throw new Error("We couldn't read that page. Paste the raw job description instead.");
        }
        throw new Error(data.error || 'Analysis failed. Please try again.');
      }

      router.push(`/prep/${data.applicationId}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Analysis failed. Please try again.';
      setErrorMessage(msg);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-surface-page text-content-primary">
      <AppHeader />

      <main id="main-content" className="w-full flex-1">
        <div className="max-w-(--size-content-max) mx-auto px-6 sm:px-12 py-10 lg:py-16">
          {/* ========================================================= */}
          {/* HERO SECTION: Two-column split pane (58% / 42%) */}
          {/* ========================================================= */}
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-0 relative">
            {/* Left Column (approx 58% width / 7 cols) */}
            <div className="lg:col-span-7 lg:pr-12 flex flex-col justify-between pb-12 lg:pb-0">
              <div>
                <span className="font-mono text-eyebrow uppercase tracking-widest text-content-tertiary block">
                  HONEST ODDS FOR JOB HUNTERS
                </span>
                <h1 className="font-sans text-display font-semibold tracking-tight text-content-primary mt-4 leading-none">
                  Know your odds before you apply.
                </h1>
                <p className="font-sans text-body text-content-secondary leading-relaxed mt-6 max-w-xl">
                  Trace reads your resume and a job post, tells you how it’s likely to go, and shows
                  what to change. If you hear nothing back, it helps you work out why.
                </p>
              </div>

              {/* 5-Step Application Lifecycle Strip */}
              <div className="mt-12 pt-8 border-t border-border-subtle">
                <div className="font-mono text-eyebrow text-content-tertiary uppercase tracking-wider mb-4">
                  Application Lifecycle
                </div>
                <div className="relative w-full">
                  <div className="absolute top-1 left-0 right-0 h-px bg-border-subtle z-0" />
                  <div className="grid grid-cols-5 gap-2 relative z-10">
                    {/* Node 01 */}
                    <div className="flex flex-col items-start">
                      <div className="w-2.5 h-2.5 rounded-full bg-action-primary ring-4 ring-surface-page" />
                      <span className="font-mono text-eyebrow font-semibold text-action-primary mt-2">
                        01 Analyze
                      </span>
                    </div>
                    {/* Node 02 */}
                    <div className="flex flex-col items-start">
                      <div className="w-2.5 h-2.5 rounded-full bg-border-default ring-4 ring-surface-page" />
                      <span className="font-mono text-eyebrow text-content-tertiary mt-2">
                        02 Prep
                      </span>
                    </div>
                    {/* Node 03 */}
                    <div className="flex flex-col items-start">
                      <div className="w-2.5 h-2.5 rounded-full bg-border-default ring-4 ring-surface-page" />
                      <span className="font-mono text-eyebrow text-content-tertiary mt-2">
                        03 Practice
                      </span>
                    </div>
                    {/* Node 04 */}
                    <div className="flex flex-col items-start">
                      <div className="w-2.5 h-2.5 rounded-full bg-border-default ring-4 ring-surface-page" />
                      <span className="font-mono text-eyebrow text-content-tertiary mt-2">
                        04 Report
                      </span>
                    </div>
                    {/* Node 05 */}
                    <div className="flex flex-col items-start">
                      <div className="w-2.5 h-2.5 rounded-full bg-border-default ring-4 ring-surface-page" />
                      <span className="font-mono text-eyebrow text-content-tertiary mt-2">
                        05 Outcome
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Center hairline separator for desktop */}
            <div className="hidden lg:block absolute left-[58.333333%] top-0 bottom-0 w-px bg-border-subtle" />

            {/* Right Column (approx 42% width / 5 cols) */}
            <div className="lg:col-span-5 lg:pl-12 pt-10 lg:pt-0 border-t border-border-subtle lg:border-t-0">
              {errorMessage && (
                <div className="mb-6">
                  <Banner variant="risk" title="Notice" description={errorMessage} />
                </div>
              )}

              <form onSubmit={handleSubmit} className="flex flex-col">
                {/* Step 01 */}
                <div className="flex items-baseline justify-between mb-2">
                  <span className="font-mono text-eyebrow font-medium text-content-tertiary tracking-wider uppercase">
                    STEP 01
                  </span>
                  <h2 className="font-sans text-heading-3 font-semibold text-content-primary">
                    Your resume
                  </h2>
                </div>

                {/* Resume Mode Toggle (if user has saved resumes) */}
                {savedResumes.length > 0 && (
                  <div className="flex items-center gap-4 mb-3 border-b border-border-subtle pb-1">
                    <button
                      type="button"
                      onClick={() => setUseSavedResume(false)}
                      className={`text-small font-medium pb-1.5 border-b-2 transition-colors cursor-pointer ${
                        !useSavedResume
                          ? 'border-action-primary text-content-primary'
                          : 'border-transparent text-content-tertiary hover:text-content-primary'
                      }`}
                    >
                      Upload new PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => setUseSavedResume(true)}
                      className={`text-small font-medium pb-1.5 border-b-2 transition-colors cursor-pointer ${
                        useSavedResume
                          ? 'border-action-primary text-content-primary'
                          : 'border-transparent text-content-tertiary hover:text-content-primary'
                      }`}
                    >
                      Use a saved resume ({savedResumes.length})
                    </button>
                  </div>
                )}

                {/* Dropzone or Saved Resume Selector */}
                {useSavedResume && savedResumes.length > 0 ? (
                  <div className="space-y-2 p-3 bg-surface-raised border border-border-control rounded-(--radius-control)">
                    <label className="block text-small font-medium text-content-primary mb-1">
                      Select saved resume
                    </label>
                    <select
                      value={selectedResumeId}
                      onChange={(e) => setSelectedResumeId(e.target.value)}
                      disabled={loading}
                      className="w-full h-10 px-3 rounded-(--radius-control) bg-surface-page border border-border-control text-small text-content-primary focus:outline-none focus:border-action-primary cursor-pointer"
                    >
                      {savedResumes.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.fileName}
                        </option>
                      ))}
                    </select>
                    <p className="text-eyebrow text-content-tertiary font-mono pt-1">
                      Reuses parsed structure directly — skipping upload & re-parsing.
                    </p>
                  </div>
                ) : (
                  <Dropzone
                    accept="application/pdf"
                    file={file}
                    onFileSelect={(f) => setFile(f)}
                    disabled={loading}
                  />
                )}

                {/* Step 02 */}
                <div className="flex items-baseline justify-between mt-6 mb-2">
                  <span className="font-mono text-eyebrow font-medium text-content-tertiary tracking-wider uppercase">
                    STEP 02
                  </span>
                  <h2 className="font-sans text-heading-3 font-semibold text-content-primary">
                    The job
                  </h2>
                </div>

                {/* Textarea */}
                <textarea
                  id="job-input"
                  name="jobInput"
                  rows={3}
                  value={jobInput}
                  onChange={(e) => setJobInput(e.target.value)}
                  disabled={loading}
                  placeholder="Paste the job link or the description..."
                  className="w-full h-28 p-3 rounded-(--radius-control) bg-surface-raised border border-border-control text-small text-content-primary placeholder:text-content-tertiary focus:outline-none focus:border-action-primary focus:ring-1 focus:ring-action-focus-ring transition-all resize-none font-sans"
                />

                {/* CTA Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 mt-4 rounded-(--radius-control) bg-action-primary hover:bg-action-primary-hover active:scale-[0.99] text-content-on-action font-medium text-small flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{statusMessage || 'Analyzing…'}</span>
                    </>
                  ) : (
                    <>
                      <span>Analyze my odds</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                {/* Reassurance note & Consent line */}
                <div className="flex items-center justify-center gap-1.5 text-eyebrow text-content-tertiary text-center mt-3">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Your resume stays private. Delete it any time.</span>
                </div>
                <div className="text-center mt-2 text-eyebrow text-content-tertiary">
                  By uploading, you agree to our{' '}
                  <Link href="/terms" className="underline hover:text-content-primary">
                    Terms
                  </Link>{' '}
                  and{' '}
                  <Link href="/privacy" className="underline hover:text-content-primary">
                    Privacy Policy
                  </Link>
                  .
                </div>
              </form>
            </div>
          </section>

          {/* Hairline Divider */}
          <div className="w-full h-px bg-border-subtle my-16" />

          {/* ========================================================= */}
          {/* SECTION 2: HOW TRACE WORKS */}
          {/* ========================================================= */}
          <section className="w-full">
            <span className="font-mono text-eyebrow uppercase tracking-widest text-content-tertiary block">
              HOW TRACE WORKS
            </span>
            <h2 className="font-sans text-heading-1 font-semibold text-content-primary mt-2 mb-8">
              A clear diagnosis at every stage.
            </h2>

            <div className="flex flex-col border-t border-border-subtle">
              {/* Row 01 */}
              <div className="min-h-20 py-4 px-3 flex flex-col md:flex-row md:items-center justify-between border-b border-border-subtle hover:bg-surface-sunken transition-colors">
                <div className="flex items-baseline gap-6 md:w-1/3">
                  <span className="font-mono text-small text-content-tertiary">01</span>
                  <span className="font-sans text-heading-3 font-semibold text-content-primary">
                    Read the job honestly
                  </span>
                </div>
                <div className="md:w-2/3 pl-10 md:pl-0 mt-2 md:mt-0">
                  <p className="font-sans text-small text-content-secondary">
                    Identifies phantom job postings, unstated minimum criteria, and ATS parsing traps.
                  </p>
                </div>
              </div>

              {/* Row 02 */}
              <div className="min-h-20 py-4 px-3 flex flex-col md:flex-row md:items-center justify-between border-b border-border-subtle hover:bg-surface-sunken transition-colors">
                <div className="flex items-baseline gap-6 md:w-1/3">
                  <span className="font-mono text-small text-content-tertiary">02</span>
                  <span className="font-sans text-heading-3 font-semibold text-content-primary">
                    Fix what is holding you back
                  </span>
                </div>
                <div className="md:w-2/3 pl-10 md:pl-0 mt-2 md:mt-0">
                  <p className="font-sans text-small text-content-secondary">
                    Line-by-line factual rewrites that pass strict fact-locking—no made-up experience.
                  </p>
                </div>
              </div>

              {/* Row 03 */}
              <div className="min-h-20 py-4 px-3 flex flex-col md:flex-row md:items-center justify-between border-b border-border-subtle hover:bg-surface-sunken transition-colors">
                <div className="flex items-baseline gap-6 md:w-1/3">
                  <span className="font-mono text-small text-content-tertiary">03</span>
                  <span className="font-sans text-heading-3 font-semibold text-content-primary">
                    Practice out loud
                  </span>
                </div>
                <div className="md:w-2/3 pl-10 md:pl-0 mt-2 md:mt-0">
                  <p className="font-sans text-small text-content-secondary">
                    A 5-minute timed voice simulation with an interactive AI interviewer before you face the real panel.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Hairline Divider */}
          <div className="w-full h-px bg-border-subtle my-16" />

          {/* ========================================================= */}
          {/* SECTION 3: SAMPLE DIAGNOSIS */}
          {/* ========================================================= */}
          <section className="w-full">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 pb-4 border-b border-border-subtle">
              <div>
                <span className="font-mono text-eyebrow uppercase tracking-widest text-content-tertiary block">
                  SAMPLE DIAGNOSIS
                </span>
                <h3 className="font-sans text-heading-2 font-semibold text-content-primary mt-1">
                  Role: Junior Backend Engineer
                </h3>
              </div>
              <div className="mt-2 md:mt-0">
                <span className="font-mono text-eyebrow text-content-tertiary">
                  SPECIFICATION ID: TRC-20498
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
              {/* Left: Verdict Summary */}
              <div className="lg:col-span-5 flex flex-col justify-start">
                <span className="font-mono text-eyebrow uppercase tracking-wider text-content-tertiary mb-2 block">
                  HONEST ODDS
                </span>
                <div className="flex items-center gap-3">
                  <span className="font-sans text-heading-1 font-semibold text-status-caution-content">
                    Fair
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-(--radius-chip) border border-status-caution-border bg-status-caution-surface text-status-caution-content font-mono text-eyebrow font-medium">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    COMPETITIVE MATCH
                  </span>
                </div>

                {/* Multi-tier metrics visual rail */}
                <div className="mt-6">
                  <div className="relative w-full h-1.5 rounded-sm bg-border-subtle overflow-hidden flex">
                    <div className="w-1/3 h-full bg-status-risk-surface" />
                    <div className="w-1/3 h-full bg-status-caution-surface" />
                    <div className="w-1/3 h-full bg-status-strong-surface" />
                  </div>
                  {/* Indicator marker in Amber band */}
                  <div className="relative w-full h-4">
                    <div className="absolute left-[48%] -top-1 -translate-x-1/2 flex flex-col items-center">
                      <div className="w-0 h-0 border-l-4 border-l-transparent border-r-4 border-r-transparent border-b-4 border-b-content-primary" />
                      <div className="w-0.5 h-1.5 bg-content-primary" />
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-eyebrow font-mono text-content-tertiary mt-1">
                    <span>Confidence: Medium</span>
                    <span>4 signals found</span>
                  </div>
                </div>
              </div>

              {/* Right: Factor Breakdown Rows */}
              <div className="lg:col-span-7 flex flex-col">
                {/* Factor Row 1 */}
                <div className="py-4 border-b border-border-subtle">
                  <div className="flex justify-between items-baseline mb-2">
                    <span className="font-sans text-small font-semibold text-content-primary">
                      Skill coverage
                    </span>
                    <span className="font-mono text-small font-medium text-status-caution-content">
                      58
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-sm bg-border-subtle overflow-hidden">
                    <div className="h-full bg-status-caution-mark rounded-sm" style={{ width: '58%' }} />
                  </div>
                  <p className="font-sans text-eyebrow text-content-tertiary mt-2">
                    Evidence: Matches Python and SQL; lacks Docker in production.
                  </p>
                </div>

                {/* Factor Row 2 */}
                <div className="py-4 border-b border-border-subtle">
                  <div className="flex justify-between items-baseline mb-2">
                    <span className="font-sans text-small font-semibold text-content-primary">
                      Level fit
                    </span>
                    <span className="font-mono text-small font-medium text-status-strong-content">
                      90
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-sm bg-border-subtle overflow-hidden">
                    <div className="h-full bg-status-strong-mark rounded-sm" style={{ width: '90%' }} />
                  </div>
                  <p className="font-sans text-eyebrow text-content-tertiary mt-2">
                    Evidence: Experience level matches 0-1 yr requirement exactly.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Hairline Divider */}
          <div className="w-full h-px bg-border-subtle my-16" />

          {/* ========================================================= */}
          {/* SECTION 4: THE TRACE PLEDGE */}
          {/* ========================================================= */}
          <section className="w-full pb-8">
            <span className="font-mono text-eyebrow uppercase tracking-widest text-content-tertiary block">
              THE TRACE PLEDGE
            </span>
            <h2 className="font-sans text-heading-2 font-semibold text-content-primary mt-2 mb-8">
              Built for trust, not false hope.
            </h2>

            <div className="flex flex-col border-t border-border-subtle">
              {/* Row 1 */}
              <div className="py-4 flex items-center justify-between border-b border-border-subtle hover:bg-surface-sunken transition-colors">
                <div className="flex items-center gap-4">
                  <CheckCircle2 className="w-5 h-5 text-status-strong-content shrink-0" />
                  <span className="font-sans text-small text-content-primary">
                    Never invent your achievements or hallucinate credentials.
                  </span>
                </div>
                <span className="font-mono text-eyebrow text-content-tertiary uppercase">
                  Integrity 01
                </span>
              </div>

              {/* Row 2 */}
              <div className="py-4 flex items-center justify-between border-b border-border-subtle hover:bg-surface-sunken transition-colors">
                <div className="flex items-center gap-4">
                  <CheckCircle2 className="w-5 h-5 text-status-strong-content shrink-0" />
                  <span className="font-sans text-small text-content-primary">
                    Never show fake percentage probabilities (e.g. &apos;87% chance of hire&apos;).
                  </span>
                </div>
                <span className="font-mono text-eyebrow text-content-tertiary uppercase">
                  Integrity 02
                </span>
              </div>

              {/* Row 3 */}
              <div className="py-4 flex items-center justify-between border-b border-border-subtle hover:bg-surface-sunken transition-colors">
                <div className="flex items-center gap-4">
                  <CheckCircle2 className="w-5 h-5 text-status-strong-content shrink-0" />
                  <span className="font-sans text-small text-content-primary">
                    Never flag a job posting without explaining the specific evidence.
                  </span>
                </div>
                <span className="font-mono text-eyebrow text-content-tertiary uppercase">
                  Integrity 03
                </span>
              </div>

              {/* Row 4 */}
              <div className="py-4 flex items-center justify-between border-b border-border-subtle hover:bg-surface-sunken transition-colors">
                <div className="flex items-center gap-4">
                  <CheckCircle2 className="w-5 h-5 text-status-strong-content shrink-0" />
                  <span className="font-sans text-small text-content-primary">
                    Never sell or share your resume with third-party recruiters.
                  </span>
                </div>
                <span className="font-mono text-eyebrow text-content-tertiary uppercase">
                  Integrity 04
                </span>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full bg-surface-page border-t border-border-subtle py-8">
        <div className="max-w-(--size-content-max) mx-auto px-6 sm:px-12 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="font-mono text-eyebrow text-content-tertiary uppercase tracking-wider">
            © 2026 TRACE DIAGNOSTICS. ALL RIGHTS RESERVED.
          </div>
          <div className="flex items-center gap-6">
            <Link
              href="/privacy"
              className="font-sans text-eyebrow text-content-tertiary hover:text-content-primary transition-colors"
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              className="font-sans text-eyebrow text-content-tertiary hover:text-content-primary transition-colors"
            >
              Terms
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
