'use client';

import React, { useState } from 'react';
import { Button } from '../primitives/Button';
import { Input } from '../primitives/Field';
import { HelpCircle, Check } from 'lucide-react';

export interface ChangeRowProps {
  bulletId: string;
  original: string;
  suggested?: string;
  reason: string;
  needsDetail?: { question: string };
  isAccepted?: boolean;
  isDeclined?: boolean;
  onAccept: (bulletId: string, detail?: string) => Promise<void> | void;
  onDecline: (bulletId: string) => Promise<void> | void;
  onUndo?: (bulletId: string) => Promise<void> | void;
  loading?: boolean;
  className?: string;
}

export function ChangeRow({
  bulletId,
  original,
  suggested,
  reason,
  needsDetail,
  isAccepted = false,
  isDeclined = false,
  onAccept,
  onDecline,
  onUndo,
  loading = false,
  className = '',
}: ChangeRowProps) {
  const [detailVal, setDetailVal] = useState('');

  if (isAccepted) {
    return (
      <div className={`py-4 border-b border-border-subtle flex items-center justify-between gap-4 ${className}`}>
        <div className="flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-status-strong-surface text-status-strong-content flex items-center justify-center shrink-0">
            <Check className="w-3.5 h-3.5" aria-hidden="true" />
          </span>
          <p className="text-small font-medium text-content-primary line-clamp-1">
            {suggested || original}
          </p>
        </div>

        {onUndo && (
          <Button
            type="button"
            variant="ghost"
            size="compact"
            onClick={() => onUndo(bulletId)}
            disabled={loading}
          >
            Undo
          </Button>
        )}
      </div>
    );
  }

  if (isDeclined) {
    return (
      <div className={`py-3 border-b border-border-subtle flex items-center justify-between gap-4 opacity-60 ${className}`}>
        <p className="text-small text-content-tertiary line-clamp-1">
          Declined: {original}
        </p>
        {onUndo && (
          <Button
            type="button"
            variant="ghost"
            size="compact"
            onClick={() => onUndo(bulletId)}
            disabled={loading}
          >
            Undo
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={`py-6 border-b border-border-subtle space-y-4 ${className}`}>
      <span className="font-mono text-eyebrow text-content-tertiary uppercase tracking-wider block">
        Experience · Highlighted Bullet
      </span>

      {/* Original text */}
      <div className="space-y-1">
        <span className="text-eyebrow font-mono text-content-disabled uppercase">Original</span>
        <p className="text-small text-content-tertiary leading-relaxed">
          {original}
        </p>
      </div>

      {/* Suggested rewrite */}
      {suggested && (
        <div className="p-4 bg-status-strong-surface border-l-4 border-status-strong-mark space-y-2">
          <span className="text-eyebrow font-mono text-status-strong-content uppercase font-semibold block">
            Suggested Rewrite
          </span>
          <p className="text-small text-content-primary font-medium leading-relaxed">
            {suggested}
          </p>
          <p className="text-small text-content-tertiary">
            {reason}
          </p>
        </div>
      )}

      {/* Needs detail prompt */}
      {needsDetail && (
        <div className="p-4 bg-status-caution-surface border-l-4 border-status-caution-mark space-y-3">
          <div className="flex items-center gap-2 text-status-caution-content">
            <HelpCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span className="text-small font-semibold">{needsDetail.question}</span>
          </div>

          <Input
            type="text"
            placeholder="Add factual detail (e.g. reduced load time from 4s to 1.2s)…"
            value={detailVal}
            onChange={(e) => setDetailVal(e.target.value)}
          />

          <p className="text-small text-content-tertiary">
            Trace will not invent metrics. Add your real numbers and it will rewrite the bullet.
          </p>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-3 pt-1">
        <Button
          type="button"
          variant="secondary"
          size="compact"
          onClick={() => onDecline(bulletId)}
          disabled={loading}
        >
          Decline
        </Button>

        <Button
          type="button"
          variant="primary"
          size="compact"
          onClick={() => onAccept(bulletId, detailVal.trim() || undefined)}
          disabled={loading}
          loading={loading}
        >
          {needsDetail && detailVal.trim() ? 'Rewrite with this' : 'Accept'}
        </Button>
      </div>
    </div>
  );
}
