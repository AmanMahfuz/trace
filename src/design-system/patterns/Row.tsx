import React from 'react';

export interface RowProps {
  marker?: React.ReactNode;
  title: React.ReactNode;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  expandedContent?: React.ReactNode;
  isExpanded?: boolean;
  className?: string;
}

export function Row({
  marker,
  title,
  meta,
  actions,
  expandedContent,
  isExpanded = false,
  className = '',
}: RowProps) {
  return (
    <div
      className={`min-h-(--row-min-height) py-4 border-b border-border-subtle hover:bg-surface-sunken transition-colors space-y-3 ${className}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Left: Marker + Title & Meta */}
        <div className="flex items-start gap-3 min-w-0">
          {marker && <div className="shrink-0 mt-0.5">{marker}</div>}
          <div className="space-y-1 min-w-0">
            <div className="text-body font-medium text-content-primary">{title}</div>
            {meta && <div className="text-small text-content-tertiary flex items-center gap-2">{meta}</div>}
          </div>
        </div>

        {/* Right: Actions */}
        {actions && <div className="flex items-center gap-3 shrink-0 self-start sm:self-auto">{actions}</div>}
      </div>

      {/* Optional Expanded Detail */}
      {isExpanded && expandedContent && (
        <div className="pt-2 pl-0 sm:pl-7 border-t border-border-subtle">
          {expandedContent}
        </div>
      )}
    </div>
  );
}
