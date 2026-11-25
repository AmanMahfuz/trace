import React from 'react';
import Link from 'next/link';

export type JourneyStep = 'analyze' | 'prep' | 'practice' | 'report' | 'outcome';

export interface JourneyStripProps {
  currentStep: JourneyStep;
  applicationId?: string;
  className?: string;
}

const STEPS: { id: JourneyStep; label: string }[] = [
  { id: 'analyze', label: 'Analyze' },
  { id: 'prep', label: 'Prep' },
  { id: 'practice', label: 'Practice' },
  { id: 'report', label: 'Report' },
  { id: 'outcome', label: 'Outcome' },
];

export function JourneyStrip({
  currentStep,
  applicationId,
  className = '',
}: JourneyStripProps) {
  const currentIndex = STEPS.findIndex((s) => s.id === currentStep);

  return (
    <nav className={`w-full border-b border-border-subtle bg-surface-page py-3 ${className}`} aria-label="Journey progress">
      <div className="max-w-(--size-content-max) mx-auto px-6 sm:px-12 flex items-center justify-between">
        {/* Mobile: current step indicator */}
        <div className="flex sm:hidden items-center gap-2">
          <span className="font-mono text-eyebrow uppercase tracking-wider text-content-tertiary">Step:</span>
          <span className="font-mono text-eyebrow uppercase tracking-wider text-content-primary font-semibold">
            {STEPS[currentIndex]?.label || currentStep}
          </span>
        </div>

        {/* Desktop: signature trace line */}
        <div className="hidden sm:flex items-center w-full justify-between relative">
          {STEPS.map((step, idx) => {
            const isPast = idx < currentIndex;
            const isCurrent = idx === currentIndex;

            let stepHref: string | null = null;
            if (step.id === 'analyze') {
              stepHref = '/dashboard';
            } else if (applicationId) {
              if (step.id === 'prep') stepHref = `/prep/${applicationId}`;
              else if (step.id === 'practice') stepHref = `/arena/${applicationId}`;
              else if (step.id === 'report') stepHref = `/report/${applicationId}`;
              else if (step.id === 'outcome') stepHref = `/why-not/${applicationId}`;
            }

            const stepContent = (
              <div
                className="flex items-center gap-2 group cursor-pointer"
                aria-current={isCurrent ? 'step' : undefined}
              >
                <div
                  className={`w-2.5 h-2.5 rounded-full transition-colors ${
                    isPast
                      ? 'bg-action-primary'
                      : isCurrent
                      ? 'bg-surface-page border-2 border-action-primary ring-2 ring-action-subtle'
                      : 'bg-surface-page border border-border-control'
                  }`}
                  aria-hidden="true"
                />
                <span
                  className={`font-mono text-eyebrow uppercase tracking-wider transition-colors ${
                    isCurrent
                      ? 'text-content-primary font-semibold'
                      : isPast
                      ? 'text-content-secondary group-hover:text-action-primary'
                      : 'text-content-disabled'
                  }`}
                >
                  {step.label}
                </span>
              </div>
            );

            return (
              <React.Fragment key={step.id}>
                {stepHref && isPast ? (
                  <Link
                    href={stepHref}
                    className="focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-action-focus-ring rounded-(--radius-control)"
                  >
                    {stepContent}
                  </Link>
                ) : (
                  stepContent
                )}
                {idx < STEPS.length - 1 && (
                  <div
                    className={`flex-1 h-px mx-3 transition-colors ${
                      idx < currentIndex ? 'bg-action-primary' : 'bg-border-subtle'
                    }`}
                    aria-hidden="true"
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
