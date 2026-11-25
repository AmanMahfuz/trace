import React from 'react';

export interface MetricStatProps {
  label: string;
  value: string | number;
  unit?: string;
  helperText?: string;
  children?: React.ReactNode;
  className?: string;
}

export function MetricStat({
  label,
  value,
  unit,
  helperText,
  children,
  className = '',
}: MetricStatProps) {
  return (
    <div className={`space-y-2 ${className}`}>
      <span className="font-mono text-eyebrow uppercase tracking-wider text-content-tertiary block">
        {label}
      </span>

      <div className="text-metric-lg font-mono font-medium text-content-primary tabular-nums flex items-baseline gap-1">
        <span>{value}</span>
        {unit && (
          <span className="text-heading-3 text-content-disabled font-sans font-normal">
            {unit}
          </span>
        )}
      </div>

      {children && <div className="pt-1">{children}</div>}

      {helperText && (
        <p className="text-small text-content-tertiary leading-relaxed pt-1">
          {helperText}
        </p>
      )}
    </div>
  );
}
