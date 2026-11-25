'use client';

import React, { useEffect, useRef } from 'react';
import { Button } from '../primitives/Button';
import { X } from 'lucide-react';

export interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  primaryAction?: {
    label: string;
    onClick: () => Promise<void> | void;
    variant?: 'primary' | 'danger';
    disabled?: boolean;
    loading?: boolean;
  };
  secondaryAction?: {
    label?: string;
    onClick?: () => void;
  };
  className?: string;
}

export function Dialog({
  isOpen,
  onClose,
  title,
  description,
  children,
  primaryAction,
  secondaryAction,
  className = '',
}: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
      className="fixed inset-0 z-(--z-overlay) bg-content-primary/40 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div
        ref={dialogRef}
        className={`bg-surface-raised border border-border-default rounded-(--radius-overlay) p-6 max-w-md w-full space-y-5 shadow-(--shadow-overlay) transition-all ${className}`}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h2 id="dialog-title" className="text-heading-2 font-semibold text-content-primary">
              {title}
            </h2>
            {description && (
              <p className="text-small text-content-secondary leading-relaxed">
                {description}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-content-tertiary hover:text-content-primary p-1 -mt-1 -mr-1 cursor-pointer focus-visible:outline-none focus-visible:ring-(--focus-ring-width) focus-visible:ring-action-focus-ring rounded-(--radius-control)"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {children && <div className="space-y-4">{children}</div>}

        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={secondaryAction?.onClick || onClose}
          >
            {secondaryAction?.label || 'Cancel'}
          </Button>

          {primaryAction && (
            <Button
              type="button"
              variant={primaryAction.variant || 'primary'}
              onClick={primaryAction.onClick}
              disabled={primaryAction.disabled}
              loading={primaryAction.loading}
            >
              {primaryAction.label}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
