'use client';

import React, { useState } from 'react';
import {
  Button,
  TextLink,
  Input,
  Textarea,
  Select,
  FormField,
  Chip,
  FilterChip,
  StatusIcon,
  Rule,
  Wordmark,
  Skeleton,
  Timer,
  Dropzone,
  Tabs,
  Rail,
  FactorRow,
  MetricStat,
  Toast,
  Banner,
} from '@/design-system/primitives';
import {
  AppHeader,
  JourneyStrip,
  Verdict,
  SignalList,
  Row,
  ApplicationRow,
  ChangeRow,
  ReasonRow,
  CompareRow,
  VoiceStage,
  Dialog,
  ActionBar,
  EmptyState,
} from '@/design-system/patterns';

export default function StyleguidePage() {
  const [activeTab, setActiveTab] = useState('primitives');
  const [filterSelected, setFilterSelected] = useState<string>('all');
  const [toastOpen, setToastOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dropFile, setDropFile] = useState<File | null>(null);

  return (
    <div className="min-h-screen bg-surface-page text-content-primary selection:bg-action-subtle pb-28">
      <AppHeader />

      <main className="max-w-(--size-content-max) mx-auto w-full px-6 lg:px-12 py-10 space-y-12">
        {/* Title */}
        <div className="space-y-3 pb-6 border-b border-border-subtle">
          <Wordmark />
          <h1 className="text-display font-semibold text-content-primary">
            Trace Design System v1.0.0 Styleguide
          </h1>
          <p className="text-body text-content-secondary max-w-2xl">
            Living component catalog and token verification. Built with strict 3-tier CSS tokens,
            light-theme-only surfaces, 0 cards, 0 raw hex colors, and 100% WCAG 2.2 AA compliant contrast.
          </p>

          <div className="pt-2">
            <Tabs
              tabs={[
                { id: 'primitives', label: 'Tier 2/3 Primitives' },
                { id: 'patterns', label: 'Domain Patterns' },
              ]}
              activeId={activeTab}
              onChange={setActiveTab}
            />
          </div>
        </div>

        {activeTab === 'primitives' && (
          <div className="space-y-16">
            {/* 1. BUTTONS */}
            <section className="space-y-6">
              <span className="font-mono text-eyebrow uppercase tracking-wider text-action-primary font-semibold block">
                01 · Buttons
              </span>
              <div className="flex flex-wrap items-center gap-4">
                <Button variant="primary">Primary Button</Button>
                <Button variant="secondary">Secondary Button</Button>
                <Button variant="ghost">Ghost Button</Button>
                <Button variant="danger">Danger Button</Button>
                <Button variant="primary" size="compact">Compact Size</Button>
                <Button variant="primary" loading>Loading State</Button>
                <Button variant="primary" disabled>Disabled State</Button>
              </div>
            </section>

            <Rule />

            {/* 2. FORM FIELDS & INPUTS */}
            <section className="space-y-6 max-w-(--size-reading-max)">
              <span className="font-mono text-eyebrow uppercase tracking-wider text-action-primary font-semibold block">
                02 · Form Fields &amp; Controls
              </span>
              <div className="space-y-4">
                <FormField label="Email address" required helperText="University domain (.edu) preferred.">
                  <Input type="email" placeholder="alex.chen@stanford.edu" />
                </FormField>

                <FormField label="Target job description" required>
                  <Textarea rows={3} placeholder="Paste job requirements here..." />
                </FormField>

                <FormField label="Application Outcome" required>
                  <Select defaultValue="applied">
                    <option value="applied">Applied</option>
                    <option value="interview">Interview Scheduled</option>
                    <option value="rejected">Rejected</option>
                    <option value="ghosted">Ghosted</option>
                  </Select>
                </FormField>

                <FormField label="Input with error state" error="Please enter a valid URL.">
                  <Input error defaultValue="invalid-url" />
                </FormField>

                <div className="pt-2">
                  <TextLink href="/dashboard" variant="action">
                    Dashboard link
                  </TextLink>
                </div>
              </div>
            </section>

            <Rule />

            {/* 3. CHIPS & STATUS ICONS */}
            <section className="space-y-6">
              <span className="font-mono text-eyebrow uppercase tracking-wider text-action-primary font-semibold block">
                03 · Status Chips &amp; Filter Chips &amp; Icons
              </span>
              <div className="flex flex-wrap items-center gap-3">
                <Chip label="Strong Match" variant="strong" icon={<StatusIcon status="strong" />} />
                <Chip label="Fair Shot" variant="caution" icon={<StatusIcon status="caution" />} />
                <Chip label="Long Shot" variant="risk" icon={<StatusIcon status="risk" />} />
                <Chip label="Neutral Pill" variant="neutral" />
                <Chip label="Accent Highlight" variant="accent" />
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-2">
                {(['all', 'applied', 'waiting', 'closed'] as const).map((filterId) => (
                  <FilterChip
                    key={filterId}
                    label={filterId}
                    selected={filterSelected === filterId}
                    onClick={() => setFilterSelected(filterId)}
                    count={filterId === 'all' ? 12 : 3}
                  />
                ))}
              </div>

              <div className="flex items-center gap-4 pt-2">
                <Timer secondsRemaining={240} />
                <Skeleton className="w-28 h-6" />
              </div>
            </section>

            <Rule />

            {/* 4. RAILS & METERS */}
            <section className="space-y-6 max-w-(--size-reading-max)">
              <span className="font-mono text-eyebrow uppercase tracking-wider text-action-primary font-semibold block">
                04 · Rails &amp; Meter Variants
              </span>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <span className="text-small font-medium text-content-primary">Score Rail (85% strong):</span>
                  <Rail variant="score" value={85} />
                </div>
                <div className="space-y-1.5">
                  <span className="text-small font-medium text-content-primary">Score Rail (52% caution):</span>
                  <Rail variant="score" value={52} />
                </div>
                <div className="space-y-1.5">
                  <span className="text-small font-medium text-content-primary">Score Rail (28% risk):</span>
                  <Rail variant="score" value={28} />
                </div>
                <div className="space-y-1.5">
                  <span className="text-small font-medium text-content-primary">Range Rail (138 wpm in 120-160 range):</span>
                  <Rail variant="range" value={138} min={0} max={200} rangeMin={120} rangeMax={160} />
                </div>
                <div className="space-y-1.5">
                  <span className="text-small font-medium text-content-primary">Verdict Rail:</span>
                  <Rail variant="verdict" value={72} />
                </div>
              </div>
            </section>

            <Rule />

            {/* 5. FACTOR ROWS & METRIC STATS */}
            <section className="space-y-6">
              <span className="font-mono text-eyebrow uppercase tracking-wider text-action-primary font-semibold block">
                05 · Factor Rows &amp; Metric Stats
              </span>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 py-4">
                <MetricStat label="Readiness" value={78} unit="/100" helperText="Clear technical context and claims grounded in resume." />
                <MetricStat label="Speaking Pace" value={138} unit="wpm" helperText="Target 120-160 wpm. Pacing is natural and steady." />
                <MetricStat label="Filler Words" value={3} helperText="Detected ticks: like (2), basically (1)." />
              </div>
              <div className="max-w-(--size-reading-max) space-y-1">
                <FactorRow label="Skill coverage" score={85} evidence="Direct matches found for TypeScript microservices, PostgreSQL transactions, and Next.js." />
                <FactorRow label="Proof strength" score={50} evidence="Internship bullets list technologies but lack quantifiable revenue or scale numbers." />
                <FactorRow label="Level fit" score={90} evidence="Job is verified entry-level and welcomes fresh graduate applicants." />
              </div>
            </section>

            <Rule />

            {/* 6. DROPZONE & BANNERS & NOTIFICATIONS */}
            <section className="space-y-6 max-w-(--size-reading-max)">
              <span className="font-mono text-eyebrow uppercase tracking-wider text-action-primary font-semibold block">
                06 · Dropzone &amp; Banners
              </span>
              <Dropzone file={dropFile} onFileSelect={setDropFile} />
              <Banner variant="info" title="Candidate-First Guarantee">
                Your resume and transcripts remain completely private and are never used to train public models.
              </Banner>
              <Banner variant="caution" title="Low Signal Job Post" actionLabel="Paste raw text" onAction={() => {}}>
                The job post URL returned less than 300 words. You can paste the raw job description text instead.
              </Banner>
              <Banner variant="risk" title="Prohibited Destination">
                The provided host points to a reserved internal network address.
              </Banner>
              <div>
                <Button variant="secondary" onClick={() => setToastOpen(true)}>
                  Trigger Transient Toast
                </Button>
                <Toast
                  message="Diagnostic report copied to clipboard."
                  isOpen={toastOpen}
                  onClose={() => setToastOpen(false)}
                  type="success"
                />
              </div>
            </section>
          </div>
        )}

        {activeTab === 'patterns' && (
          <div className="space-y-16">
            {/* PATTERN 1: JOURNEY STRIP */}
            <section className="space-y-4">
              <span className="font-mono text-eyebrow uppercase tracking-wider text-action-primary font-semibold block">
                Pattern 01 · Journey Strip
              </span>
              <JourneyStrip currentStep="prep" applicationId="demo-app" />
            </section>

            <Rule />

            {/* PATTERN 2: VERDICT & SIGNALS */}
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-12">
              <div className="lg:col-span-6 space-y-6">
                <span className="font-mono text-eyebrow uppercase tracking-wider text-action-primary font-semibold block">
                  Pattern 02 · The Verdict
                </span>
                <Verdict band="Strong" confidence="High" score={78} />
              </div>
              <div className="lg:col-span-6 space-y-6">
                <span className="font-mono text-eyebrow uppercase tracking-wider text-action-primary font-semibold block">
                  Pattern 03 · Ghost Risk Signals
                </span>
                <SignalList
                  signals={[
                    'First posted 42 days ago without updates',
                    'Evergreen recruitment wording: "join our talent pipeline for future openings"',
                    'Compensation and location omitted simultaneously',
                  ]}
                />
              </div>
            </section>

            <Rule />

            {/* PATTERN 4: ROWS & CHANGE ROWS */}
            <section className="space-y-6">
              <span className="font-mono text-eyebrow uppercase tracking-wider text-action-primary font-semibold block">
                Pattern 04 · List Rows (ApplicationRow, ChangeRow, ReasonRow)
              </span>

              <div className="space-y-4">
                <Row
                  title="Base generic Row item"
                  actions={<Chip label="Active" variant="strong" />}
                />

                <ApplicationRow
                  id="demo-1"
                  title="Software Engineer Intern"
                  company="Stripe"
                  location="Remote"
                  oddsBand="Strong"
                  ghostLevel="Low"
                  status="saved"
                  outcome="applied"
                  createdAt="2024-01-15T00:00:00.000Z"
                  onOutcomeChange={() => {}}
                />

                <ChangeRow
                  bulletId="b-1"
                  original="Implemented web features for the user dashboard."
                  suggested="Engineered user dashboard micro-features using TypeScript and React, reducing page render latency."
                  reason="Directly grounds the bullet in target TypeScript stack requirements."
                  onAccept={() => {}}
                  onDecline={() => {}}
                />

                <ReasonRow
                  index={0}
                  reason="Commercial production database experience was required."
                  likelihood="High"
                  basis="Job description prioritized live PostgreSQL transactions; resume only demonstrated academic coursework."
                />

                <CompareRow
                  question="How did you resolve database deadlocks?"
                  userSaid="I kind of looked at the logs and rebooted the server."
                  strongerVersion="I inspected the Postgres lock logs to identify concurrent updates, then implemented transaction order consistency."
                />
              </div>
            </section>

            <Rule />

            {/* PATTERN 5: VOICE STAGE DEMO */}
            <section className="space-y-6">
              <span className="font-mono text-eyebrow uppercase tracking-wider text-action-primary font-semibold block">
                Pattern 05 · Voice Arena Stage
              </span>
              <div className="border border-border-subtle rounded-(--radius-overlay) p-6">
                <VoiceStage
                  status="speaking"
                  captions="How did you structure concurrency in your internship microservice?"
                  turnIndex={2}
                  textMode={false}
                  fallbackInput=""
                  onFallbackInputChange={() => {}}
                  onFallbackSend={() => {}}
                />
              </div>
            </section>

            <Rule />

            {/* PATTERN 6: DIALOGS & ACTION BAR */}
            <section className="space-y-6">
              <span className="font-mono text-eyebrow uppercase tracking-wider text-action-primary font-semibold block">
                Pattern 06 · Overlays &amp; Fixed Action Bar
              </span>
              <div className="flex gap-4">
                <Button variant="danger" onClick={() => setDialogOpen(true)}>
                  Open Confirmation Dialog
                </Button>
              </div>

              <Dialog
                isOpen={dialogOpen}
                onClose={() => setDialogOpen(false)}
                title="End session and grade?"
                description="We will analyze your recorded voice sparring answers and generate your readiness report."
                primaryAction={{
                  label: 'End and grade',
                  onClick: () => setDialogOpen(false),
                }}
              />

              <EmptyState
                title="No applications tracked yet"
                description="Upload your resume and analyze your first job description to compute your honest odds."
                action={<Button variant="primary">Analyze a Job</Button>}
              />
            </section>
          </div>
        )}
      </main>

      <ActionBar
        statusText="Styleguide preview mode"
        primaryAction={<Button variant="primary">Primary Action</Button>}
        secondaryAction={<Button variant="secondary">Secondary Action</Button>}
      />
    </div>
  );
}
