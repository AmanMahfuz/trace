import React from 'react';

export interface EmptyStateProps {
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  title,
  description,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div className={`py-16 px-6 flex flex-col items-center justify-center text-center space-y-4 ${className}`}>
      {/* Signature trace-line motif illustration */}
      <div className="flex items-center gap-1 py-2" aria-hidden="true">
        <span className="w-6 h-px bg-border-default" />
        <span className="w-2 h-2 rounded-full border border-border-default bg-surface-page" />
        <span className="w-12 h-px bg-action-primary" />
        <span className="w-2.5 h-2.5 rounded-full bg-action-primary" />
        <span className="w-6 h-px bg-border-default" />
      </div>

      <div className="space-y-1.5 max-w-sm">
        <h3 className="text-heading-2 font-semibold text-content-primary">
          {title}
        </h3>
        <p className="text-small text-content-tertiary leading-relaxed">
          {description}
        </p>
      </div>

      {action && <div className="pt-2">{action}</div>}
    </div>
  );
}
