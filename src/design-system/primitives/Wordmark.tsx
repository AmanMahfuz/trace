import React from 'react';
import Link from 'next/link';

export interface WordmarkProps {
  href?: string;
  className?: string;
}

export function Wordmark({ href = '/', className = '' }: WordmarkProps) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-(--focus-ring-width) focus-visible:ring-action-focus-ring focus-visible:ring-offset-(--focus-ring-offset) rounded-(--radius-control) select-none ${className}`}
      aria-label="Trace home"
    >
      <span className="font-semibold text-heading-3 text-content-primary lowercase tracking-tight">
        trace
      </span>
      {/* Signature motif: 1px line with round terminal node */}
      <div className="flex items-center" aria-hidden="true">
        <span className="w-2.5 h-px bg-action-primary" />
        <span className="w-1.5 h-1.5 rounded-full bg-action-primary" />
      </div>
    </Link>
  );
}
