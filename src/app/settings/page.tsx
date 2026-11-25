'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { AppHeader } from '@/design-system/patterns/AppHeader';
import { Button } from '@/design-system/primitives/Button';
import { Toast } from '@/design-system/primitives/Toast';
import { Dialog } from '@/design-system/patterns/Dialog';
import { Loader2 } from 'lucide-react';

const GRAD_YEARS = [2022, 2023, 2024, 2025, 2026, 2027, 2028];
const BRANCHES = [
  'B.Tech CSE', 'B.Tech IT', 'B.Tech ECE', 'B.Tech EEE', 'B.Tech Mechanical',
  'B.Tech Civil', 'B.E CSE', 'B.E IT', 'B.E ECE', 'MCA', 'M.Tech CSE', 'M.Tech IT', 'Other',
];

export default function SettingsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Profile fields
  const [fullName, setFullName] = useState('');
  const [gradYear, setGradYear] = useState<number | ''>('');
  const [branch, setBranch] = useState('');
  const [aggregatePct, setAggregatePct] = useState<string>('');
  const [activeBacklogs, setActiveBacklogs] = useState<number>(0);
  const [track, setTrack] = useState<'software' | 'data' | 'other'>('software');
  const [credits, setCredits] = useState<number>(3);
  const [userId, setUserId] = useState<string>('');
  const [userEmail, setUserEmail] = useState<string>('');

  // Delete modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      setUserId(user.id);
      setUserEmail(user.email ?? '');

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (profile) {
        setFullName(profile.full_name || '');
        setGradYear(profile.grad_year ?? '');
        setBranch(profile.branch || '');
        setAggregatePct(profile.aggregate_pct != null ? String(profile.aggregate_pct) : '');
        setActiveBacklogs(profile.active_backlogs ?? 0);
        setTrack(profile.track || 'software');
        setCredits(profile.credits ?? 3);
      }
      setLoading(false);
    }
    loadProfile();
  }, [supabase, router]);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const { error } = await supabase.from('profiles').upsert({
        id: userId,
        full_name: fullName,
        grad_year: gradYear !== '' ? Number(gradYear) : null,
        branch: branch || null,
        aggregate_pct: aggregatePct !== '' ? Number(aggregatePct) : null,
        active_backlogs: Number(activeBacklogs),
        track,
      }, { onConflict: 'id' });

      if (error) throw error;
      setToastMessage('Profile updated successfully.');
    } catch {
      setToastMessage('Failed to save profile. Try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleExportData() {
    try {
      const [profileRes, resumesRes, appsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).single(),
        supabase.from('resumes').select('id, parsed, created_at').eq('user_id', userId),
        supabase.from('applications').select('id, status, outcome, created_at, odds, ghost, eligibility').eq('user_id', userId),
      ]);

      const exportData = {
        exportedAt: new Date().toISOString(),
        profile: profileRes.data,
        resumes: resumesRes.data,
        applications: appsRes.data,
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `trace-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setToastMessage('Data exported successfully.');
    } catch {
      setToastMessage('Export failed. Try again.');
    }
  }

  async function handleDeleteAccount() {
    if (deleteInput !== 'DELETE') return;
    setDeleteLoading(true);

    try {
      const res = await fetch('/api/delete-account', { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      await supabase.auth.signOut();
      router.push('/');
    } catch {
      setToastMessage('Failed to delete account. Try again.');
      setDeleteLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-page flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-action-primary" aria-label="Loading settings" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-page flex flex-col">
      <AppHeader userEmail={userEmail} credits={credits} />

      <main id="main-content" className="w-full flex-1 max-w-(--size-content-max) mx-auto px-6 sm:px-12 py-10">
        <div className="max-w-2xl mx-auto space-y-12">
          {/* Header */}
          <div>
            <p className="font-mono text-eyebrow uppercase tracking-widest text-content-tertiary mb-1">
              ACCOUNT & PREFERENCES
            </p>
            <h1 className="font-sans text-heading-1 font-semibold text-content-primary">
              Settings
            </h1>
          </div>

          {/* Section 1: Profile (IT Fresher fields) */}
          <section aria-labelledby="profile-heading" className="space-y-6">
            <div className="border-b border-border-subtle pb-3">
              <h2 id="profile-heading" className="font-sans text-heading-3 text-content-primary">
                Fresher Profile
              </h2>
              <p className="font-sans text-small text-content-secondary mt-1">
                These details are used by the Eligibility Checker to test job posts against hard criteria.
              </p>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block font-mono text-eyebrow uppercase tracking-widest text-content-tertiary mb-1">
                  Full name
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Asha Nair"
                  className="w-full h-(--input-height) px-3 rounded-(--radius-md) border border-border-control bg-surface-raised text-body text-content-primary focus:outline-action-primary"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-mono text-eyebrow uppercase tracking-widest text-content-tertiary mb-1">
                    Graduation year
                  </label>
                  <select
                    value={gradYear}
                    onChange={(e) => setGradYear(e.target.value ? Number(e.target.value) : '')}
                    className="w-full h-(--input-height) px-3 rounded-(--radius-md) border border-border-control bg-surface-raised text-body text-content-primary focus:outline-action-primary"
                  >
                    <option value="">Select passout year…</option>
                    {GRAD_YEARS.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-mono text-eyebrow uppercase tracking-widest text-content-tertiary mb-1">
                    Branch / Degree
                  </label>
                  <select
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    className="w-full h-(--input-height) px-3 rounded-(--radius-md) border border-border-control bg-surface-raised text-body text-content-primary focus:outline-action-primary"
                  >
                    <option value="">Select branch…</option>
                    {BRANCHES.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-mono text-eyebrow uppercase tracking-widest text-content-tertiary mb-1">
                    Aggregate percentage (%)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    value={aggregatePct}
                    onChange={(e) => setAggregatePct(e.target.value)}
                    placeholder="e.g. 72.5"
                    className="w-full h-(--input-height) px-3 rounded-(--radius-md) border border-border-control bg-surface-raised text-body text-content-primary focus:outline-action-primary"
                  />
                </div>

                <div>
                  <label className="block font-mono text-eyebrow uppercase tracking-widest text-content-tertiary mb-1">
                    Active backlogs
                  </label>
                  <select
                    value={activeBacklogs}
                    onChange={(e) => setActiveBacklogs(Number(e.target.value))}
                    className="w-full h-(--input-height) px-3 rounded-(--radius-md) border border-border-control bg-surface-raised text-body text-content-primary focus:outline-action-primary"
                  >
                    <option value={0}>0 (no active backlogs)</option>
                    <option value={1}>1 active backlog</option>
                    <option value={2}>2 active backlogs</option>
                    <option value={3}>3+ active backlogs</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-mono text-eyebrow uppercase tracking-widest text-content-tertiary mb-1">
                  Target Track
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: 'software', label: 'Software / IT' },
                    { id: 'data', label: 'Data & Analytics' },
                    { id: 'other', label: 'Other Tech' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTrack(t.id as 'software' | 'data' | 'other')}
                      className={`h-(--button-height) rounded-(--radius-md) border text-small font-medium transition-colors text-center ${
                        track === t.id
                          ? 'border-action-primary bg-action-subtle text-action-primary'
                          : 'border-border-control bg-surface-raised text-content-secondary hover:bg-surface-sunken'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <Button type="submit" loading={saving}>
                  Save profile
                </Button>
              </div>
            </form>
          </section>

          {/* Section 2: Credits */}
          <section aria-labelledby="credits-heading" className="space-y-4 border-t border-border-subtle pt-8">
            <h2 id="credits-heading" className="font-sans text-heading-3 text-content-primary">
              Practice Credits
            </h2>
            <div className="p-4 bg-surface-raised border border-border-subtle rounded-(--radius-md) flex items-center justify-between">
              <div>
                <p className="font-mono text-heading-2 font-medium text-content-primary">
                  {credits}
                </p>
                <p className="font-sans text-small text-content-secondary">
                  Remaining AI interview & analysis credits
                </p>
              </div>
              <span className="font-mono text-eyebrow uppercase tracking-wider text-status-strong-content bg-status-strong-surface px-2.5 py-1 rounded-full border border-status-strong-border">
                ACTIVE PLAN
              </span>
            </div>
          </section>

          {/* Section 3: Data Export and Account Deletion */}
          <section aria-labelledby="data-heading" className="space-y-4 border-t border-border-subtle pt-8">
            <h2 id="data-heading" className="font-sans text-heading-3 text-content-primary">
              Your Data & Privacy
            </h2>
            <p className="font-sans text-small text-content-secondary">
              Trace never sells your data or trains models on your resume. You can download everything or delete your account permanently.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Button variant="secondary" onClick={handleExportData}>
                Export all my data (JSON)
              </Button>
              <Button variant="danger" onClick={() => setDeleteModalOpen(true)}>
                Delete account permanently
              </Button>
            </div>
          </section>
        </div>
      </main>

      {/* Delete Confirmation Dialog */}
      <Dialog
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Delete account permanently"
      >
        <div className="space-y-4">
          <p className="font-sans text-small text-content-secondary">
            This will permanently remove your account, profile, all uploaded resumes, applications, and practice session transcripts. This action cannot be undone.
          </p>
          <p className="font-sans text-small font-medium text-content-primary">
            Type <span className="font-mono text-status-risk-content">DELETE</span> to confirm:
          </p>
          <input
            type="text"
            value={deleteInput}
            onChange={(e) => setDeleteInput(e.target.value)}
            placeholder="DELETE"
            className="w-full h-(--input-height) px-3 rounded-(--radius-md) border border-border-control bg-surface-raised text-body text-content-primary font-mono focus:outline-action-primary"
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setDeleteModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={deleteInput !== 'DELETE'}
              loading={deleteLoading}
              onClick={handleDeleteAccount}
            >
              Permanently delete
            </Button>
          </div>
        </div>
      </Dialog>

      {toastMessage && (
        <Toast
          message={toastMessage}
          onClose={() => setToastMessage(null)}
        />
      )}
    </div>
  );
}
