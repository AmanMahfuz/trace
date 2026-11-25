import React from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  OctagonAlert,
} from 'lucide-react';
import { Chip as DSChip, ChipVariant as DSChipVariant } from '@/design-system/primitives/Chip';

export type ChipVariant =
  | 'neutral'
  | 'strong'
  | 'fair'
  | 'risk'
  | 'ghost-low'
  | 'ghost-medium'
  | 'ghost-high';

interface ChipProps {
  label: string;
  variant?: ChipVariant;
  icon?: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export function Chip({
  label,
  variant = 'neutral',
  icon,
  className = '',
  onClick,
}: ChipProps) {
  let dsVariant: DSChipVariant = 'neutral';
  let defaultIcon: React.ReactNode = null;

  switch (variant) {
    case 'strong':
    case 'ghost-low':
      dsVariant = 'strong';
      defaultIcon = <CheckCircle2 className="w-3.5 h-3.5" />;
      break;
    case 'fair':
    case 'ghost-medium':
      dsVariant = 'caution';
      defaultIcon = <AlertTriangle className="w-3.5 h-3.5" />;
      break;
    case 'risk':
    case 'ghost-high':
      dsVariant = 'risk';
      defaultIcon = <OctagonAlert className="w-3.5 h-3.5" />;
      break;
    case 'neutral':
    default:
      dsVariant = 'neutral';
      break;
  }

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action-focus-ring"
      >
        <DSChip
          label={label}
          variant={dsVariant}
          icon={icon || defaultIcon}
          className={className}
        />
      </button>
    );
  }

  return (
    <DSChip
      label={label}
      variant={dsVariant}
      icon={icon || defaultIcon}
      className={className}
    />
  );
}
