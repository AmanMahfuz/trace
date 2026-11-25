import React from 'react';
import { Info, AlertTriangle, OctagonAlert, CheckCircle2 } from 'lucide-react';
import { Button } from './Button';

export type BannerVariant = 'info' | 'caution' | 'risk' | 'strong';

export interface BannerProps {
  variant?: BannerVariant;
  title?: string;
  description?: string;
  children?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function Banner({
  variant = 'info',
  title,
  description,
  children,
  actionLabel,
  onAction,
  className = '',
}: BannerProps) {
  let styleClasses = '';
  let Icon = Info;

  switch (variant) {
    case 'caution':
      styleClasses = 'bg-status-caution-surface border-l-4 border-status-caution-mark text-status-caution-content';
      Icon = AlertTriangle;
      break;
    case 'risk':
      styleClasses = 'bg-status-risk-surface border-l-4 border-status-risk-mark text-status-risk-content';
      Icon = OctagonAlert;
      break;
    case 'strong':
      styleClasses = 'bg-status-strong-surface border-l-4 border-status-strong-mark text-status-strong-content';
      Icon = CheckCircle2;
      break;
    case 'info':
    default:
      styleClasses = 'bg-surface-sunken border-l-4 border-action-primary text-content-primary';
      Icon = Info;
      break;
  }

  return (
    <div
      role="region"
      aria-label={title || 'Notice'}
      className={`p-4 flex items-start justify-between gap-4 transition-colors rounded-r-(--radius-control) ${styleClasses} ${className}`}
    >
      <div className="flex items-start gap-3 min-w-0">
        <Icon className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
        <div className="space-y-1 text-small min-w-0">
          {title && <h3 className="font-semibold text-content-primary">{title}</h3>}
          {description && <p className="leading-relaxed">{description}</p>}
          {children}
        </div>
      </div>

      {actionLabel && onAction && (
        <Button
          type="button"
          variant="secondary"
          size="compact"
          onClick={onAction}
          className="shrink-0"
        >
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
