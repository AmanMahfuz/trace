import React from 'react';
import Link from 'next/link';
import { Wordmark } from '@/design-system/primitives/Wordmark';
import { Button } from '@/design-system/primitives/Button';
import { ArrowLeft, Shield, Lock, Trash2, EyeOff } from 'lucide-react';

export const metadata = {
  title: 'Privacy Policy · Trace',
  description: 'How Trace protects candidate privacy and handles resume and interview data.',
};

export default function PrivacyPage() {
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
            <Shield className="w-4 h-4" />
            <span>Candidate Data Sovereignty</span>
          </div>
          <h1 className="text-heading-1 font-semibold tracking-tight text-content-primary">
            Privacy Policy
          </h1>
          <p className="text-small text-content-tertiary font-mono">
            Effective Date: November 2026 · Version 1.0.0
          </p>
        </div>

        {/* Core Principles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 bg-surface-raised border border-border-subtle rounded-(--radius-overlay) space-y-2">
            <div className="flex items-center gap-2 text-action-primary font-medium text-small">
              <EyeOff className="w-4 h-4" />
              <span>Provider-Enforced Training Protection</span>
            </div>
            <p className="text-small text-content-secondary leading-relaxed">
              We send your resume and interview text only to AI providers whose terms state they don’t train on API data, and to no others. Provider terms can change, so we list the current providers below.
            </p>
          </div>

          <div className="p-4 bg-surface-raised border border-border-subtle rounded-(--radius-overlay) space-y-2">
            <div className="flex items-center gap-2 text-status-strong-content font-medium text-small">
              <Lock className="w-4 h-4" />
              <span>Restricted Model Routing</span>
            </div>
            <p className="text-small text-content-secondary leading-relaxed">
              Candidate resumes route exclusively to LLM providers contractually bound with zero-retention policies.
            </p>
          </div>
        </div>

        {/* Detailed Sections */}
        <div className="space-y-8 text-body text-content-secondary leading-relaxed">
          <section className="space-y-3">
            <h2 className="text-heading-3 font-semibold text-content-primary">
              1. Information We Collect
            </h2>
            <p>
              When you use Trace, we collect only the information necessary to provide deterministic resume analysis, job matching diagnostics, and interview voice sparring:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-small text-content-secondary">
              <li>
                <strong className="text-content-primary">Resume Content:</strong> PDF documents you upload for diagnostic parsing and evidence matching.
              </li>
              <li>
                <strong className="text-content-primary">Job Post Context:</strong> Job URLs or pasted descriptions you evaluate against your profile. If you provide a job link, public job posting data may be fetched directly or via public web scrapers (such as Jina Reader). This involves public job text only, not your personal resume.
              </li>
              <li>
                <strong className="text-content-primary">Audio & Transcripts:</strong> Audio speech recognized during interactive 5-minute pre-screening sessions. If you use voice, your browser’s speech recognition may send audio to the browser vendor (e.g. Chrome uses Google’s speech recognition service). Choose typing mode to avoid this. Transcripts are retained for a maximum of 90 days before automatic automated purge, or permanently deleted immediately upon user account wipe.
              </li>
              <li>
                <strong className="text-content-primary">Authentication Data:</strong> Email address and authentication credentials handled securely via Supabase Auth.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-heading-3 font-semibold text-content-primary">
              2. How Your Data Is Processed & Current AI Providers
            </h2>
            <p>
              Your data is processed in real time to generate deterministic job odds, factor breakdowns, and tailored resumes. We do not sell your personal data or broker candidate profiles to recruiters or third-party job boards.
            </p>
            <p className="text-small text-content-secondary">
              We send candidate data exclusively to providers whose published terms state they do not train models on API inputs or outputs:
            </p>
            <ul className="list-disc pl-6 space-y-1 text-small text-content-secondary">
              <li>
                <strong className="text-content-primary">Google Gemini API:</strong> Fast/mid tier processing. Commercial API terms explicitly state customer prompt data is not used to train Google models.
              </li>
              <li>
                <strong className="text-content-primary">Groq Cloud:</strong> Fast tier LPU inference (Llama 3.3). API terms state inputs and outputs are not retained or used for model training.
              </li>
              <li>
                <strong className="text-content-primary">Anthropic:</strong> Strong tier evaluation. Commercial API terms state customer inputs and outputs are not used for training.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-heading-3 font-semibold text-content-primary">
              3. Permanent Account & Data Deletion
            </h2>
            <p>
              You maintain absolute control over your records. At any time, you can trigger a permanent 1-click account wipe from your profile menu. This permanently purges:
            </p>
            <div className="p-4 bg-status-risk-surface border border-status-risk-border rounded-(--radius-control) space-y-2 text-small text-status-risk-content">
              <div className="flex items-center gap-2 font-semibold">
                <Trash2 className="w-4 h-4 text-status-risk-mark" />
                <span>Zero-Trace Deletion Guarantee</span>
              </div>
              <p>
                All resume PDF files in private cloud storage, parsed trees, job postings, applications, interview audio transcripts, credit ledgers, and authentication user records are permanently destroyed immediately upon request.
              </p>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-heading-3 font-semibold text-content-primary">
              4. Contact & Inquiries
            </h2>
            <p>
              If you have any questions about this Privacy Policy or wish to exercise data rights under GDPR or CCPA, contact our privacy officer at{' '}
              <a href="mailto:privacy@trace.careers" className="text-content-link underline hover:text-content-primary">
                privacy@trace.careers
              </a>
              .
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
