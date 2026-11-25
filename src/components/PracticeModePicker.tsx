'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/design-system/primitives/Button';
import { Chip } from '@/design-system/primitives/Chip';
import { ArrowRight, Mic, MicOff, AlertTriangle } from 'lucide-react';

export type PracticeMode = 'self-intro' | 'project-deepdive' | 'hr' | 'full-round';

interface PracticeModeConfig {
  mode: PracticeMode;
  durationSeconds: number;
  durationLabel: string;
  name: string;
  description: string;
  creditCost: number; // 0 = free (rate limited)
  freePerDay?: number;
  rules: string[];
}

const MODES: PracticeModeConfig[] = [
  {
    mode: 'self-intro',
    durationSeconds: 60,
    durationLabel: '01:00',
    name: 'Self-introduction',
    description: "60-second opening statement. Covers your background, what you've built, and why this role.",
    creditCost: 0,
    freePerDay: 5,
    rules: [
      'You have 60 seconds. Pace yourself — aim for 130–150 words.',
      'Cover: who you are, what you built, why this role.',
      "Don't mention anything not in your resume. Fact-lock is on.",
      'A short report is generated when you finish.',
    ],
  },
  {
    mode: 'project-deepdive',
    durationSeconds: 180,
    durationLabel: '03:00',
    name: 'Project deep-dive',
    description: 'Three questions on your strongest project. Covers what you built, your decisions, and results.',
    creditCost: 1,
    rules: [
      'Trace asks 3 questions about your project. Answer out loud or type.',
      'You have 3 minutes total. Pace yourself.',
      "Don't mention numbers or outcomes not in your resume. Fact-lock is on.",
      'A report is generated when you finish.',
    ],
  },
  {
    mode: 'hr',
    durationSeconds: 180,
    durationLabel: '03:00',
    name: 'HR round',
    description: 'Behavioral questions: tell me about yourself, strengths, why this company, handling failure.',
    creditCost: 1,
    rules: [
      'Trace asks 3–4 HR-style behavioral questions.',
      'You have 3 minutes total.',
      'Answer honestly — these are scored on structure and authenticity, not keyword match.',
      'A report is generated when you finish.',
    ],
  },
  {
    mode: 'full-round',
    durationSeconds: 300,
    durationLabel: '05:00',
    name: 'Full round',
    description: 'Self-intro, one project question and one HR question. Closest to a real interview.',
    creditCost: 1,
    rules: [
      'Self-introduction (60 s), one project question, one HR question.',
      'You have 5 minutes total — budget your time per section.',
      'Fact-lock is on throughout.',
      'A full report is generated when you finish.',
    ],
  },
];

function recommendedMode(
  nextStageMode?: string | null
): PracticeMode {
  if (nextStageMode && MODES.some(m => m.mode === nextStageMode)) {
    return nextStageMode as PracticeMode;
  }
  return 'self-intro';
}

interface PracticeModePickerProps {
  applicationId: string;
  applicationTitle?: string;
  nextStageMode?: string | null;
  creditBalance: number;
  onSessionStart?: (sessionId: string, mode: PracticeMode, firstQuestion?: string) => void;
}

type PickerView = 'grid' | 'prestart';

export function PracticeModePicker({
  applicationId,
  applicationTitle,
  nextStageMode,
  creditBalance,
  onSessionStart,
}: PracticeModePickerProps) {
  const supabase = createClient();
  const [view, setView] = useState<PickerView>('grid');
  const [selectedMode, setSelectedMode] = useState<PracticeModeConfig | null>(null);
  const [micReady, setMicReady] = useState<boolean | null>(null); // null = not checked
  const [textMode, setTextMode] = useState(false);
  const [starting, setStarting] = useState(false);
  const [selfIntroUsedToday, setSelfIntroUsedToday] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);

  const recommended = recommendedMode(nextStageMode);

  // Check self-intro usage for today
  useEffect(() => {
    async function checkUsage() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const today = new Date().toISOString().slice(0, 10);
      const { count } = await supabase
        .from('credit_ledger')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .like('reason', 'self-intro:%')
        .gte('created_at', `${today}T00:00:00Z`);
      setSelfIntroUsedToday(count ?? 0);
    }
    checkUsage();
  }, [supabase]);

  function canStart(mode: PracticeModeConfig): boolean {
    if (mode.creditCost === 0) {
      return selfIntroUsedToday < (mode.freePerDay ?? 5);
    }
    return creditBalance >= mode.creditCost;
  }

  function unavailableReason(mode: PracticeModeConfig): string | null {
    if (mode.creditCost === 0 && selfIntroUsedToday >= (mode.freePerDay ?? 5)) {
      return 'Daily limit reached';
    }
    if (mode.creditCost > 0 && creditBalance < mode.creditCost) {
      return 'Not enough credits';
    }
    return null;
  }

  function selectMode(mode: PracticeModeConfig) {
    if (!canStart(mode)) return;
    setSelectedMode(mode);
    setView('prestart');
    setMicReady(null);
    setTextMode(false);
    setError(null);
    requestMic();
  }

  async function requestMic() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      setMicReady(true);
    } catch {
      setMicReady(false);
    }
  }

  async function startSession() {
    if (!selectedMode) return;
    setStarting(true);
    setError(null);

    try {
      const res = await fetch('/api/interview/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationId,
          mode: selectedMode.mode,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.error === 'INSUFFICIENT_CREDITS') {
          setError('Not enough credits to start this session.');
        } else {
          setError(data.error || 'Failed to start practice round.');
        }
        setStarting(false);
        return;
      }

      // Release mic if text mode
      if (textMode && micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((t) => t.stop());
      }

      onSessionStart?.(data.sessionId, selectedMode.mode, data.firstQuestion);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.');
      setStarting(false);
    }
  }

  // ── Grid view ──
  if (view === 'grid') {
    return (
      <div>
        {applicationTitle && (
          <div className="flex items-center justify-between gap-4 mb-4 px-4 py-3 bg-surface-raised border border-border-subtle rounded-[--radius-md]">
            <p className="text-small text-content-secondary">
              Practicing for <strong className="text-content-primary">{applicationTitle}</strong>
            </p>
            <a href="/dashboard" className="text-small text-content-tertiary hover:text-content-secondary">
              Change job
            </a>
          </div>
        )}

        <div
          className="grid grid-cols-2 border border-border-default rounded-[--radius-lg] overflow-hidden bg-surface-raised"
          role="list"
          aria-label="Practice modes"
        >
          {MODES.map((mode, idx) => {
            const isRecommended = mode.mode === recommended;
            const unavailable = unavailableReason(mode);
            const gridBorder = [
              'border-r border-b border-border-subtle',
              'border-b border-border-subtle',
              'border-r border-border-subtle',
              '',
            ][idx] ?? '';

            return (
              <button
                key={mode.mode}
                role="listitem"
                onClick={() => selectMode(mode)}
                disabled={!!unavailable}
                className={`flex flex-col p-5 text-left relative transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action-focus-ring focus-visible:ring-inset disabled:opacity-50 disabled:pointer-events-none ${gridBorder} ${
                  isRecommended ? 'bg-action-subtle hover:bg-action-subtle-hover' : 'hover:bg-surface-sunken'
                }`}
                aria-label={`${mode.name}, ${mode.durationLabel}${isRecommended ? ', recommended' : ''}${unavailable ? `, ${unavailable}` : ''}`}
              >
                {isRecommended && (
                  <span className="absolute top-3 right-3 text-eyebrow uppercase tracking-widest text-action-primary bg-surface-raised border border-action-primary/30 rounded-full px-2 py-0.5">
                    Recommended
                  </span>
                )}

                <span
                  className="font-mono text-[2rem] leading-none font-medium tracking-tight text-content-primary mb-2"
                  aria-hidden="true"
                >
                  {mode.durationLabel}
                </span>
                <span className="text-small font-semibold text-content-primary mb-1">{mode.name}</span>
                <span className="text-small text-content-secondary leading-snug mb-3 flex-1">{mode.description}</span>

                <div className="flex items-center justify-between mt-auto">
                  {mode.creditCost === 0 ? (
                    <span className="text-small text-status-strong-content font-medium">
                      Free · {(mode.freePerDay ?? 5) - selfIntroUsedToday} left today
                    </span>
                  ) : (
                    <span className="text-small text-content-tertiary">
                      {mode.creditCost} credit
                    </span>
                  )}
                  <span className="text-small text-content-link inline-flex items-center gap-1">
                    Start <ArrowRight className="w-3 h-3" aria-hidden="true" />
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Pre-start view ──
  if (view === 'prestart' && selectedMode) {
    return (
      <div className="border border-border-default rounded-[--radius-lg] overflow-hidden bg-surface-raised">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 p-5 border-b border-border-subtle">
          <div>
            <span
              className="font-mono text-[2.75rem] leading-none font-medium tracking-tight text-content-primary block"
              aria-hidden="true"
            >
              {selectedMode.durationLabel}
            </span>
            <span className="text-heading-3 text-content-primary block mt-1">{selectedMode.name}</span>
          </div>
          <div className="flex flex-col items-end gap-1">
            {selectedMode.creditCost > 0 && (
              <Chip
                label={`${selectedMode.creditCost} credit · ${creditBalance} remaining`}
                variant="neutral"
              />
            )}
          </div>
        </div>

        {/* Body */}
        <div className="p-5">
          <p className="text-eyebrow uppercase tracking-widest text-content-tertiary mb-3">What happens</p>

          <ol className="divide-y divide-border-subtle mb-4" aria-label="Session rules">
            {selectedMode.rules.map((rule, i) => (
              <li key={i} className="flex items-start gap-3 py-2.5">
                <span className="font-mono text-small text-content-tertiary w-5 shrink-0 pt-px">{i + 1}</span>
                <span className="text-small text-content-secondary leading-relaxed">{rule}</span>
              </li>
            ))}
          </ol>

          {/* Mic check */}
          {!textMode && (
            <div className="flex items-center justify-between gap-4 p-3 bg-surface-sunken border border-border-subtle rounded-[--radius-md] mb-3">
              <div className="flex items-center gap-2">
                {micReady === true ? (
                  <Mic className="w-4 h-4 text-status-strong-content" aria-hidden="true" />
                ) : micReady === false ? (
                  <MicOff className="w-4 h-4 text-status-risk-content" aria-hidden="true" />
                ) : (
                  <Mic className="w-4 h-4 text-content-tertiary" aria-hidden="true" />
                )}
                <span className="text-small text-content-secondary">Microphone</span>
              </div>
              <div className="flex items-center gap-2">
                {micReady === true ? (
                  <span className="text-small text-status-strong-content font-medium flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-status-strong-mark animate-pulse" aria-hidden="true" />
                    Ready
                  </span>
                ) : micReady === false ? (
                  <span className="text-small text-status-risk-content">Blocked</span>
                ) : (
                  <span className="text-small text-content-tertiary">Checking…</span>
                )}
              </div>
            </div>
          )}

          {/* Voice privacy + text fallback */}
          <div className="flex items-start gap-2 mb-1">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-content-disabled" aria-hidden="true" />
            <p className="text-small text-content-tertiary">
              Your browser&apos;s speech recognition may send audio to the browser vendor.{' '}
              <button
                onClick={() => {
                  setTextMode(true);
                  if (micStreamRef.current) {
                    micStreamRef.current.getTracks().forEach(t => t.stop());
                    micStreamRef.current = null;
                  }
                  setMicReady(null);
                }}
                className="text-content-link hover:underline"
              >
                Switch to typing
              </button>{' '}
              to avoid this.
            </p>
          </div>

          {textMode && (
            <p className="text-small text-status-strong-content mt-1">Text mode active — no mic used.</p>
          )}

          {error && (
            <p className="text-small text-status-risk-content mt-3 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-5 py-4 border-t border-border-subtle">
          <Button
            loading={starting}
            onClick={startSession}
            disabled={!textMode && micReady === false}
          >
            Start session
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setView('grid');
              setSelectedMode(null);
              if (micStreamRef.current) {
                micStreamRef.current.getTracks().forEach(t => t.stop());
                micStreamRef.current = null;
              }
            }}
          >
            ← Back
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
