'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  getPendingUpload,
  clearPendingUpload,
} from '@/lib/storage/upload-handoff';
import {
  Mail,
  Loader2,
  ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';
import { Banner } from '@/design-system/primitives/Banner';
import { Wordmark } from '@/design-system/primitives/Wordmark';

function AuthContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  // Mode: 'magic_link' | 'password'
  const [authMethod, setAuthMethod] = useState<'magic_link' | 'password'>('magic_link');
  const [isSignUp, setIsSignUp] = useState(false);

  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // UI state
  const [sentMagicLink, setSentMagicLink] = useState(false);
  const [loading, setLoading] = useState(false);
  const [analyzingPending, setAnalyzingPending] = useState(false);
  const [successNotice, setSuccessNotice] = useState('');
  const [hasPendingAnalysis, setHasPendingAnalysis] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Derive initial error message from searchParams directly
  const errorParam = searchParams.get('error');
  const urlError =
    errorParam === 'expired_token'
      ? 'This login link has expired or has already been used. Please request a fresh link.'
      : errorParam === 'rate_limit'
        ? 'Too many sign-in attempts from this connection. Please wait 5 minutes before trying again.'
        : errorParam
          ? searchParams.get('error_description') || 'Authentication issue encountered. Please try again.'
          : '';

  const [customError, setCustomError] = useState('');
  const errorMsg = customError || urlError;

  // Check pending analysis handoff
  useEffect(() => {
    let active = true;
    getPendingUpload().then((pending) => {
      if (active && pending) {
        setHasPendingAnalysis(true);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  // Resend countdown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Execute pending analysis immediately if returning with an in-flight submission
  const executePendingAnalysisIfPresent = async (): Promise<boolean> => {
    const isHandoff =
      hasPendingAnalysis ||
      (typeof window !== 'undefined' &&
        new URLSearchParams(window.location.search).get('handoff') === '1');

    const pending = await getPendingUpload();

    if (!pending) {
      if (isHandoff) {
        router.push('/?message=missing_upload');
        return true;
      }
      return false;
    }

    setAnalyzingPending(true);
    try {
      const formData = new FormData();
      formData.append('file', pending.file);
      if (pending.jobInput.startsWith('http://') || pending.jobInput.startsWith('https://')) {
        formData.append('jobUrl', pending.jobInput);
      } else {
        formData.append('jobText', pending.jobInput);
      }

      const res = await fetch('/api/analyze', { method: 'POST', body: formData });
      if (res.ok) {
        const resultData = await res.json();
        await clearPendingUpload();
        router.push(`/prep/${resultData.applicationId}`);
        return true;
      }
    } catch {
      // Fall through to dashboard
    } finally {
      setAnalyzingPending(false);
    }
    return false;
  };

  // Google OAuth
  const handleGoogle = async () => {
    setCustomError('');
    const nextPath = hasPendingAnalysis ? '/dashboard?handoff=1' : '/dashboard';
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
      },
    });
  };

  // Magic Link
  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setCustomError('');
    setSuccessNotice('');

    try {
      const nextPath = hasPendingAnalysis ? '/dashboard?handoff=1' : '/dashboard';
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
        },
      });

      if (error) {
        if (error.status === 429 || error.message.toLowerCase().includes('rate limit')) {
          setCustomError('Too many sign-in attempts from this connection. Please wait 5 minutes before trying again.');
        } else {
          setCustomError(error.message);
        }
      } else {
        setSentMagicLink(true);
        setResendCooldown(60);
      }
    } catch (err: unknown) {
      setCustomError(err instanceof Error ? err.message : 'Failed to send magic link. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Password Auth
  const handlePasswordAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;

    if (isSignUp) {
      if (password.length < 6) {
        setCustomError('Password must be at least 6 characters long.');
        return;
      }
      if (password !== confirmPassword) {
        setCustomError('Passwords do not match. Please ensure both passwords match.');
        return;
      }
    }

    setLoading(true);
    setCustomError('');
    setSuccessNotice('');

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
          },
        });
        if (error) throw error;

        if (data?.user && !data.session) {
          setSuccessNotice('Account registered! Please check your email to confirm your registration.');
          setLoading(false);
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
      }

      const redirected = await executePendingAnalysisIfPresent();
      if (!redirected) {
        router.push('/dashboard');
      }
    } catch (err: unknown) {
      setCustomError(err instanceof Error ? err.message : 'Authentication failed. Please verify your credentials.');
      setLoading(false);
    }
  };

  if (analyzingPending) {
    return (
      <div className="min-h-screen w-full flex flex-col justify-center items-center px-6 py-10 bg-surface-page text-center">
        <Loader2 className="w-8 h-8 animate-spin text-action-primary mb-4" />
        <h2 className="text-heading-2 font-semibold text-content-primary">
          Processing your pending analysis…
        </h2>
        <p className="text-small text-content-tertiary mt-2">
          Hold tight while the diagnostic engine evaluates your application.
        </p>
      </div>
    );
  }

  return (
    <main className="min-h-screen w-full flex flex-col justify-center items-center px-6 py-10 bg-surface-page">
      <div className="w-full max-w-sm mx-auto py-8">
        {/* Sent Link State */}
        {sentMagicLink ? (
          <div className="flex flex-col items-center text-center">
            {/* Trace Logo Motif */}
            <div className="mb-8">
              <Wordmark />
            </div>

            {/* Mail Icon Indicator */}
            <div className="w-12 h-12 rounded-full bg-surface-sunken flex items-center justify-center mb-4 text-content-primary">
              <Mail className="w-6 h-6" />
            </div>

            <h1 className="font-sans text-heading-2 font-semibold text-content-primary">
              Check your inbox
            </h1>

            <div className="mt-2 text-center text-small font-sans text-content-secondary leading-relaxed">
              <span>We sent a temporary sign-in link to</span>
              <div className="my-2.5">
                <span className="inline-block font-mono text-small text-content-primary bg-surface-sunken border border-border-subtle px-2.5 py-1 rounded-(--radius-control)">
                  {email}
                </span>
              </div>
              <p className="text-eyebrow text-content-tertiary mt-2">
                Click the link in the email to sign in automatically. It expires in 15 minutes.
              </p>
            </div>

            <div className="mt-8 flex flex-col items-center gap-3 w-full border-t border-border-subtle pt-6">
              <button
                type="button"
                onClick={() => {
                  setSentMagicLink(false);
                  setCustomError('');
                }}
                className="font-sans text-small font-medium text-action-primary hover:underline transition cursor-pointer"
              >
                Use a different email
              </button>
              <button
                type="button"
                disabled={resendCooldown > 0}
                onClick={handleMagicLink}
                className="font-mono text-eyebrow uppercase tracking-wider text-content-tertiary hover:text-content-primary transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resendCooldown > 0 ? `Resend link (${resendCooldown}s)` : 'Resend link'}
              </button>
            </div>
          </div>
        ) : (
          /* Default Entry State */
          <div>
            {/* 1. Brand Mark & Header */}
            <div className="flex flex-col items-center text-center">
              <Wordmark />
              <h1 className="font-sans text-heading-1 font-semibold tracking-tight text-content-primary text-center mt-3">
                {isSignUp ? 'Create your account' : 'Sign in to Trace'}
              </h1>
              <p className="font-sans text-small text-content-tertiary text-center mt-1 mb-8">
                {hasPendingAnalysis
                  ? 'Sign in to access your pending diagnostic report.'
                  : 'Save your analyses and track outcomes.'}
              </p>
            </div>

            {errorMsg && (
              <div className="mb-4">
                <Banner variant="risk" title="Notice" description={errorMsg} />
              </div>
            )}

            {successNotice && (
              <div className="mb-4">
                <Banner variant="strong" title="Success" description={successNotice} />
              </div>
            )}

            {/* 2. Primary Auth Actions */}
            <div className="flex flex-col w-full">
              {/* Google Button */}
              <button
                type="button"
                onClick={handleGoogle}
                className="h-11 rounded-(--radius-control) bg-surface-raised border border-border-control flex items-center justify-center gap-3 w-full font-sans text-small font-medium text-content-primary hover:bg-surface-sunken focus:outline-none focus:ring-2 focus:ring-action-focus-ring focus:ring-offset-2 transition-colors cursor-pointer"
              >
                <svg aria-hidden="true" className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="currentColor"
                    className="text-action-primary"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="currentColor"
                    className="text-status-strong-mark"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    fill="currentColor"
                    className="text-status-caution-mark"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    fill="currentColor"
                    className="text-status-risk-mark"
                  />
                </svg>
                <span>Continue with Google</span>
              </button>

              {/* Divider with Text */}
              <div className="relative flex items-center justify-center my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border-subtle" />
                </div>
                <span className="relative bg-surface-page px-3 font-mono text-eyebrow uppercase text-content-tertiary tracking-wider select-none">
                  or
                </span>
              </div>

              {/* Auth Mode Switcher */}
              <div className="flex border-b border-border-subtle mb-4">
                <button
                  type="button"
                  onClick={() => setAuthMethod('magic_link')}
                  className={`pb-2 font-mono text-eyebrow uppercase tracking-wider transition-colors mr-6 ${
                    authMethod === 'magic_link'
                      ? 'border-b-2 border-action-primary text-content-primary font-semibold'
                      : 'text-content-tertiary hover:text-content-primary'
                  }`}
                >
                  Magic Link
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMethod('password')}
                  className={`pb-2 font-mono text-eyebrow uppercase tracking-wider transition-colors ${
                    authMethod === 'password'
                      ? 'border-b-2 border-action-primary text-content-primary font-semibold'
                      : 'text-content-tertiary hover:text-content-primary'
                  }`}
                >
                  Password
                </button>
              </div>

              {authMethod === 'magic_link' ? (
                /* Magic link Form */
                <form onSubmit={handleMagicLink} className="flex flex-col w-full">
                  <div>
                    <label
                      htmlFor="work-email"
                      className="block font-sans text-small font-medium text-content-primary mb-1.5"
                    >
                      Email address
                    </label>
                    <input
                      id="work-email"
                      name="email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="w-full h-11 rounded-(--radius-control) bg-surface-raised border border-border-control px-3.5 font-sans text-small text-content-primary placeholder:text-content-tertiary focus:outline-none focus:border-action-primary focus:ring-1 focus:ring-action-focus-ring transition"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="h-11 w-full rounded-(--radius-control) bg-action-primary hover:bg-action-primary-hover active:scale-[0.99] text-content-on-action font-sans text-small font-medium transition-all mt-4 flex items-center justify-center cursor-pointer disabled:opacity-50"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      'Email me a sign-in link'
                    )}
                  </button>

                  <p className="font-sans text-eyebrow text-content-tertiary text-center mt-3 leading-relaxed">
                    No password. We only use your email to sign you in.
                  </p>
                </form>
              ) : (
                /* Password Form */
                <form onSubmit={handlePasswordAuth} className="flex flex-col w-full space-y-3">
                  <div>
                    <label
                      htmlFor="password-email"
                      className="block font-sans text-small font-medium text-content-primary mb-1"
                    >
                      Email address
                    </label>
                    <input
                      id="password-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="w-full h-11 rounded-(--radius-control) bg-surface-raised border border-border-control px-3.5 font-sans text-small text-content-primary placeholder:text-content-tertiary focus:outline-none focus:border-action-primary focus:ring-1 focus:ring-action-focus-ring transition"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="password"
                      className="block font-sans text-small font-medium text-content-primary mb-1"
                    >
                      Password
                    </label>
                    <input
                      id="password"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full h-11 rounded-(--radius-control) bg-surface-raised border border-border-control px-3.5 font-sans text-small text-content-primary placeholder:text-content-tertiary focus:outline-none focus:border-action-primary focus:ring-1 focus:ring-action-focus-ring transition"
                    />
                  </div>

                  {isSignUp && (
                    <div>
                      <label
                        htmlFor="confirm-password"
                        className="block font-sans text-small font-medium text-content-primary mb-1"
                      >
                        Confirm Password
                      </label>
                      <input
                        id="confirm-password"
                        type="password"
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full h-11 rounded-(--radius-control) bg-surface-raised border border-border-control px-3.5 font-sans text-small text-content-primary placeholder:text-content-tertiary focus:outline-none focus:border-action-primary focus:ring-1 focus:ring-action-focus-ring transition"
                      />
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="h-11 w-full rounded-(--radius-control) bg-action-primary hover:bg-action-primary-hover active:scale-[0.99] text-content-on-action font-sans text-small font-medium transition-all mt-4 flex items-center justify-center cursor-pointer disabled:opacity-50"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : isSignUp ? (
                      'Create account'
                    ) : (
                      'Sign in with password'
                    )}
                  </button>

                  <div className="flex justify-between items-center pt-2">
                    <button
                      type="button"
                      onClick={() => setIsSignUp(!isSignUp)}
                      className="font-sans text-eyebrow text-action-primary hover:underline"
                    >
                      {isSignUp ? 'Already have an account? Sign in' : 'Need an account? Sign up'}
                    </button>
                    {!isSignUp && (
                      <Link
                        href="/reset-password"
                        className="font-sans text-eyebrow text-content-tertiary hover:text-content-primary"
                      >
                        Forgot password?
                      </Link>
                    )}
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        <div className="mt-8 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 font-sans text-eyebrow text-content-tertiary hover:text-content-primary transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to home</span>
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen w-full flex items-center justify-center bg-surface-page">
          <Loader2 className="w-6 h-6 animate-spin text-action-primary" />
        </div>
      }
    >
      <AuthContent />
    </Suspense>
  );
}
