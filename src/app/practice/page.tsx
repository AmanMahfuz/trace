'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { AppHeader } from '@/design-system/patterns/AppHeader';
import { PracticeModePicker } from '@/components/PracticeModePicker';
import { Loader2 } from 'lucide-react';

interface AppOption {
  id: string;
  title: string;
  company: string;
}

export default function PracticePage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [apps, setApps] = useState<AppOption[]>([]);
  const [selectedAppId, setSelectedAppId] = useState<string>('');
  const [credits, setCredits] = useState<number>(3);
  const [userEmail, setUserEmail] = useState<string>('');

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      setUserEmail(user.email ?? '');

      const { data: profile } = await supabase
        .from('profiles')
        .select('credits')
        .eq('id', user.id)
        .maybeSingle();

      if (profile) setCredits(profile.credits ?? 3);

      const { data: userApps } = await supabase
        .from('applications')
        .select('id, jobs(title, company)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (userApps && userApps.length > 0) {
        const formatted: AppOption[] = (userApps as unknown as Array<{ id: string; jobs?: { title?: string; company?: string } | Array<{ title?: string; company?: string }> }>).map((a) => {
          const rawJob = a.jobs;
          const job = Array.isArray(rawJob) ? rawJob[0] : rawJob;
          return {
            id: a.id,
            title: job?.title || 'Software Engineer',
            company: job?.company || 'Target Company',
          };
        });
        setApps(formatted);
        setSelectedAppId(formatted[0].id);
      }
      setLoading(false);
    }
    init();
  }, [supabase, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-page flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-action-primary" aria-label="Loading practice" />
      </div>
    );
  }

  const selectedApp = apps.find(a => a.id === selectedAppId);

  return (
    <div className="min-h-screen bg-surface-page flex flex-col">
      <AppHeader userEmail={userEmail} credits={credits} />

      <main id="main-content" className="w-full flex-1 max-w-(--size-content-max) mx-auto px-6 sm:px-12 py-10">
        <div className="max-w-2xl mx-auto space-y-8">
          <div>
            <p className="font-mono text-eyebrow uppercase tracking-widest text-content-tertiary mb-1">
              VOICE PRACTICE ARENA
            </p>
            <h1 className="font-sans text-heading-1 font-semibold text-content-primary">
              Choose a practice mode
            </h1>
            <p className="font-sans text-body text-content-secondary mt-1">
              Practice the specific rounds that eliminate freshers in IT hiring pipelines.
            </p>
          </div>

          {apps.length > 1 && (
            <div className="flex items-center gap-3">
              <label htmlFor="app-select" className="text-small font-medium text-content-secondary shrink-0">
                Job context:
              </label>
              <select
                id="app-select"
                value={selectedAppId}
                onChange={e => setSelectedAppId(e.target.value)}
                className="h-9 px-3 rounded-(--radius-md) border border-border-control bg-surface-raised text-small text-content-primary focus:outline-action-primary flex-1"
              >
                {apps.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.title} at {a.company}
                  </option>
                ))}
              </select>
            </div>
          )}

          {selectedAppId ? (
            <PracticeModePicker
              applicationId={selectedAppId}
              applicationTitle={selectedApp ? `${selectedApp.title} at ${selectedApp.company}` : undefined}
              creditBalance={credits}
              onSessionStart={(sessionId, mode) => {
                router.push(`/arena/${selectedAppId}?session=${sessionId}&mode=${mode}`);
              }}
            />
          ) : (
            <div className="p-8 text-center border border-dashed border-border-default rounded-(--radius-lg)">
              <p className="text-body text-content-secondary mb-3">
                Analyze a job first to practice with questions tailored to the posting and your resume.
              </p>
              <Link
                href="/"
                className="inline-flex items-center gap-2 px-4 py-2 bg-action-primary text-content-on-action rounded-(--radius-control) text-small font-medium"
              >
                Analyze a job →
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
