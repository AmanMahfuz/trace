'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { Wordmark } from '@/design-system/primitives/Wordmark';
import { Button } from '@/design-system/primitives/Button';
import { RotateCcw, AlertTriangle } from 'lucide-react';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Unhandled application error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-surface-page text-content-primary flex flex-col justify-between p-6 sm:p-12">
      <header className="flex items-center justify-between max-w-4xl w-full mx-auto">
        <Link href="/">
          <Wordmark />
        </Link>
      </header>

      <main className="max-w-md w-full mx-auto text-center space-y-6 py-12">
        <div className="w-16 h-16 rounded-full bg-status-risk-surface border border-status-risk-border flex items-center justify-center mx-auto text-status-risk-content">
          <AlertTriangle className="w-8 h-8 text-status-risk-mark" />
        </div>

        <div className="space-y-2">
          <span className="font-mono text-eyebrow uppercase tracking-wider text-status-risk-content font-semibold">
            Error 500 · Server Interruption
          </span>
          <h1 className="text-heading-1 font-semibold text-content-primary tracking-tight">
            Something went wrong
          </h1>
          <p className="text-body text-content-secondary leading-relaxed">
            Our diagnostic intelligence engine encountered an unexpected condition. Your personal records and credits remain secure.
          </p>
        </div>

        {error.digest && (
          <div className="p-3 bg-surface-sunken border border-border-subtle rounded-(--radius-control) font-mono text-eyebrow text-content-tertiary">
            Incident ID: {error.digest}
          </div>
        )}

        <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button
            variant="primary"
            onClick={() => reset()}
            iconLeft={<RotateCcw className="w-4 h-4" />}
            className="w-full sm:w-auto"
          >
            Try Again
          </Button>
          <Link href="/dashboard" className="w-full sm:w-auto">
            <Button variant="ghost" className="w-full">
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </main>

      <footer className="text-center font-mono text-eyebrow text-content-tertiary">
        Trace Diagnostic Intelligence · Deterministic Career Guidance
      </footer>
    </div>
  );
}
