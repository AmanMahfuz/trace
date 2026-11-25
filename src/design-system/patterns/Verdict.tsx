import React from 'react';
import { Rail } from '../primitives/Rail';
import { StatusIcon } from '../primitives/StatusIcon';
import { getOddsMeta } from './bandMeta';

export interface VerdictProps {
  band: 'Strong' | 'Fair' | 'Long shot' | string;
  confidence?: 'Low' | 'Medium' | 'High' | string;
  score?: number; // purely used to position the marker on the verdict rail
  className?: string;
}

export function Verdict({
  band,
  confidence = 'Medium',
  score,
  className = '',
}: VerdictProps) {
  const meta = getOddsMeta(band);

  // Fallback marker position based on band if numerical score is absent
  let markerPercent = 50;
  if (score !== undefined) {
    markerPercent = score;
  } else if (meta.status === 'strong') {
    markerPercent = 82;
  } else if (meta.status === 'risk') {
    markerPercent = 18;
  }

  let bandColor = 'text-status-caution-content';
  if (meta.status === 'strong') bandColor = 'text-status-strong-content';
  if (meta.status === 'risk') bandColor = 'text-status-risk-content';

  return (
    <div
      role="region"
      aria-label={`Honest odds: ${band}, ${confidence} confidence`}
      className={`space-y-4 ${className}`}
    >
      <div className="space-y-1">
        <span className="font-mono text-eyebrow uppercase tracking-wider text-content-tertiary block">
          Diagnostic Verdict
        </span>
        <div className="flex items-center gap-3">
          <StatusIcon status={meta.status} size={32} />
          <h2 className={`text-display font-semibold tracking-tight leading-none ${bandColor}`}>
            {band}
          </h2>
        </div>
      </div>

      {/* Rail verdict */}
      <Rail
        variant="verdict"
        value={markerPercent}
        label={`Diagnostic placement: ${band}`}
      />

      <div className="flex items-center justify-between font-mono text-eyebrow text-content-tertiary tabular-nums">
        <span>Confidence: {confidence}</span>
        <span>Deterministic band</span>
      </div>

      {confidence === 'Low' && (
        <div className="p-3 bg-status-caution-surface border-l-4 border-status-caution-mark text-small text-status-caution-content">
          This job post says little, so treat this as a rough read.
        </div>
      )}
    </div>
  );
}
