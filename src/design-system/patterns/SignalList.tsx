import React from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

export interface SignalListProps {
  signals: string[];
  emptyMessage?: string;
  className?: string;
}

export function SignalList({
  signals,
  emptyMessage = 'No risk signals identified.',
  className = '',
}: SignalListProps) {
  if (signals.length === 0) {
    return (
      <div className={`flex items-center gap-2 text-small text-status-strong-content ${className}`}>
        <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span>{emptyMessage}</span>
      </div>
    );
  }

  return (
    <ul className={`space-y-2 text-small text-content-secondary ${className}`}>
      {signals.map((sig, idx) => (
        <li key={idx} className="flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-status-caution-mark shrink-0 mt-0.5" aria-hidden="true" />
          <span className="leading-relaxed">{sig}</span>
        </li>
      ))}
    </ul>
  );
}
