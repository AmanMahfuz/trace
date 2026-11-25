import React from 'react';

export type ChipVariant = 'neutral' | 'strong' | 'caution' | 'risk' | 'accent';

export interface ChipProps {
  label: string;
  variant?: ChipVariant;
  icon?: React.ReactNode;
  className?: string;
}

export function Chip({
  label,
  variant = 'neutral',
  icon,
  className = '',
}: ChipProps) {
  let styleClasses = '';

  switch (variant) {
    case 'strong':
      styleClasses =
        'bg-status-strong-surface text-status-strong-content border-status-strong-border';
      break;
    case 'caution':
      styleClasses =
        'bg-status-caution-surface text-status-caution-content border-status-caution-border';
      break;
    case 'risk':
      styleClasses =
        'bg-status-risk-surface text-status-risk-content border-status-risk-border';
      break;
    case 'accent':
      styleClasses =
        'bg-action-subtle text-action-primary border-action-primary/30';
      break;
    case 'neutral':
    default:
      styleClasses =
        'bg-surface-sunken text-content-secondary border-border-subtle';
      break;
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 h-(--chip-height) px-(--chip-padding-x) rounded-(--chip-radius) border font-mono text-eyebrow uppercase tracking-wider select-none ${styleClasses} ${className}`}
    >
      {icon && <span className="shrink-0" aria-hidden="true">{icon}</span>}
      <span>{label}</span>
    </span>
  );
}
