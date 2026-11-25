import React from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  OctagonAlert,
  ShieldCheck,
  CircleDot,
} from 'lucide-react';

export type StatusType =
  | 'strong'
  | 'caution'
  | 'risk'
  | 'ghost-low'
  | 'ghost-medium'
  | 'ghost-high'
  | 'neutral';

export interface StatusIconProps {
  status: StatusType;
  size?: number;
  className?: string;
}

export function StatusIcon({
  status,
  size = 16,
  className = '',
}: StatusIconProps) {
  const iconProps = {
    size,
    strokeWidth: 1.5,
    className: `shrink-0 ${className}`,
    'aria-hidden': true,
  };

  switch (status) {
    case 'strong':
      return <CheckCircle2 {...iconProps} className={`text-status-strong-content ${className}`} />;
    case 'caution':
      return <AlertTriangle {...iconProps} className={`text-status-caution-content ${className}`} />;
    case 'risk':
      return <OctagonAlert {...iconProps} className={`text-status-risk-content ${className}`} />;
    case 'ghost-low':
      return <ShieldCheck {...iconProps} className={`text-status-strong-content ${className}`} />;
    case 'ghost-medium':
      return <AlertTriangle {...iconProps} className={`text-status-caution-content ${className}`} />;
    case 'ghost-high':
      return <OctagonAlert {...iconProps} className={`text-status-risk-content ${className}`} />;
    case 'neutral':
    default:
      return <CircleDot {...iconProps} className={`text-content-tertiary ${className}`} />;
  }
}
