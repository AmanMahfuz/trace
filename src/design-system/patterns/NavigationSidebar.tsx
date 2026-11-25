'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSidebar } from './SidebarContext';
import { Wordmark } from '../primitives/Wordmark';
import { createClient } from '@/lib/supabase/client';
import {
  PanelLeftClose,
  PanelLeftOpen,
  ChevronRight,
  Plus,
  LayoutDashboard,
  FileText,
  Palette,
  Settings,
} from 'lucide-react';

export function NavigationSidebar() {
  const {
    isOpen,
    closeSidebar,
    isCollapsed,
    toggleCollapse,
    activeAppId,
  } = useSidebar();
  const pathname = usePathname();
  const router = useRouter();
  const sidebarRef = useRef<HTMLDivElement>(null);

  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const [roleTitle, setRoleTitle] = useState<string>('Target Role');
  const [companyLocation, setCompanyLocation] = useState<string>('');
  const [hasSession, setHasSession] = useState<boolean>(false);
  const [hasOutcome, setHasOutcome] = useState<boolean>(false);

  // 1. Check if public route
  const publicRoutes = ['/', '/login', '/privacy', '/terms'];
  const isPublicPage = publicRoutes.includes(pathname);

  // Check if current route is an application route
  const isAppSection = Boolean(
    pathname &&
      (pathname.startsWith('/prep') ||
        pathname.startsWith('/arena') ||
        pathname.startsWith('/report') ||
        pathname.startsWith('/why-not'))
  );

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserEmail(user.email || null);
        supabase
          .from('profiles')
          .select('credits')
          .eq('id', user.id)
          .single()
          .then(({ data }) => {
            if (data) setCredits(data.credits);
          });
      } else {
        setUserEmail(null);
        setCredits(null);
      }
    });
  }, [pathname]);

  // Load active application info for "This application" section
  useEffect(() => {
    if (!activeAppId) return;
    const supabase = createClient();
    supabase
      .from('applications')
      .select('id, outcome, status, jobs(title, company, location)')
      .eq('id', activeAppId)
      .single()
      .then(({ data }) => {
        if (data) {
          const jobObj = (Array.isArray(data.jobs) ? data.jobs[0] : data.jobs) as {
            title?: string;
            company?: string;
            location?: string;
          } | null;
          const title = jobObj?.title || 'Target Role';
          const sub = [jobObj?.company, jobObj?.location].filter(Boolean).join(' · ');
          setRoleTitle(title);
          setCompanyLocation(sub || 'Company & Location');
          setHasOutcome(Boolean(data.outcome && data.outcome !== 'not_applied'));
        }
      });

    supabase
      .from('interview_sessions')
      .select('id')
      .eq('application_id', activeAppId)
      .limit(1)
      .then(({ data }) => {
        setHasSession(Boolean(data && data.length > 0));
      });
  }, [activeAppId]);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    closeSidebar();
    router.push('/');
    router.refresh();
  };

  // If public page, do not render sidebar
  if (isPublicPage) {
    return null;
  }

  // Step state determination for trace line
  const getStepState = (step: 'prep' | 'arena' | 'report' | 'why-not') => {
    const current = pathname?.startsWith('/prep')
      ? 'prep'
      : pathname?.startsWith('/arena')
      ? 'arena'
      : pathname?.startsWith('/report')
      ? 'report'
      : pathname?.startsWith('/why-not')
      ? 'why-not'
      : null;

    if (current === step) return 'current';

    if (step === 'prep') {
      return 'done';
    }

    if (step === 'arena') {
      if (hasSession) return 'done';
      return 'unlocked';
    }

    if (step === 'report') {
      if (!hasSession) return 'locked';
      if (current === 'why-not') return 'done';
      return 'unlocked';
    }

    if (step === 'why-not') {
      if (!hasOutcome) return 'locked';
      return 'unlocked';
    }

    return 'unlocked';
  };

  const renderStepDot = (state: 'current' | 'done' | 'unlocked' | 'locked') => {
    switch (state) {
      case 'current':
        return (
          <span
            className="w-3 h-3 rounded-full bg-surface-raised border-2 border-action-primary ring-3 ring-surface-selected shrink-0 mt-1.5"
            aria-hidden="true"
          />
        );
      case 'done':
        return (
          <span
            className="w-3 h-3 rounded-full bg-action-primary shrink-0 mt-1.5"
            aria-hidden="true"
          />
        );
      case 'locked':
        return (
          <span
            className="w-3 h-3 rounded-full bg-surface-page border border-border-control opacity-60 shrink-0 mt-1.5"
            aria-hidden="true"
          />
        );
      case 'unlocked':
      default:
        return (
          <span
            className="w-3 h-3 rounded-full bg-surface-page border border-content-secondary shrink-0 mt-1.5"
            aria-hidden="true"
          />
        );
    }
  };

  // Expanded Sidebar Content (Full labels, trace line stepper, user profile)
  const renderExpandedContent = () => (
    <div className="flex flex-col h-full justify-between">
      {/* Top Header & Navigation Links */}
      <div className="flex flex-col overflow-y-auto">
        {/* Wordmark Header */}
        <div className="h-16 px-5 flex items-center justify-between shrink-0">
          <Wordmark href={userEmail ? '/dashboard' : '/'} />
          <div className="flex items-center gap-1">
            {/* Desktop collapse button */}
            <button
              type="button"
              onClick={toggleCollapse}
              className="hidden md:flex w-8 h-8 rounded-(--radius-control) items-center justify-center text-content-secondary hover:text-content-primary hover:bg-surface-sunken transition-colors cursor-pointer"
              aria-label="Collapse sidebar"
              title="Collapse sidebar (Ctrl+B)"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
            {/* Mobile close button */}
            <button
              type="button"
              onClick={closeSidebar}
              className="md:hidden w-8 h-8 rounded-(--radius-control) flex items-center justify-center text-content-secondary hover:text-content-primary hover:bg-surface-sunken transition-colors cursor-pointer"
              aria-label="Close navigation"
            >
              <PanelLeftClose className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Primary Links */}
        <div className="px-3 py-2 space-y-1">
          <Link
            href="/"
            onClick={closeSidebar}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-(--radius-control) text-small font-medium transition-colors ${
              pathname === '/'
                ? 'bg-surface-selected text-action-primary'
                : 'text-content-secondary hover:text-content-primary hover:bg-surface-sunken'
            }`}
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>Analyze</span>
          </Link>

          <Link
            href="/dashboard"
            onClick={closeSidebar}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-(--radius-control) text-small font-medium transition-colors ${
              pathname === '/dashboard'
                ? 'bg-surface-selected text-action-primary font-medium'
                : 'text-content-secondary hover:text-content-primary hover:bg-surface-sunken'
            }`}
          >
            <LayoutDashboard className="w-4 h-4 shrink-0" />
            <span>Applications</span>
          </Link>

          <Link
            href="/resumes"
            onClick={closeSidebar}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-(--radius-control) text-small font-medium transition-colors ${
              pathname === '/resumes' || pathname === '/resume' || pathname?.startsWith('/resumes/')
                ? 'bg-surface-selected text-action-primary font-medium'
                : 'text-content-secondary hover:text-content-primary hover:bg-surface-sunken'
            }`}
          >
            <FileText className="w-4 h-4 shrink-0" />
            <span>Saved resumes</span>
          </Link>
        </div>

        {/* "This application" section with vertical trace line */}
        {isAppSection && activeAppId && (
          <div className="px-3 pt-5 space-y-2">
            <div className="border-t border-border-subtle pt-4 px-1">
              <div className="font-mono text-eyebrow text-content-tertiary uppercase tracking-wider font-semibold">
                This application
              </div>
              <div
                className="font-semibold text-small text-content-primary mt-1.5 truncate"
                title={roleTitle}
              >
                {roleTitle}
              </div>
              {companyLocation && (
                <div
                  className="text-tiny text-content-tertiary truncate mt-0.5"
                  title={companyLocation}
                >
                  {companyLocation}
                </div>
              )}
            </div>

            {/* Stepper with the trace line */}
            <ol aria-label="Application steps" className="list-none mt-2 p-0 relative">
              {/* Continuous vertical trace line */}
              <div
                className="absolute w-px bg-border-default"
                style={{ left: 17, top: 18, bottom: 22 }}
                aria-hidden="true"
              />

              {/* Step 1: Prep */}
              <li className="flex gap-3.5 p-2 px-3 relative">
                {renderStepDot(getStepState('prep'))}
                <div>
                  <Link
                    href={`/prep/${activeAppId}`}
                    onClick={closeSidebar}
                    className={`text-small transition-colors ${
                      pathname?.startsWith('/prep')
                        ? 'font-semibold text-content-primary'
                        : 'text-content-secondary hover:text-content-primary'
                    }`}
                  >
                    Prep
                  </Link>
                </div>
              </li>

              {/* Step 2: Practice */}
              <li className="flex gap-3.5 p-2 px-3 relative">
                {renderStepDot(getStepState('arena'))}
                <div>
                  <Link
                    href={`/arena/${activeAppId}`}
                    onClick={closeSidebar}
                    className={`text-small transition-colors ${
                      pathname?.startsWith('/arena')
                        ? 'font-semibold text-content-primary'
                        : 'text-content-secondary hover:text-content-primary'
                    }`}
                  >
                    Practice
                  </Link>
                  <div className="text-tiny text-content-tertiary mt-0.5">
                    5 min · 1 credit
                  </div>
                </div>
              </li>

              {/* Step 3: Practice report */}
              <li className="flex gap-3.5 p-2 px-3 relative">
                {renderStepDot(getStepState('report'))}
                <div>
                  {hasSession ? (
                    <Link
                      href={`/report/${activeAppId}`}
                      onClick={closeSidebar}
                      className={`text-small transition-colors ${
                        pathname?.startsWith('/report')
                          ? 'font-semibold text-content-primary'
                          : 'text-content-secondary hover:text-content-primary'
                      }`}
                    >
                      Practice report
                    </Link>
                  ) : (
                    <div>
                      <span className="text-small font-medium text-content-disabled cursor-not-allowed">
                        Practice report
                      </span>
                      <div className="text-tiny text-content-tertiary mt-0.5">
                        Finish a practice session
                      </div>
                    </div>
                  )}
                </div>
              </li>

              {/* Step 4: Why-not report */}
              <li className="flex gap-3.5 p-2 px-3 relative">
                {renderStepDot(getStepState('why-not'))}
                <div>
                  {hasOutcome ? (
                    <Link
                      href={`/why-not/${activeAppId}`}
                      onClick={closeSidebar}
                      className={`text-small transition-colors ${
                        pathname?.startsWith('/why-not')
                          ? 'font-semibold text-content-primary'
                          : 'text-content-secondary hover:text-content-primary'
                      }`}
                    >
                      Why-not report
                    </Link>
                  ) : (
                    <div>
                      <span className="text-small font-medium text-content-disabled cursor-not-allowed">
                        Why-not report
                      </span>
                      <div className="text-tiny text-content-tertiary mt-0.5">
                        Log an outcome on Applications
                      </div>
                    </div>
                  )}
                </div>
              </li>
            </ol>
          </div>
        )}

        {/* Styleguide link in development only */}
        {process.env.NODE_ENV !== 'production' && (
          <div className="px-3 pt-6 space-y-1">
            <Link
              href="/styleguide"
              onClick={closeSidebar}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-(--radius-control) text-small transition-colors ${
                pathname === '/styleguide'
                  ? 'bg-surface-selected text-action-primary font-medium'
                  : 'text-content-tertiary hover:text-content-primary hover:bg-surface-sunken'
              }`}
            >
              <Palette className="w-4 h-4 shrink-0" />
              <span>Design System</span>
            </Link>
          </div>
        )}
      </div>

      {/* Footer Area: User email, credits, sign out, Privacy · Terms */}
      <div className="p-5 border-t border-border-subtle bg-surface-page space-y-2">
        <div className="text-small text-content-primary font-medium truncate font-mono">
          {userEmail || 'asha.nair@example.com'}
        </div>
        <div className="font-mono text-eyebrow text-content-secondary">
          {credits !== null ? `${credits} credits` : '3 credits'}
        </div>

        <div className="pt-1 flex items-center gap-2 text-small font-sans">
          <Link
            href="/settings"
            onClick={closeSidebar}
            className="text-content-secondary hover:text-content-primary hover:underline"
          >
            Settings
          </Link>
          <span className="text-content-tertiary">·</span>
          <button
            type="button"
            onClick={handleSignOut}
            className="text-action-primary hover:underline cursor-pointer block text-left font-sans"
          >
            Sign out
          </button>
        </div>

        <div className="flex items-center gap-2 pt-2 text-eyebrow text-content-tertiary font-sans">
          <Link href="/privacy" className="hover:text-content-primary hover:underline">
            Privacy
          </Link>
          <span>·</span>
          <Link href="/terms" className="hover:text-content-primary hover:underline">
            Terms
          </Link>
        </div>
      </div>
    </div>
  );

  // Collapsed Sidebar Content (Icon rail, tooltips, compact stepper, expand button)
  const renderCollapsedContent = () => (
    <div className="flex flex-col h-full justify-between items-center py-4">
      {/* Top Section */}
      <div className="flex flex-col items-center w-full">
        {/* Top Header: Expand Toggle & Monogram */}
        <div className="h-16 flex flex-col items-center justify-center shrink-0 w-full px-2 mb-2">
          <button
            type="button"
            onClick={toggleCollapse}
            aria-label="Expand sidebar"
            title="Expand sidebar (Ctrl+B)"
            className="w-10 h-10 rounded-(--radius-control) flex items-center justify-center text-content-secondary hover:text-content-primary hover:bg-surface-sunken transition-colors cursor-pointer group"
          >
            <PanelLeftOpen className="w-5 h-5 text-content-secondary group-hover:text-action-primary" />
          </button>
        </div>

        {/* Primary Icon Links */}
        <nav aria-label="Main Navigation Icons" className="flex flex-col items-center gap-2 w-full px-2">
          <Link
            href="/"
            title="Analyze"
            className={`w-11 h-11 rounded-(--radius-control) flex items-center justify-center transition-colors ${
              pathname === '/'
                ? 'bg-surface-selected text-action-primary'
                : 'text-content-secondary hover:text-content-primary hover:bg-surface-sunken'
            }`}
          >
            <Plus className="w-5 h-5 shrink-0" />
            <span className="sr-only">Analyze</span>
          </Link>

          <Link
            href="/dashboard"
            title="Applications"
            className={`w-11 h-11 rounded-(--radius-control) flex items-center justify-center transition-colors ${
              pathname === '/dashboard'
                ? 'bg-surface-selected text-action-primary'
                : 'text-content-secondary hover:text-content-primary hover:bg-surface-sunken'
            }`}
          >
            <LayoutDashboard className="w-5 h-5 shrink-0" />
            <span className="sr-only">Applications</span>
          </Link>

          <Link
            href="/resumes"
            title="Saved resumes"
            className={`w-11 h-11 rounded-(--radius-control) flex items-center justify-center transition-colors ${
              pathname === '/resumes' || pathname === '/resume' || pathname?.startsWith('/resumes/')
                ? 'bg-surface-selected text-action-primary'
                : 'text-content-secondary hover:text-content-primary hover:bg-surface-sunken'
            }`}
          >
            <FileText className="w-5 h-5 shrink-0" />
            <span className="sr-only">Saved resumes</span>
          </Link>
        </nav>

        {/* Compact Application Stepper Dots */}
        {isAppSection && activeAppId && (
          <div className="w-full pt-4 mt-4 border-t border-border-subtle flex flex-col items-center">
            <div className="relative flex flex-col items-center gap-3.5 py-1">
              {/* Vertical line between dots */}
              <div
                className="absolute w-px bg-border-default"
                style={{ left: 5.5, top: 8, bottom: 8 }}
                aria-hidden="true"
              />

              <Link
                href={`/prep/${activeAppId}`}
                title={`Prep · ${roleTitle}`}
                className="relative z-10 p-0.5"
              >
                {renderStepDot(getStepState('prep'))}
              </Link>

              <Link
                href={`/arena/${activeAppId}`}
                title="Practice (5 min · 1 credit)"
                className="relative z-10 p-0.5"
              >
                {renderStepDot(getStepState('arena'))}
              </Link>

              {hasSession ? (
                <Link
                  href={`/report/${activeAppId}`}
                  title="Practice report"
                  className="relative z-10 p-0.5"
                >
                  {renderStepDot(getStepState('report'))}
                </Link>
              ) : (
                <span
                  title="Practice report (Finish a practice session to unlock)"
                  className="relative z-10 p-0.5 cursor-not-allowed"
                >
                  {renderStepDot('locked')}
                </span>
              )}

              {hasOutcome ? (
                <Link
                  href={`/why-not/${activeAppId}`}
                  title="Why-not report"
                  className="relative z-10 p-0.5"
                >
                  {renderStepDot(getStepState('why-not'))}
                </Link>
              ) : (
                <span
                  title="Why-not report (Log an outcome to unlock)"
                  className="relative z-10 p-0.5 cursor-not-allowed"
                >
                  {renderStepDot('locked')}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Collapsed Controls: Credits and Expand toggle */}
      <div className="flex flex-col items-center w-full px-2 pt-4 border-t border-border-subtle gap-2">
        <div
          className="font-mono text-eyebrow text-content-secondary"
          title={`${credits !== null ? credits : 3} credits`}
        >
          {credits !== null ? credits : 3}
        </div>

        <Link
          href="/settings"
          title="Settings"
          className="w-10 h-10 rounded-(--radius-control) flex items-center justify-center text-content-secondary hover:text-content-primary hover:bg-surface-sunken transition-colors"
        >
          <Settings className="w-4 h-4" />
          <span className="sr-only">Settings</span>
        </Link>

        <button
          type="button"
          onClick={toggleCollapse}
          aria-label="Expand sidebar"
          title="Expand sidebar (Ctrl+B)"
          className="w-10 h-10 rounded-(--radius-control) border border-border-control flex items-center justify-center hover:bg-surface-sunken cursor-pointer text-content-primary transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* 1. Mobile Drawer Backdrop */}
      <div
        className={`md:hidden fixed inset-0 z-(--z-overlay) bg-content-primary/20 backdrop-blur-xs transition-opacity duration-(--duration-250) ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={closeSidebar}
        aria-hidden="true"
      />

      {/* 2. Mobile Drawer Panel */}
      <aside
        ref={sidebarRef}
        aria-label="Main Navigation Drawer"
        aria-hidden={!isOpen}
        className={`md:hidden fixed top-0 left-0 bottom-0 z-(--z-overlay) w-64 bg-surface-page border-r border-border-subtle shadow-(--shadow-overlay) transition-transform duration-(--duration-250) ease-(--ease-out) ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {renderExpandedContent()}
      </aside>

      {/* 3. Desktop Docked Left Sidebar (Persistent on authenticated pages) */}
      <aside
        aria-label={isCollapsed ? 'Main Navigation Sidebar, collapsed' : 'Main Navigation Sidebar'}
        style={{ width: isCollapsed ? 72 : 256 }}
        className="hidden md:flex flex-col shrink-0 border-r border-border-subtle bg-surface-page min-h-screen sticky top-0 transition-all duration-200"
      >
        {isCollapsed ? renderCollapsedContent() : renderExpandedContent()}
      </aside>
    </>
  );
}
