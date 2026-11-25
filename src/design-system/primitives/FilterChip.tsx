'use client';

import React from 'react';

export interface FilterChipProps {
  label: string;
  selected: boolean;
  onToggle?: () => void;
  onClick?: () => void;
  count?: number;
  className?: string;
}

export function FilterChip({
  label,
  selected,
  onToggle,
  onClick,
  count,
  className = '',
}: FilterChipProps) {
  const handleClick = onClick || onToggle;

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={selected}
      className={`inline-flex items-center gap-1.5 h-(--chip-height) px-(--chip-padding-x) rounded-(--chip-radius) font-mono text-eyebrow uppercase tracking-wider transition-colors select-none cursor-pointer focus-visible:outline-none focus-visible:ring-(--focus-ring-width) focus-visible:ring-action-focus-ring ${
        selected
          ? 'bg-action-subtle text-action-primary border border-action-primary/40 font-semibold'
          : 'bg-surface-sunken text-content-tertiary border border-border-subtle hover:text-content-primary hover:border-border-default'
      } ${className}`}
    >
      <span>{label}</span>
      {count !== undefined && (
        <span
          className={`text-xs ml-0.5 tabular-nums ${
            selected ? 'text-action-primary font-bold' : 'text-content-disabled'
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}
