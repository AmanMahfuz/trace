import React from 'react';

export type RailVariant = 'score' | 'progress' | 'range' | 'verdict';

export interface RailProps {
  variant: RailVariant;
  value?: number; // 0-100 for score / progress
  min?: number;
  max?: number;
  rangeTargetMin?: number; // e.g. 120 for pace
  rangeTargetMax?: number; // e.g. 160 for pace
  rangeMin?: number;
  rangeMax?: number;
  label?: string;
  className?: string;
}

export function Rail({
  variant,
  value = 0,
  min = 0,
  max = 100,
  rangeTargetMin,
  rangeTargetMax,
  rangeMin,
  rangeMax,
  label,
  className = '',
}: RailProps) {
  const actualTargetMin = typeof rangeMin === 'number' ? rangeMin : (rangeTargetMin ?? 120);
  const actualTargetMax = typeof rangeMax === 'number' ? rangeMax : (rangeTargetMax ?? 160);

  const clamped = Math.max(min, Math.min(max, value));
  const percent = max > min ? ((clamped - min) / (max - min)) * 100 : 0;

  if (variant === 'verdict') {
    // Three-segment rail: risk wash, caution wash, strong wash, with a 2px marker
    const ariaText = label || `Diagnostic verdict placement: ${Math.round(percent)}%`;

    return (
      <div
        role="img"
        aria-label={ariaText}
        className={`relative h-(--rail-height) w-full rounded-full overflow-hidden bg-surface-sunken border border-border-subtle flex ${className}`}
      >
        {/* Risk segment (0-34) */}
        <div className="w-[34%] h-full bg-status-risk-surface border-r border-border-subtle" />
        {/* Caution segment (35-64) */}
        <div className="w-[30%] h-full bg-status-caution-surface border-r border-border-subtle" />
        {/* Strong segment (65-100) */}
        <div className="w-[36%] h-full bg-status-strong-surface" />

        {/* Marker */}
        <div
          className="absolute top-0 bottom-0 w-1.5 bg-content-primary rounded-full -translate-x-1/2 transition-all duration-slow ease-standard"
          style={{ left: `${Math.max(3, Math.min(97, percent))}%` }}
          aria-hidden="true"
        />
      </div>
    );
  }

  if (variant === 'range') {
    // Neutral track with shaded target zone and current value marker
    const targetLeft = ((actualTargetMin - min) / (max - min)) * 100;
    const targetWidth = ((actualTargetMax - actualTargetMin) / (max - min)) * 100;
    const ariaText = label || `Value: ${value}, target range: ${actualTargetMin} to ${actualTargetMax}`;

    return (
      <div
        role="img"
        aria-label={ariaText}
        className={`relative h-(--rail-height) w-full rounded-full bg-surface-sunken overflow-hidden ${className}`}
      >
        {/* Target range shaded segment */}
        <div
          className="absolute top-0 bottom-0 bg-status-strong-border"
          style={{
            left: `${Math.max(0, targetLeft)}%`,
            width: `${Math.max(0, targetWidth)}%`,
          }}
        />

        {/* Current value bar */}
        <div
          className="h-full bg-content-primary transition-all duration-medium ease-standard"
          style={{ width: `${percent}%` }}
        />
      </div>
    );
  }

  if (variant === 'progress') {
    // Simple indigo progress bar
    return (
      <div
        role="progressbar"
        aria-valuenow={Math.round(percent)}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-label={label || 'Progress'}
        className={`h-(--rail-height) w-full bg-surface-sunken rounded-full overflow-hidden ${className}`}
      >
        <div
          className="h-full bg-action-primary transition-all duration-medium ease-standard"
          style={{ width: `${percent}%` }}
        />
      </div>
    );
  }

  // variant === 'score': Single continuous rail colored by threshold (>=70 green, >=40 amber, <40 red)
  const barColor =
    value >= 70
      ? 'bg-status-strong-mark'
      : value >= 40
      ? 'bg-status-caution-mark'
      : 'bg-status-risk-mark';

  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-label={label || `Score: ${Math.round(value)}`}
      className={`h-(--rail-height) w-full bg-surface-sunken rounded-full overflow-hidden ${className}`}
    >
      <div
        className={`h-full ${barColor} transition-all duration-medium ease-standard`}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
