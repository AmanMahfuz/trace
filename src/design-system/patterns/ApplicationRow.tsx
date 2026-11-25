'use client';

import React from 'react';
import Link from 'next/link';
import { getOddsMeta, getGhostMeta } from './bandMeta';
import {
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  ShieldCheck,
  ShieldAlert,
  HelpCircle,
} from 'lucide-react';

export interface ApplicationRowProps {
  id: string;
  title: string;
  company: string;
  location?: string;
  oddsBand?: string;
  ghostLevel?: string;
  status: string;
  outcome?: string;
  createdAt: string;
  onOutcomeChange: (id: string, outcome: string) => void;
  updating?: boolean;
}

export function ApplicationRow({
  id,
  title,
  company,
  location,
  oddsBand,
  ghostLevel,
  status,
  outcome,
  createdAt,
  onOutcomeChange,
  updating = false,
}: ApplicationRowProps) {
  const oddsMeta = oddsBand ? getOddsMeta(oddsBand) : null;
  const ghostMeta = ghostLevel ? getGhostMeta(ghostLevel) : null;

  const createdDate = new Date(createdAt);
  const diffDays = Math.floor((Date.now() - createdDate.getTime()) / (1000 * 3600 * 24));
  const showNudge = (!outcome || outcome === 'applied') && diffDays >= 14;

  const hasAutopsy = ['rejected', 'ghosted', 'interview_no_offer'].includes(outcome || '');

  return (
    <div className="w-full flex flex-col border-b border-border-subtle transition-colors">
      <div className="w-full min-h-18 py-4 hover:bg-surface-sunken flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition-colors">
        {/* Left: Role and company info */}
        <div className="flex flex-col min-w-60">
          <Link
            href={`/prep/${id}`}
            className="font-medium text-small text-content-primary hover:text-action-primary transition-colors tracking-tight"
          >
            {title || 'Target Role'}
          </Link>
          <span className="text-eyebrow text-content-tertiary">
            {company || 'Company'} {location ? `· ${location}` : ''} ·{' '}
            {diffDays === 0 ? 'Analyzed today' : `Analyzed ${diffDays}d ago`}
          </span>
        </div>

        {/* Center: Odds and Risk Metrics */}
        <div className="flex flex-wrap items-center gap-3">
          {oddsMeta && (
            <div
              className={`inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full border text-eyebrow font-mono font-medium ${
                oddsMeta.chipVariant === 'strong'
                  ? 'border-status-strong-border bg-status-strong-surface text-status-strong-content'
                  : oddsMeta.chipVariant === 'caution'
                  ? 'border-status-caution-border bg-status-caution-surface text-status-caution-content'
                  : 'border-status-risk-border bg-status-risk-surface text-status-risk-content'
              }`}
            >
              {oddsMeta.chipVariant === 'strong' ? (
                <CheckCircle2 className="w-3.5 h-3.5" />
              ) : oddsMeta.chipVariant === 'caution' ? (
                <AlertTriangle className="w-3.5 h-3.5" />
              ) : (
                <AlertOctagon className="w-3.5 h-3.5" />
              )}
              <span>{oddsMeta.label} odds</span>
            </div>
          )}

          {ghostMeta && (
            <div
              className={`inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full border text-eyebrow font-mono font-medium ${
                ghostMeta.chipVariant === 'strong'
                  ? 'border-status-strong-border bg-status-strong-surface text-status-strong-content'
                  : ghostMeta.chipVariant === 'caution'
                  ? 'border-status-caution-border bg-status-caution-surface text-status-caution-content'
                  : 'border-status-risk-border bg-status-risk-surface text-status-risk-content'
              }`}
            >
              {ghostMeta.chipVariant === 'strong' ? (
                <ShieldCheck className="w-3.5 h-3.5" />
              ) : (
                <ShieldAlert className="w-3.5 h-3.5" />
              )}
              <span>{ghostMeta.label}</span>
            </div>
          )}

          <span className="text-eyebrow text-content-secondary pl-1 font-mono">
            {outcome === 'offer'
              ? 'Offer received'
              : outcome === 'rejected'
              ? 'Rejected by ATS'
              : outcome === 'ghosted'
              ? 'Ghosted'
              : outcome === 'interview_no_offer'
              ? 'Interview, no offer'
              : outcome === 'interview'
              ? 'Interview scheduled'
              : outcome === 'applied'
              ? 'Applied via portal'
              : status === 'ready'
              ? 'Tailoring ready'
              : 'In progress'}
          </span>
        </div>

        {/* Right: Actions and Status Select */}
        <div className="flex items-center gap-4 self-end lg:self-center">
          {hasAutopsy && (
            <Link
              href={`/why-not/${id}`}
              className="h-9 px-3 rounded-(--radius-control) bg-action-subtle hover:bg-action-subtle-hover text-action-primary border border-action-primary/20 text-small font-medium transition-colors flex items-center gap-1"
            >
              <HelpCircle className="w-4 h-4" />
              <span>Why-Not report</span>
            </Link>
          )}

          <div className="relative">
            <select
              disabled={updating}
              value={outcome || (status === 'applied' ? 'applied' : 'in_review')}
              onChange={(e) => onOutcomeChange(id, e.target.value)}
              className="h-10 pl-3 pr-8 bg-surface-raised border border-border-subtle hover:border-border-control rounded-(--radius-control) text-small text-content-primary outline-none transition-colors appearance-none cursor-pointer"
            >
              <option value="in_review">In review</option>
              <option value="applied">Applied</option>
              <option value="interview">Interview</option>
              <option value="interview_no_offer">Interview (no offer)</option>
              <option value="rejected">Rejected</option>
              <option value="ghosted">Ghosted</option>
              <option value="offer">Offer</option>
            </select>
          </div>

          <Link
            href={`/prep/${id}`}
            className="text-action-primary hover:text-action-primary-hover font-medium text-small transition-colors flex items-center gap-0.5 whitespace-nowrap"
          >
            <span>Open</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* 14-day Outcome Nudge Seam */}
      {showNudge && (
        <div className="w-full bg-surface-page border-t border-border-subtle px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-action-primary animate-pulse" />
            <span className="text-small text-content-secondary">
              Heard anything back? Log it so Trace can learn.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOutcomeChange(id, 'applied')}
              className="h-8 px-3 rounded-(--radius-control) bg-surface-raised border border-border-subtle hover:bg-surface-sunken text-small text-content-secondary font-medium transition-colors"
            >
              Still waiting
            </button>
            <button
              type="button"
              onClick={() => onOutcomeChange(id, 'ghosted')}
              className="h-8 px-3 rounded-(--radius-control) bg-action-primary hover:bg-action-primary-hover text-content-on-action text-small font-medium transition-colors"
            >
              Log ghosted
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
