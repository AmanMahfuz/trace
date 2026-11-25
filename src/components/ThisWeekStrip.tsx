'use client';

import React from 'react';
import Link from 'next/link';
import { planThisWeek, ApplicationForPlanner, WeekItem } from '@/lib/planner';
import { Clock, CheckSquare, PlayCircle, ArrowRight, AlertCircle } from 'lucide-react';

interface ThisWeekStripProps {
  applications: ApplicationForPlanner[];
  className?: string;
}

export function ThisWeekStrip({ applications, className = '' }: ThisWeekStripProps) {
  const items: WeekItem[] = planThisWeek(applications);

  return (
    <section aria-labelledby="this-week-heading" className={`mb-8 ${className}`}>
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-border-subtle">
        <h2 id="this-week-heading" className="font-mono text-eyebrow uppercase tracking-widest text-content-tertiary">
          This week
        </h2>
      </div>

      {items.length === 0 ? (
        <div className="py-3 text-small text-content-tertiary flex items-center gap-2">
          <span>Nothing urgent right now.</span>
          <Link href="/" className="text-content-link hover:underline font-medium inline-flex items-center gap-1">
            Analyze a new job <ArrowRight className="w-3 h-3" aria-hidden="true" />
          </Link>
        </div>
      ) : (
        <div className="divide-y divide-border-subtle">
          {items.map((item, idx) => {
            let icon = <Clock className="w-4 h-4 text-action-primary" aria-hidden="true" />;
            if (item.kind === 'deadline') {
              icon = <Clock className="w-4 h-4 text-status-risk-content" aria-hidden="true" />;
            } else if (item.kind === 'overdue-log') {
              icon = <CheckSquare className="w-4 h-4 text-status-caution-content" aria-hidden="true" />;
            } else if (item.kind === 'prep-stage') {
              icon = <PlayCircle className="w-4 h-4 text-action-primary" aria-hidden="true" />;
            } else if (item.kind === 'triage') {
              icon = <AlertCircle className="w-4 h-4 text-status-risk-content" aria-hidden="true" />;
            }

            return (
              <div key={`${item.applicationId}-${idx}`} className="flex items-start justify-between gap-4 py-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <span className="mt-0.5 shrink-0">{icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-sans text-small font-semibold text-content-primary truncate">
                      {item.title}
                    </p>
                    <p className="font-sans text-small text-content-tertiary truncate">
                      {item.reason}
                    </p>
                  </div>
                </div>

                <Link
                  href={item.href}
                  className="shrink-0 text-small text-content-link hover:underline font-medium inline-flex items-center gap-1"
                >
                  {item.cta}
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
