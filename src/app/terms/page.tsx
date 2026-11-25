import React from 'react';
import Link from 'next/link';
import { Wordmark } from '@/design-system/primitives/Wordmark';
import { Button } from '@/design-system/primitives/Button';
import { ArrowLeft, FileText, CheckCircle2 } from 'lucide-react';

export const metadata = {
  title: 'Terms of Service · Trace',
  description: 'Terms and conditions governing the use of the Trace diagnostic intelligence platform.',
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-surface-page text-content-primary">
      {/* Header */}
      <header className="border-b border-border-subtle bg-surface-raised">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Wordmark />
          </Link>
          <Link href="/">
            <Button variant="ghost" size="compact" iconLeft={<ArrowLeft className="w-4 h-4" />}>
              Back to Home
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-6 py-12 sm:py-16 space-y-10">
        <div className="space-y-3 border-b border-border-subtle pb-8">
          <div className="flex items-center gap-2 text-action-primary font-mono text-eyebrow uppercase tracking-wider font-semibold">
            <FileText className="w-4 h-4" />
            <span>Platform Agreement</span>
          </div>
          <h1 className="text-heading-1 font-semibold tracking-tight text-content-primary">
            Terms of Service
          </h1>
          <p className="text-small text-content-tertiary font-mono">
            Effective Date: November 2026 · Version 1.0.0
          </p>
        </div>

        {/* Overview Box */}
        <div className="p-5 bg-action-subtle border-l-4 border-action-primary border-y border-r border-border-subtle rounded-(--radius-overlay) space-y-2">
          <div className="flex items-center gap-2 font-semibold text-content-primary text-small">
            <CheckCircle2 className="w-4 h-4 text-action-primary" />
            <span>Diagnostic Honesty Principle</span>
          </div>
          <p className="text-small text-content-secondary leading-relaxed">
            Trace provides deterministic evaluation of candidate qualifications against job descriptions. We commit to factual accuracy, never hallucinating employment records or metrics on your resume.
          </p>
        </div>

        {/* Detailed Terms */}
        <div className="space-y-8 text-body text-content-secondary leading-relaxed">
          <section className="space-y-3">
            <h2 className="text-heading-3 font-semibold text-content-primary">
              1. Acceptance of Terms
            </h2>
            <p>
              By accessing Trace, creating an account, or submitting documents for evaluation, you agree to be bound by these Terms of Service. If you disagree with any part of these terms, please discontinue using the service immediately.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-heading-3 font-semibold text-content-primary">
              2. Acceptable Use
            </h2>
            <p>
              You agree to use Trace solely for genuine career development, job search preparation, and technical interview practice. You agree not to:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-small text-content-secondary">
              <li>Upload malicious code, exploits, or automated scrapers intended to compromise infrastructure.</li>
              <li>Attempt to reverse-engineer diagnostic algorithms or bypass provider rate limits and circuit breakers.</li>
              <li>Submit fabricated employment history or misrepresent credential ownership in bad faith.</li>
              <li>Interfere with or bypass billing transactions, credit deduction mechanisms, or storage limits.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-heading-3 font-semibold text-content-primary">
              3. Credits & Practice Sessions
            </h2>
            <p>
              Users receive complimentary diagnostic credits upon initial registration. Additional credits may be granted through promotional allowances. Credits are non-transferable, have no cash redemption value, and are deducted per voice sparring session.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-heading-3 font-semibold text-content-primary">
              4. Disclaimer of Employment Guarantee
            </h2>
            <p>
              Trace provides objective analytical feedback, resume tailoring suggestions, and interview preparation. Trace does not guarantee employment offers, recruitment callbacks, or specific hiring outcomes from third-party employers.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-heading-3 font-semibold text-content-primary">
              5. Account Termination & Rights
            </h2>
            <p>
              You may terminate your account at any time via the profile settings. We reserve the right to suspend or terminate accounts that violate platform integrity or abuse shared compute resources.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-heading-3 font-semibold text-content-primary">
              6. Governing Law & Contact
            </h2>
            <p>
              These terms are governed by standard commercial internet service statutes. For inquiries regarding our terms, reach us at{' '}
              <a href="mailto:legal@trace.careers" className="text-content-link underline hover:text-content-primary">
                legal@trace.careers
              </a>
              .
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
