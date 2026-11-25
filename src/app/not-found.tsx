import React from 'react';
import Link from 'next/link';
import { Wordmark } from '@/design-system/primitives/Wordmark';
import { Button } from '@/design-system/primitives/Button';
import { ArrowLeft, Compass } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-surface-page text-content-primary flex flex-col justify-between p-6 sm:p-12">
      <header className="flex items-center justify-between max-w-4xl w-full mx-auto">
        <Link href="/">
          <Wordmark />
        </Link>
      </header>

      <main className="max-w-md w-full mx-auto text-center space-y-6 py-12">
        <div className="w-16 h-16 rounded-full bg-surface-sunken border border-border-default flex items-center justify-center mx-auto text-content-tertiary">
          <Compass className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <span className="font-mono text-eyebrow uppercase tracking-wider text-action-primary font-semibold">
            Error 404 · Destination Missing
          </span>
          <h1 className="text-heading-1 font-semibold text-content-primary tracking-tight">
            Page Not Found
          </h1>
          <p className="text-body text-content-secondary leading-relaxed">
            The page, report, or diagnostic session you are looking for does not exist or has been permanently removed.
          </p>
        </div>

        <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/dashboard" className="w-full sm:w-auto">
            <Button variant="primary" className="w-full">
              Go to Dashboard
            </Button>
          </Link>
          <Link href="/" className="w-full sm:w-auto">
            <Button variant="ghost" iconLeft={<ArrowLeft className="w-4 h-4" />} className="w-full">
              Return Home
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
