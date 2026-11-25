import React from 'react';
import { Chip } from '../primitives/Chip';

export interface ReasonRowProps {
  index: number;
  reason: string;
  likelihood: 'High' | 'Medium' | 'Low' | string;
  basis: string;
  className?: string;
}

export function ReasonRow({
  index,
  reason,
  likelihood,
  basis,
  className = '',
}: ReasonRowProps) {
  const chipLabel =
    likelihood === 'High'
      ? 'More likely'
      : likelihood === 'Low'
      ? 'Less likely'
      : 'Possible';

  return (
    <div className={`py-5 border-b border-border-subtle flex items-start gap-4 ${className}`}>
      <span className="font-mono text-heading-3 text-content-tertiary tabular-nums shrink-0 pt-0.5">
        {(index + 1).toString().padStart(2, '0')}
      </span>

      <div className="space-y-2 flex-1 min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-body font-semibold text-content-primary">
            {reason}
          </h3>
          <Chip label={chipLabel} variant="neutral" />
        </div>

        <p className="text-small text-content-tertiary leading-relaxed">
          Based on: {basis}
        </p>
      </div>
    </div>
  );
}
