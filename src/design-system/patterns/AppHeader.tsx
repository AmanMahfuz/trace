'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Wordmark } from '../primitives/Wordmark';
import { User, LogOut, Trash2, PanelLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useSidebar } from './SidebarContext';

export interface AppHeaderProps {
  userEmail?: string | null;
  credits?: number | null;
  onDeleteData?: () => void;
  className?: string;
  alwaysShow?: boolean;
}

export function AppHeader({
  userEmail: initialEmail,
  credits: initialCredits,
  onDeleteData,
  className = '',
  alwaysShow = false,
}: AppHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { toggleSidebar, isOpen } = useSidebar();
  const [email, setEmail] = useState<string | null>(initialEmail || null);
  const [credits, setCredits] = useState<number | null>(
    initialCredits !== undefined ? initialCredits : null
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Check if public page
  const publicRoutes = ['/', '/login', '/privacy', '/terms'];
  const isPublicPage = publicRoutes.includes(pathname);

  useEffect(() => {
    // If not supplied via props, load once on mount
    if (initialEmail === undefined) {
      const supabase = createClient();
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) {
          setEmail(user.email || null);
          supabase
            .from('profiles')
            .select('credits')
            .eq('id', user.id)
            .single()
            .then(({ data }) => {
              if (data) setCredits(data.credits);
            });
        }
      });
    }
  }, [initialEmail]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  };

  // On authenticated pages, hide top header on desktop (since left docked sidebar is present)
  // On mobile or on public pages, show top header
  const visibilityClass = isPublicPage || alwaysShow ? 'block' : 'md:hidden';

  return (
    <header className={`h-16 w-full bg-surface-page border-b border-border-subtle sticky top-0 z-30 ${visibilityClass} ${className}`}>
      {/* Skip to main content link for keyboard users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-action-primary focus:text-content-on-action focus:rounded-(--radius-control) text-small font-medium"
      >
        Skip to content
      </a>

      <div className="max-w-(--size-content-max) mx-auto h-full px-6 sm:px-12 flex items-center justify-between">
        {/* Left: Sidebar Toggle (authenticated mobile only), Wordmark & Text Nav */}
        <div className="flex items-center gap-3 sm:gap-6">
          {!isPublicPage && (
            <button
              type="button"
              onClick={toggleSidebar}
              aria-label="Toggle navigation drawer"
              title="Toggle navigation drawer"
              aria-expanded={isOpen}
              className={`p-1.5 -ml-1 rounded-(--radius-control) border transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-action-focus-ring ${
                isOpen
                  ? 'border-border-control bg-surface-sunken text-action-primary'
                  : 'border-border-subtle hover:border-border-control bg-surface-raised hover:bg-surface-sunken text-content-secondary hover:text-content-primary'
              }`}
            >
              <PanelLeft className="w-4 h-4" />
            </button>
          )}
          <Wordmark href={email ? '/dashboard' : '/'} />
          {email && isPublicPage && (
            <Link
              href="/dashboard"
              className="hidden sm:inline-block text-small font-medium text-content-secondary hover:text-content-primary transition-colors focus-visible:outline-none focus-visible:ring-(--focus-ring-width) focus-visible:ring-action-focus-ring rounded-(--radius-control)"
            >
              Dashboard
            </Link>
          )}
        </div>

        {/* Right: Credits mono + Avatar Menu or Sign In */}
        <div className="flex items-center gap-4">
          {credits !== null && (
            <span className="font-mono text-eyebrow text-content-primary tabular-nums bg-surface-sunken px-2.5 py-1 rounded-(--radius-control) border border-border-subtle">
              {credits} {credits === 1 ? 'credit' : 'credits'}
            </span>
          )}

          {email ? (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen(!menuOpen)}
                className="w-9 h-9 rounded-full bg-surface-sunken border border-border-subtle flex items-center justify-center text-content-secondary hover:text-content-primary cursor-pointer focus-visible:outline-none focus-visible:ring-(--focus-ring-width) focus-visible:ring-action-focus-ring"
                aria-label="User account menu"
                aria-expanded={menuOpen}
              >
                <User className="w-4 h-4" aria-hidden="true" />
              </button>

              {menuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-surface-raised border border-border-subtle rounded-(--radius-control) shadow-(--shadow-overlay) py-1.5 z-(--z-overlay)">
                  <div className="px-3 py-1.5 border-b border-border-subtle">
                    <p className="text-eyebrow text-content-tertiary truncate">{email}</p>
                  </div>
                  <Link
                    href="/dashboard"
                    onClick={() => setMenuOpen(false)}
                    className="sm:hidden block px-3 py-2 text-small text-content-secondary hover:bg-surface-sunken transition-colors"
                  >
                    Applications
                  </Link>
                  <Link
                    href="/resumes"
                    onClick={() => setMenuOpen(false)}
                    className="sm:hidden block px-3 py-2 text-small text-content-secondary hover:bg-surface-sunken transition-colors"
                  >
                    Saved resumes
                  </Link>
                  {onDeleteData && (
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        onDeleteData();
                      }}
                      className="w-full text-left px-3 py-2 text-small text-status-risk-content hover:bg-status-risk-surface transition-colors flex items-center gap-2 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete my data</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="w-full text-left px-3 py-2 text-small text-content-secondary hover:bg-surface-sunken transition-colors flex items-center gap-2 cursor-pointer border-t border-border-subtle mt-1"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign out</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <Link
                href="/login"
                className="text-small font-medium text-content-secondary hover:text-content-primary transition-colors focus-visible:outline-none focus-visible:ring-(--focus-ring-width) focus-visible:ring-action-focus-ring rounded-(--radius-control)"
              >
                Sign in
              </Link>
              <Link
                href="/login"
                className="h-9 px-3.5 rounded-(--radius-control) bg-action-primary hover:bg-action-primary-hover text-content-on-action text-small font-medium transition-colors flex items-center justify-center focus-visible:outline-none focus-visible:ring-(--focus-ring-width) focus-visible:ring-action-focus-ring"
              >
                Get Started
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
