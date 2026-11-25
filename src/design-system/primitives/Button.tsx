'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'quiet';
export type ButtonSize = 'default' | 'compact';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  loading?: boolean;
  children: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'default',
      icon,
      iconLeft,
      iconRight,
      loading = false,
      disabled,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    const isActuallyDisabled = disabled || loading;

    // Base styles: tier 3 tokens
    const base =
      'inline-flex items-center justify-center font-medium transition-colors select-none cursor-pointer focus-visible:outline-none focus-visible:ring-(--focus-ring-width) focus-visible:ring-action-focus-ring focus-visible:ring-offset-(--focus-ring-offset) rounded-(--button-radius)';

    // Size variants
    const sizeClasses =
      size === 'compact'
        ? 'h-(--button-height-compact) px-3 text-small'
        : 'h-(--button-height) px-(--button-padding-x) text-body min-w-(--size-touch-min)';

    // Visual variants
    let variantClasses = '';
    const resolvedVariant = variant === 'quiet' ? 'ghost' : variant;

    switch (resolvedVariant) {
      case 'primary':
        variantClasses =
          'bg-action-primary hover:bg-action-primary-hover active:bg-action-primary-active text-content-on-action disabled:opacity-50 disabled:pointer-events-none';
        break;
      case 'secondary':
        variantClasses =
          'bg-surface-raised border border-border-control hover:bg-surface-sunken text-content-primary disabled:opacity-50 disabled:pointer-events-none';
        break;
      case 'ghost':
        variantClasses =
          'bg-transparent hover:bg-surface-sunken text-content-primary disabled:opacity-40 disabled:pointer-events-none';
        break;
      case 'danger':
        variantClasses =
          'bg-transparent border border-status-risk-content text-status-risk-content hover:bg-status-risk-surface active:bg-status-risk-surface/80 disabled:opacity-40 disabled:pointer-events-none';
        break;
    }

    const left = iconLeft || icon;

    return (
      <button
        ref={ref}
        disabled={isActuallyDisabled}
        aria-busy={loading}
        className={`${base} ${sizeClasses} ${variantClasses} ${className}`}
        {...props}
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden="true" />
            <span>{children}</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-2">
            {left && <span className="shrink-0">{left}</span>}
            <span>{children}</span>
            {iconRight && <span className="shrink-0">{iconRight}</span>}
          </span>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
