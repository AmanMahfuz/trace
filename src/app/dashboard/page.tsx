'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  getPendingUpload,
  clearPendingUpload,
} from '@/lib/storage/upload-handoff';
import { AppHeader } from '@/design-system/patterns/AppHeader';
import { ApplicationRow } from '@/design-system/patterns/ApplicationRow';
import { Dialog } from '@/design-system/patterns/Dialog';
import { Dropzone } from '@/design-system/primitives/Dropzone';
import { Toast } from '@/design-system/primitives/Toast';
import { Banner } from '@/design-system/primitives/Banner';
import { ThisWeekStrip } from '@/components/ThisWeekStrip';
import { ApplicationForPlanner } from '@/lib/planner';
import {
  Search,
  Plus,
  Trash2,
  FileSearch,
  Loader2,
} from 'lucide-react';

interface ApplicationData {
  id: string;
  status: string;
  outcome?: string;
  odds?: { band: string };
  ghost?: { level: string };
  created_at: string;
  jobs?: {
    title: string;
    company: string;
    location?: string;
  };
}

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();

  const [apps, setApps] = useState<ApplicationData[]>([]);
  const [filter, setFilter] = useState<'all' | 'applied' | 'waiting' | 'closed'>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Modal states
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [analyzeModalOpen, setAnalyzeModalOpen] = useState(false);
  const [analyzeFile, setAnalyzeFile] = useState<File | null>(null);
  const [jobInput, setJobInput] = useState('');
  const [analyzeLoading, setAnalyzeLoading] = useState(false);
  const [analyzeError, setAnalyzeError] = useState('');
  const [analyzeStatus, setAnalyzeStatus] = useState('');

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const isHandoff =
        typeof window !== 'undefined' &&
        new URLSearchParams(window.location.search).get('handoff') === '1';

      const pending = await getPendingUpload();

      if (pending) {
        try {
          const formData = new FormData();
          formData.append('file', pending.file);
          if (pending.jobInput.startsWith('http://') || pending.jobInput.startsWith('https://')) {
            formData.append('jobUrl', pending.jobInput);
          } else {
            formData.append('jobText', pending.jobInput);
          }

          const res = await fetch('/api/analyze', { method: 'POST', body: formData });
          if (res.ok) {
            const resultData = await res.json();
            await clearPendingUpload();
            router.push(`/prep/${resultData.applicationId}`);
            return;
          }
        } catch {
          // Fall through
        }
      } else if (isHandoff) {
        router.push('/?message=missing_upload');
        return;
      }

      const { data, error } = await supabase
        .from('applications')
        .select('*, jobs(title, company, location)')
        .order('created_at', { ascending: false });

      if (!error && data) {
        setApps(data as ApplicationData[]);
      }
      setLoading(false);
    }
    load();
  }, [router, supabase]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const updateOutcome = async (id: string, outcome: string) => {
    setUpdatingId(id);
    try {
      await fetch(`/api/applications/${id}/outcome`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outcome }),
      });

      setApps((prev) =>
        prev.map((app) =>
          app.id === id
            ? { ...app, outcome, status: outcome === 'applied' ? 'applied' : 'closed' }
            : app
        )
      );
      showToast(`Outcome updated to "${outcome}"`);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleConfirmDeleteData = async () => {
    setDeleteLoading(true);
    try {
      await fetch('/api/delete-account', { method: 'DELETE' });
      await supabase.auth.signOut();
      router.push('/');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleAnalyzeJob = async (e: React.FormEvent) => {
    e.preventDefault();
    setAnalyzeError('');

    if (!analyzeFile) {
      setAnalyzeError('Please upload your resume in PDF format (up to 5 MB).');
      return;
    }

    if (!jobInput.trim()) {
      setAnalyzeError('Paste a job posting URL or job description text.');
      return;
    }

    setAnalyzeLoading(true);
    setAnalyzeStatus('Reading resume & analyzing posting…');

    const formData = new FormData();
    formData.append('file', analyzeFile);
    if (jobInput.trim().startsWith('http://') || jobInput.trim().startsWith('https://')) {
      formData.append('jobUrl', jobInput.trim());
    } else {
      formData.append('jobText', jobInput.trim());
    }

    try {
      const res = await fetch('/api/analyze', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Analysis failed. Please try again.');
      }
      router.push(`/prep/${data.applicationId}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Analysis failed';
      setAnalyzeError(msg);
      setAnalyzeLoading(false);
    }
  };

  // Metrics
  const totalAnalyzed = apps.length;
  const totalApplied = apps.filter((a) => a.outcome === 'applied').length;
  const totalWaiting = apps.filter((a) => !a.outcome || a.status === 'saved').length;
  const totalClosed = apps.filter((a) =>
    ['rejected', 'ghosted', 'offer', 'interview_no_offer'].includes(a.outcome || '')
  ).length;

  const filteredApps = apps.filter((app) => {
    const matchesSearch =
      !search ||
      (app.jobs?.title || '').toLowerCase().includes(search.toLowerCase()) ||
      (app.jobs?.company || '').toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;

    if (filter === 'all') return true;
    if (filter === 'applied') return app.outcome === 'applied';
    if (filter === 'waiting') return !app.outcome || app.status === 'saved';
    if (filter === 'closed')
      return ['rejected', 'ghosted', 'offer', 'interview_no_offer'].includes(app.outcome || '');
    return true;
  });

  return (
    <div className="min-h-screen flex flex-col bg-surface-page text-content-primary">
      <AppHeader />

      <main id="main-content" className="w-full flex-1">
        <div className="max-w-(--size-content-max) mx-auto px-6 sm:px-12 py-10">
          {/* Top Section: Header & Primary Command */}
          <section className="w-full flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6">
            <div className="flex flex-col gap-1.5">
              <h1 className="font-sans text-heading-1 text-content-primary tracking-tight">
                Your applications
              </h1>
              <p className="font-mono text-eyebrow text-content-tertiary tracking-wider uppercase">
                {totalAnalyzed} analyzed · {totalApplied} applied · {totalWaiting} waiting for an
                outcome
              </p>
            </div>

            <button
              type="button"
              onClick={() => setAnalyzeModalOpen(true)}
              className="h-11 px-5 bg-action-primary hover:bg-action-primary-hover text-content-on-action font-medium text-small rounded-(--radius-control) transition-all flex items-center gap-2 active:scale-[0.99] cursor-pointer shrink-0 self-start md:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Analyze a new job</span>
            </button>
          </section>

          {/* "This week" Next Steps (Priority ordered: deadlines -> overdue logs -> prep -> proof -> triage) */}
          <ThisWeekStrip applications={apps as unknown as ApplicationForPlanner[]} />

          {/* Filter, Search, and Tab Navigation Substrate */}
          <section className="w-full mt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              {/* Underline Tabs */}
              <nav aria-label="Application categories" className="flex items-center gap-6">
                <button
                  type="button"
                  onClick={() => setFilter('all')}
                  className={`pb-3 text-small font-medium transition-colors cursor-pointer border-b-2 ${
                    filter === 'all'
                      ? 'border-action-primary text-content-primary'
                      : 'border-transparent text-content-tertiary hover:text-content-primary'
                  }`}
                >
                  All ({totalAnalyzed})
                </button>
                <button
                  type="button"
                  onClick={() => setFilter('applied')}
                  className={`pb-3 text-small font-medium transition-colors cursor-pointer border-b-2 ${
                    filter === 'applied'
                      ? 'border-action-primary text-content-primary'
                      : 'border-transparent text-content-tertiary hover:text-content-primary'
                  }`}
                >
                  Applied ({totalApplied})
                </button>
                <button
                  type="button"
                  onClick={() => setFilter('waiting')}
                  className={`pb-3 text-small font-medium transition-colors cursor-pointer border-b-2 ${
                    filter === 'waiting'
                      ? 'border-action-primary text-content-primary'
                      : 'border-transparent text-content-tertiary hover:text-content-primary'
                  }`}
                >
                  Waiting ({totalWaiting})
                </button>
                <button
                  type="button"
                  onClick={() => setFilter('closed')}
                  className={`pb-3 text-small font-medium transition-colors cursor-pointer border-b-2 ${
                    filter === 'closed'
                      ? 'border-action-primary text-content-primary'
                      : 'border-transparent text-content-tertiary hover:text-content-primary'
                  }`}
                >
                  Closed ({totalClosed})
                </button>
              </nav>

              {/* Search Input */}
              <div className="relative w-full sm:w-72 pb-3">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-content-tertiary pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search role or company..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full h-10 pl-9 pr-3 text-small bg-surface-raised border border-border-subtle focus:border-action-primary rounded-(--radius-control) text-content-primary placeholder:text-content-tertiary outline-none transition-colors"
                />
              </div>
            </div>

            {/* 1px Continuous Hairline Seam */}
            <div className="w-full h-px bg-border-subtle" />
          </section>

          {/* Applications List (NO CARDS: Tabular list rows divided by 1px rules) */}
          <div className="w-full">
            {loading ? (
              <div className="space-y-4 py-8">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-surface-sunken rounded animate-pulse" />
                ))}
              </div>
            ) : filteredApps.length === 0 ? (
              /* Clean Minimalist Empty State */
              <section className="w-full py-16 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 flex items-center justify-center rounded-full bg-surface-sunken mb-4 text-content-tertiary">
                  <FileSearch className="w-8 h-8" />
                </div>
                <h2 className="font-sans text-heading-3 text-content-primary font-medium">
                  No applications tracked yet
                </h2>
                <p className="text-small text-content-tertiary max-w-md mt-1 mb-6">
                  Analyze your first role to evaluate ghost-probability, diagnostic odds, and
                  tailoring gaps before submitting.
                </p>
                <button
                  type="button"
                  onClick={() => setAnalyzeModalOpen(true)}
                  className="h-11 px-5 bg-action-primary hover:bg-action-primary-hover text-content-on-action font-medium text-small rounded-(--radius-control) transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Analyze your first job</span>
                </button>
              </section>
            ) : (
              <div className="flex flex-col w-full">
                {filteredApps.map((app) => (
                  <ApplicationRow
                    key={app.id}
                    id={app.id}
                    title={app.jobs?.title || 'Target Role'}
                    company={app.jobs?.company || 'Company'}
                    location={app.jobs?.location}
                    oddsBand={app.odds?.band}
                    ghostLevel={app.ghost?.level}
                    status={app.status}
                    outcome={app.outcome}
                    createdAt={app.created_at}
                    onOutcomeChange={updateOutcome}
                    updating={updatingId === app.id}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Bottom Section: "Your data" Privacy & Purge Spec */}
          <section className="w-full mt-16 pt-8 border-t border-border-subtle">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              <div className="flex flex-col gap-1 max-w-2xl">
                <h3 className="text-eyebrow font-semibold text-content-primary tracking-tight uppercase font-mono">
                  Your data
                </h3>
                <p className="text-small text-content-tertiary">
                  Trace never sells your resume or shares your application history with employers.
                  You can purge your entire record at any time.
                </p>
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => setDeleteModalOpen(true)}
                  className="h-11 px-4 rounded-(--radius-control) border border-status-risk-border bg-surface-raised hover:bg-status-risk-surface text-status-risk-content text-small font-medium transition-colors flex items-center gap-2 whitespace-nowrap active:scale-[0.99] cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete my data</span>
                </button>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full bg-surface-page border-t border-border-subtle py-6">
        <div className="max-w-(--size-content-max) mx-auto px-6 sm:px-12 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="font-mono text-eyebrow text-content-tertiary uppercase">
            © 2026 TRACE ANALYTICS. ALL RIGHTS RESERVED.
          </p>
          <div className="flex items-center gap-6">
            <a
              href="/privacy"
              className="font-mono text-eyebrow text-content-tertiary hover:text-content-primary transition-colors uppercase"
            >
              Privacy
            </a>
            <a
              href="/terms"
              className="font-mono text-eyebrow text-content-tertiary hover:text-content-primary transition-colors uppercase"
            >
              Terms
            </a>
          </div>
        </div>
      </footer>

      {/* Analyze New Job Dialog */}
      <Dialog
        isOpen={analyzeModalOpen}
        onClose={() => {
          if (!analyzeLoading) setAnalyzeModalOpen(false);
        }}
        title="Analyze a new job"
        description="Drop your resume and paste the target job description to evaluate honest odds and ghost risk."
      >
        {analyzeError && (
          <div className="mb-4">
            <Banner variant="risk" title="Notice" description={analyzeError} />
          </div>
        )}

        <form onSubmit={handleAnalyzeJob} className="space-y-4">
          <div>
            <label className="block text-small font-medium text-content-primary mb-1">
              Resume (PDF, max 5 MB)
            </label>
            <Dropzone
              accept="application/pdf"
              file={analyzeFile}
              onFileSelect={(f) => setAnalyzeFile(f)}
              disabled={analyzeLoading}
            />
          </div>

          <div>
            <label className="block text-small font-medium text-content-primary mb-1">
              Job URL or Description
            </label>
            <textarea
              rows={4}
              placeholder="Paste job link or full job requirements..."
              value={jobInput}
              onChange={(e) => setJobInput(e.target.value)}
              disabled={analyzeLoading}
              className="w-full p-3 rounded-(--radius-control) bg-surface-raised border border-border-control text-small text-content-primary placeholder:text-content-tertiary focus:outline-none focus:border-action-primary focus:ring-1 focus:ring-action-focus-ring font-sans resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              disabled={analyzeLoading}
              onClick={() => setAnalyzeModalOpen(false)}
              className="h-10 px-4 rounded-(--radius-control) border border-border-control text-small font-medium text-content-primary hover:bg-surface-sunken transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={analyzeLoading}
              className="h-10 px-5 rounded-(--radius-control) bg-action-primary hover:bg-action-primary-hover text-content-on-action text-small font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              {analyzeLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{analyzeStatus || 'Analyzing…'}</span>
                </>
              ) : (
                'Start Analysis'
              )}
            </button>
          </div>
        </form>
      </Dialog>

      {/* Delete Account / Data Confirmation Dialog */}
      <Dialog
        isOpen={deleteModalOpen}
        onClose={() => {
          if (!deleteLoading) setDeleteModalOpen(false);
        }}
        title="Delete all data"
        description="This action is permanent and unrecoverable. Your resume, application records, interview scorecards, and credentials will be purged permanently."
      >
        <div className="space-y-4">
          <p className="text-small text-content-secondary">
            Type <strong className="font-mono text-status-risk-content">DELETE</strong> to confirm:
          </p>
          <input
            type="text"
            value={deleteInput}
            onChange={(e) => setDeleteInput(e.target.value)}
            placeholder="DELETE"
            className="w-full h-10 px-3 rounded-(--radius-control) border border-border-control bg-surface-raised font-mono text-small text-content-primary outline-none focus:border-status-risk-content"
          />

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              disabled={deleteLoading}
              onClick={() => setDeleteModalOpen(false)}
              className="h-10 px-4 rounded-(--radius-control) border border-border-control text-small font-medium text-content-primary hover:bg-surface-sunken transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={deleteInput !== 'DELETE' || deleteLoading}
              onClick={handleConfirmDeleteData}
              className="h-10 px-5 rounded-(--radius-control) bg-status-risk-content hover:opacity-90 text-content-on-action text-small font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              {deleteLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Deleting…</span>
                </>
              ) : (
                'Permanently Delete'
              )}
            </button>
          </div>
        </div>
      </Dialog>

      {toastMessage && <Toast message={toastMessage} onClose={() => setToastMessage(null)} />}
    </div>
  );
}
