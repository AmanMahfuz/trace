'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Wordmark } from '@/design-system/primitives/Wordmark';
import { FormField } from '@/design-system/primitives/FormField';
import { Input } from '@/design-system/primitives/Field';
import { Button } from '@/design-system/primitives/Button';
import { Banner } from '@/design-system/primitives/Banner';
import { TextLink } from '@/design-system/primitives/TextLink';
import { CheckCircle2, ArrowRight } from 'lucide-react';

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [success, setSuccess] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || !confirmPassword) return;

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setSuccess(true);
      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Failed to update password. Please try requesting a new reset link.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 sm:px-6 py-12 bg-surface-page text-content-secondary">
      <div className="w-full max-w-md space-y-6">
        <div className="bg-surface-raised border border-border-subtle rounded-(--radius-overlay) p-8 space-y-6 shadow-(--shadow-overlay)">
          <div className="space-y-2">
            <Wordmark />
            <h1 className="text-heading-2 font-semibold text-content-primary pt-2">
              Set new password
            </h1>
            <p className="text-small text-content-tertiary">
              Enter your new account password below.
            </p>
          </div>

          {errorMsg && (
            <Banner
              variant="risk"
              title="Reset Failed"
              description={errorMsg}
            />
          )}

          {success ? (
            <div className="p-4 bg-surface-sunken rounded-(--radius-control) space-y-2 text-center">
              <div className="w-10 h-10 rounded-full bg-status-strong-surface text-status-strong-content flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <h3 className="text-small font-semibold text-content-primary">
                Password updated!
              </h3>
              <p className="text-small text-content-tertiary">
                Redirecting to your dashboard…
              </p>
            </div>
          ) : (
            <form onSubmit={handleReset} className="space-y-4">
              <FormField label="New Password" required>
                <Input
                  type="password"
                  required
                  minLength={6}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </FormField>

              <FormField label="Confirm Password" required>
                <Input
                  type="password"
                  required
                  minLength={6}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </FormField>

              <Button
                type="submit"
                variant="primary"
                disabled={loading}
                iconRight={<ArrowRight className="w-4 h-4" />}
                className="w-full"
              >
                {loading ? 'Updating…' : 'Save New Password'}
              </Button>
            </form>
          )}
        </div>

        <div className="text-center">
          <TextLink href="/login" variant="secondary">
            ← Back to sign in
          </TextLink>
        </div>
      </div>
    </div>
  );
}
