import React from 'react';

export interface ActionBarProps {
  statusText?: React.ReactNode;
  primaryAction: React.ReactNode;
  secondaryAction?: React.ReactNode;
  className?: string;
}

export function ActionBar({
  statusText,
  primaryAction,
  secondaryAction,
  className = '',
}: ActionBarProps) {
  return (
    <aside
      aria-label="Action bar"
      className={`fixed bottom-0 left-0 right-0 h-18 bg-surface-page border-t border-border-subtle px-6 sm:px-12 flex items-center justify-between z-(--z-bar) ${className}`}
    >
      <div className="max-w-(--size-content-max) mx-auto w-full flex flex-col sm:flex-row items-center justify-between gap-3">
        {statusText && (
          <div className="font-mono text-eyebrow text-content-primary tabular-nums hidden sm:block">
            {statusText}
          </div>
        )}
        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          {secondaryAction}
          {primaryAction}
        </div>
      </div>
    </aside>
  );
}
