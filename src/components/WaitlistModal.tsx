'use client';

import React, { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Dialog } from '@/design-system/patterns/Dialog';
import { FormField } from '@/design-system/primitives/FormField';
import { Input } from '@/design-system/primitives/Field';
import { Check } from 'lucide-react';

export function WaitlistModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!email) return;

    setLoading(true);
    try {
      await supabase.from('waitlist').insert({ email });
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="You are out of practice credits"
      description="Paid credits are coming soon. Leave your email and we will let you know first."
      primaryAction={
        !submitted
          ? {
              label: 'Notify me',
              onClick: () => handleSubmit(),
              loading,
            }
          : undefined
      }
      secondaryAction={{
        label: submitted ? 'Close' : 'Cancel',
        onClick: onClose,
      }}
    >
      {!submitted ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField id="waitlist-email" label="Email" required>
            <Input
              id="waitlist-email"
              type="email"
              placeholder="you@university.edu"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </FormField>
        </form>
      ) : (
        <div className="p-3 bg-status-strong-surface border border-status-strong-border rounded-(--radius-control) text-small text-status-strong-content flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>Saved. We will email you as soon as credit packs drop.</span>
        </div>
      )}
    </Dialog>
  );
}
