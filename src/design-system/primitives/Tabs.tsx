'use client';

import React, { useRef } from 'react';

export interface TabItem {
  id: string;
  label: string;
  count?: number;
}

export interface TabsProps {
  tabs: TabItem[];
  activeId: string;
  onChange: (id: string) => void;
  className?: string;
  'aria-label'?: string;
}

export function Tabs({
  tabs,
  activeId,
  onChange,
  className = '',
  'aria-label': ariaLabel = 'View tabs',
}: TabsProps) {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      const nextIndex = (index + 1) % tabs.length;
      tabRefs.current[nextIndex]?.focus();
      onChange(tabs[nextIndex].id);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const prevIndex = (index - 1 + tabs.length) % tabs.length;
      tabRefs.current[prevIndex]?.focus();
      onChange(tabs[prevIndex].id);
    }
  };

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`flex items-center gap-6 border-b border-border-subtle overflow-x-auto ${className}`}
    >
      {tabs.map((tab, idx) => {
        const isActive = tab.id === activeId;
        return (
          <button
            key={tab.id}
            ref={(el) => {
              tabRefs.current[idx] = el;
            }}
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            className={`pb-3 text-small font-medium transition-colors relative whitespace-nowrap cursor-pointer select-none focus-visible:outline-none focus-visible:ring-(--focus-ring-width) focus-visible:ring-action-focus-ring ${
              isActive
                ? 'text-content-primary font-semibold'
                : 'text-content-tertiary hover:text-content-secondary'
            }`}
          >
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                className={`ml-2 font-mono text-eyebrow tabular-nums ${
                  isActive ? 'text-action-primary' : 'text-content-disabled'
                }`}
              >
                {tab.count}
              </span>
            )}
            {isActive && (
              <span
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-action-primary"
                aria-hidden="true"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
