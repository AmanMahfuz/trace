import React from 'react';

export interface RuleProps {
  orientation?: 'horizontal' | 'vertical';
  className?: string;
}

export function Rule({ orientation = 'horizontal', className = '' }: RuleProps) {
  if (orientation === 'vertical') {
    return (
      <div
        role="separator"
        aria-orientation="vertical"
        className={`w-px h-full bg-border-subtle shrink-0 ${className}`}
      />
    );
  }

  return (
    <hr
      className={`w-full h-px border-0 bg-border-subtle shrink-0 my-0 ${className}`}
    />
  );
}
