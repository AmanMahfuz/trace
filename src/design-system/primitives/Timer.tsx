import React from 'react';
import { Clock } from 'lucide-react';

export interface TimerProps {
  secondsRemaining?: number;
  seconds?: number;
  className?: string;
}

export function Timer({ secondsRemaining, seconds: rawSeconds, className = '' }: TimerProps) {
  const currentSeconds = typeof secondsRemaining === 'number' ? secondsRemaining : (rawSeconds ?? 0);
  const isFinalSeconds = currentSeconds <= 30;
  const minutes = Math.floor(Math.max(0, currentSeconds) / 60);
  const seconds = (Math.max(0, currentSeconds) % 60).toString().padStart(2, '0');

  return (
    <div
      className={`inline-flex items-center gap-1.5 font-mono text-metric-sm tabular-nums font-medium ${
        isFinalSeconds ? 'text-status-caution-content' : 'text-content-primary'
      } ${className}`}
      aria-label={`Time remaining: ${minutes} minutes ${seconds} seconds`}
      aria-live="polite"
    >
      <Clock
        className={`w-4 h-4 shrink-0 ${
          isFinalSeconds ? 'text-status-caution-mark animate-pulse' : 'text-content-tertiary'
        }`}
        aria-hidden="true"
      />
      <span>
        {minutes}:{seconds}
      </span>
    </div>
  );
}
