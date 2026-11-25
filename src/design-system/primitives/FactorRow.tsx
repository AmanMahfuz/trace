import React from 'react';
import { Rail } from './Rail';

export interface FactorRowProps {
  label: string;
  score: number;
  evidence?: string;
  className?: string;
}

export function FactorRow({
  label,
  score,
  evidence,
  className = '',
}: FactorRowProps) {
  const hasEvidence = Boolean(evidence && evidence.trim().length > 0);
  const displayEvidence = hasEvidence ? evidence : 'Not enough information provided.';
  const clampedScore = Math.max(0, Math.min(100, Math.round(score)));

  return (
    <div className={`py-3 border-b border-border-subtle space-y-1.5 ${className}`}>
      <div className="flex items-center justify-between gap-4">
        <span className="text-small font-medium text-content-primary">
          {label}
        </span>

        <div className="flex items-center gap-3 flex-1 max-w-44">
          <Rail
            variant="score"
            value={hasEvidence ? clampedScore : 0}
            label={`${label}: ${clampedScore} out of 100`}
            className="flex-1"
          />
          <span className="font-mono text-eyebrow text-content-secondary tabular-nums w-6 text-right">
            {clampedScore}
          </span>
        </div>
      </div>

      <p className="text-small text-content-tertiary leading-relaxed">
        {displayEvidence}
      </p>
    </div>
  );
}
