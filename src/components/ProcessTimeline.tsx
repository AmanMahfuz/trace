'use client';

import React, { useState } from 'react';
import { Chip } from '@/design-system/primitives/Chip';
import { Button } from '@/design-system/primitives/Button';
import { Plus, GripVertical, Calendar, FileText } from 'lucide-react';

export type StageStatus = 'done' | 'current' | 'upcoming' | 'locked';
export type ProcessSource = 'jd' | 'playbook' | 'default';

export interface ProcessStage {
  id: string;
  name: string;
  status: StageStatus;
  date?: string | null;
  notes?: string | null;
  practiceMode?: string | null;
}

export interface ProcessStagesData {
  source: ProcessSource;
  stages: ProcessStage[];
  playbookName?: string;
  playbookDate?: string;
  jdSourceLabel?: string;
}

interface ProcessTimelineProps {
  applicationId: string;
  data: ProcessStagesData | null;
  onSave?: (data: ProcessStagesData) => void;
}

const DEFAULT_IT_STAGES: ProcessStage[] = [
  { id: 'resume-screen', name: 'Resume screening', status: 'done', practiceMode: null },
  { id: 'online-test', name: 'Online test', status: 'upcoming', practiceMode: 'self-intro' },
  { id: 'technical', name: 'Technical interview', status: 'locked', practiceMode: 'project-deepdive' },
  { id: 'hr', name: 'HR interview', status: 'locked', practiceMode: 'hr' },
  { id: 'decision', name: 'Decision', status: 'locked', practiceMode: null },
];

function sourceLabelText(data: ProcessStagesData): { text: string; variant: 'playbook' | 'jd' | 'default' } {
  if (data.source === 'jd') {
    return { text: data.jdSourceLabel ?? 'From the job post', variant: 'jd' };
  }
  if (data.source === 'playbook' && data.playbookName) {
    return {
      text: `Typical for ${data.playbookName}${data.playbookDate ? ` · last checked ${data.playbookDate}` : ''}`,
      variant: 'playbook',
    };
  }
  return { text: 'Typical · not confirmed for this company', variant: 'default' };
}

function statusToVariant(status: StageStatus) {
  switch (status) {
    case 'done':     return 'strong' as const;
    case 'current':  return 'accent' as const;
    case 'upcoming': return 'caution' as const;
    case 'locked':   return 'neutral' as const;
  }
}

function statusChipLabel(status: StageStatus) {
  switch (status) {
    case 'done':     return 'Done';
    case 'current':  return 'Current';
    case 'upcoming': return 'Upcoming';
    case 'locked':   return 'Not started';
  }
}

const PRACTICE_MODE_LABELS: Record<string, string> = {
  'self-intro': 'Practice intro',
  'project-deepdive': 'Practice deep-dive',
  'hr': 'Practice HR',
  'full-round': 'Practice full round',
};

export function ProcessTimeline({ applicationId, data, onSave }: ProcessTimelineProps) {
  const [editing, setEditing] = useState(false);
  const [stages, setStages] = useState<ProcessStage[]>(() => {
    return data?.stages ?? DEFAULT_IT_STAGES;
  });
  const source: ProcessSource = data?.source ?? 'default';
  const [editingDateId, setEditingDateId] = useState<string | null>(null);

  const resolved: ProcessStagesData = {
    source,
    stages,
    playbookName: data?.playbookName,
    playbookDate: data?.playbookDate,
    jdSourceLabel: data?.jdSourceLabel,
  };

  const { text: sourceLabelStr, variant: sourceLabelVariant } = sourceLabelText(resolved);

  function updateStage(id: string, patch: Partial<ProcessStage>) {
    setStages(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
  }

  function addStage() {
    const newStage: ProcessStage = {
      id: `custom-${Date.now()}`,
      name: 'New stage',
      status: 'locked',
    };
    setStages(prev => [...prev, newStage]);
  }

  async function save() {
    // Persist to applications table
    const { createClient } = await import('@/lib/supabase/client');
    const supabase = createClient();
    await supabase.from('applications').update({ process_stages: resolved }).eq('id', applicationId);
    onSave?.(resolved);
    setEditing(false);
  }

  return (
    <section aria-labelledby="process-heading" className="border-t border-border-subtle pt-[--space-stack-lg]">
      <div className="flex items-baseline justify-between mb-[--space-stack-sm]">
        <div>
          <p className="text-eyebrow uppercase tracking-widest text-content-tertiary mb-[--space-stack-xs]">
            Hiring process
          </p>
          <h2 id="process-heading" className="text-heading-3 text-content-primary">
            What to expect
          </h2>
        </div>
        <button
          onClick={() => setEditing(e => !e)}
          className="text-small text-content-tertiary hover:text-content-secondary transition-colors"
        >
          {editing ? 'Cancel' : 'Edit'}
        </button>
      </div>

      {/* Source label */}
      <div className={`flex items-center gap-1.5 mb-[--space-stack-md] text-eyebrow uppercase tracking-widest ${
        sourceLabelVariant === 'playbook' ? 'text-action-primary' :
        sourceLabelVariant === 'jd' ? 'text-status-strong-content' :
        'text-content-disabled'
      }`}>
        {sourceLabelVariant === 'playbook' && (
          <svg width="10" height="10" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
            <path d="M6 1l1.09 3.35H10.5L7.7 6.52l1.04 3.35L6 7.7 2.26 9.87 3.3 6.52.5 4.35h3.41L6 1z"/>
          </svg>
        )}
        {sourceLabelStr}
      </div>

      {/* Timeline */}
      <ol className="list-none" aria-label="Hiring stages">
        {stages.map((stage, idx) => {
          const isLast = idx === stages.length - 1;
          return (
            <li key={stage.id} className="flex items-start gap-4">
              {/* Track */}
              <div className="flex flex-col items-center w-5 shrink-0">
                <div
                  className={`w-2.5 h-2.5 rounded-full border-2 shrink-0 ${
                    stage.status === 'done'
                      ? 'bg-status-strong-mark border-status-strong-mark'
                      : stage.status === 'current'
                      ? 'bg-action-primary border-action-primary shadow-[0_0_0_3px_var(--color-action-subtle)]'
                      : 'bg-surface-raised border-border-default'
                  }`}
                />
                {!isLast && (
                  <div className="w-px flex-1 min-h-8 bg-border-subtle mt-0.5" />
                )}
              </div>

              {/* Content */}
              <div className={`flex-1 pb-4 ${isLast ? '' : ''}`}>
                {editing ? (
                  <div className="flex items-start gap-2">
                    <GripVertical className="w-4 h-4 text-content-disabled mt-0.5 shrink-0" aria-hidden="true" />
                    <div className="flex-1">
                      <input
                        value={stage.name}
                        onChange={e => updateStage(stage.id, { name: e.target.value })}
                        className="text-small font-medium text-content-primary bg-transparent border-b border-border-control focus:outline-none focus:border-action-primary w-full mb-1"
                      />
                      <div className="flex items-center gap-2 flex-wrap">
                        <select
                          value={stage.status}
                          onChange={e => updateStage(stage.id, { status: e.target.value as StageStatus })}
                          className="text-small border border-border-control rounded-[--radius-sm] px-1.5 py-0.5 bg-surface-raised text-content-primary"
                        >
                          <option value="done">Done</option>
                          <option value="current">Current</option>
                          <option value="upcoming">Upcoming</option>
                          <option value="locked">Not started</option>
                        </select>
                        <input
                          type="date"
                          value={stage.date ?? ''}
                          onChange={e => updateStage(stage.id, { date: e.target.value || null })}
                          className="text-small border border-border-control rounded-[--radius-sm] px-1.5 py-0.5 bg-surface-raised text-content-primary"
                        />
                      </div>
                      {stage.notes !== undefined && (
                        <input
                          value={stage.notes ?? ''}
                          onChange={e => updateStage(stage.id, { notes: e.target.value || null })}
                          placeholder="Notes…"
                          className="mt-1 text-small text-content-secondary bg-transparent border-b border-border-subtle focus:outline-none focus:border-action-primary w-full"
                        />
                      )}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-small font-semibold ${
                        stage.status === 'locked' ? 'text-content-tertiary font-normal' : 'text-content-primary'
                      }`}>
                        {stage.name}
                      </span>
                      {stage.status !== 'locked' && (
                        <Chip label={statusChipLabel(stage.status)} variant={statusToVariant(stage.status)} />
                      )}
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      {stage.date && (
                        <span className="text-small text-content-tertiary flex items-center gap-1">
                          <Calendar className="w-3 h-3" aria-hidden="true" />
                          {new Date(stage.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      )}
                      {stage.notes && (
                        <span className="text-small text-content-tertiary flex items-center gap-1">
                          <FileText className="w-3 h-3" aria-hidden="true" />
                          {stage.notes}
                        </span>
                      )}
                      {stage.practiceMode && stage.status !== 'done' && (
                        <a
                          href={`/practice?application=${applicationId}&mode=${stage.practiceMode}`}
                          className="text-small text-content-link hover:underline"
                        >
                          {PRACTICE_MODE_LABELS[stage.practiceMode] ?? 'Practice'} →
                        </a>
                      )}
                      {stage.status === 'current' && !editingDateId && (
                        <button
                          onClick={() => setEditingDateId(stage.id)}
                          className="text-small text-content-tertiary hover:text-content-secondary"
                        >
                          Add date
                        </button>
                      )}
                    </div>
                    {editingDateId === stage.id && (
                      <div className="mt-1 flex items-center gap-2">
                        <input
                          type="date"
                          autoFocus
                          className="text-small border border-border-control rounded-[--radius-sm] px-1.5 py-0.5 bg-surface-raised text-content-primary"
                          onBlur={e => {
                            if (e.target.value) updateStage(stage.id, { date: e.target.value });
                            setEditingDateId(null);
                          }}
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {/* Edit actions */}
      {editing && (
        <div className="flex items-center gap-3 mt-2">
          <button
            onClick={addStage}
            className="text-small text-content-link hover:underline inline-flex items-center gap-1"
          >
            <Plus className="w-3 h-3" /> Add stage
          </button>
          <Button size="compact" onClick={save}>Save changes</Button>
        </div>
      )}

      {/* Source disclaimer for non-JD sources */}
      {source !== 'jd' && (
        <p className="mt-3 text-small text-content-tertiary">
          {source === 'default'
            ? 'Stages are a generic template. Edit them to match what this company actually uses.'
            : 'Stages are based on a sourced playbook and may not match this specific posting. Edit as needed.'}
        </p>
      )}
    </section>
  );
}
