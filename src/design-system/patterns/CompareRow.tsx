'use client';

import React, { useState } from 'react';
import { Button } from '../primitives/Button';
import { Copy, Check } from 'lucide-react';

export interface CompareRowProps {
  question: string;
  userSaid: string;
  strongerVersion: string;
  groundingNote?: string;
  onCopy?: (text: string) => void;
  className?: string;
}

export function CompareRow({
  question,
  userSaid,
  strongerVersion,
  groundingNote = 'Uses only facts from your resume and what you said.',
  onCopy,
  className = '',
}: CompareRowProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(strongerVersion);
    setCopied(true);
    if (onCopy) onCopy(strongerVersion);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`py-8 border-b border-border-subtle space-y-4 ${className}`}>
      <span className="font-mono text-eyebrow text-content-tertiary uppercase tracking-wider block">
        Question: {question}
      </span>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        {/* Left column: What you said */}
        <div className="space-y-2">
          <span className="font-mono text-eyebrow text-content-tertiary uppercase tracking-wider block">
            What you said
          </span>
          <p className="text-small text-content-tertiary leading-relaxed italic">
            &ldquo;{userSaid}&rdquo;
          </p>
        </div>

        {/* Right column: A stronger version */}
        <div className="p-4 bg-status-strong-surface border-l-4 border-status-strong-mark space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-eyebrow text-status-strong-content uppercase font-semibold">
              A stronger version
            </span>
            <Button
              type="button"
              variant="ghost"
              size="compact"
              onClick={handleCopy}
              icon={copied ? <Check className="w-3.5 h-3.5 text-status-strong-mark" /> : <Copy className="w-3.5 h-3.5" />}
            >
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>

          <p className="text-small font-medium text-content-primary leading-relaxed">
            {strongerVersion}
          </p>
        </div>
      </div>

      <p className="text-eyebrow text-content-tertiary">
        {groundingNote}
      </p>
    </div>
  );
}
