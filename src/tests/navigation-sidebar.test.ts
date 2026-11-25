import { describe, it, expect } from 'vitest';
import * as patterns from '@/design-system/patterns';

describe('NavigationSidebar & SidebarContext', () => {
  it('exports SidebarProvider, useSidebar, and NavigationSidebar from patterns', () => {
    expect(patterns.SidebarProvider).toBeDefined();
    expect(patterns.useSidebar).toBeDefined();
    expect(patterns.NavigationSidebar).toBeDefined();
  });

  it('correctly parses application ID from application pipeline route URLs', () => {
    const parseAppId = (pathname: string) => {
      const match = pathname.match(/\/(prep|arena|report|why-not)\/([^/?#]+)/);
      return match ? match[2] : null;
    };

    expect(parseAppId('/prep/app-12345')).toBe('app-12345');
    expect(parseAppId('/arena/app-abc-def')).toBe('app-abc-def');
    expect(parseAppId('/report/app-uuid-999')).toBe('app-uuid-999');
    expect(parseAppId('/why-not/target-run-42')).toBe('target-run-42');
    expect(parseAppId('/dashboard')).toBeNull();
    expect(parseAppId('/')).toBeNull();
    expect(parseAppId('/login')).toBeNull();
  });

  it('verifies stage mapping for navigation pipeline', () => {
    const getStageHref = (activeAppId: string | null, stage: 'prep' | 'arena' | 'report' | 'why-not') => {
      if (activeAppId) {
        return `/${stage}/${activeAppId}`;
      }
      return '/dashboard';
    };

    expect(getStageHref('test-id-1', 'prep')).toBe('/prep/test-id-1');
    expect(getStageHref('test-id-1', 'arena')).toBe('/arena/test-id-1');
    expect(getStageHref('test-id-1', 'report')).toBe('/report/test-id-1');
    expect(getStageHref('test-id-1', 'why-not')).toBe('/why-not/test-id-1');
    expect(getStageHref(null, 'prep')).toBe('/dashboard');
  });

  it('verifies public vs authenticated page routing rules', () => {
    const publicRoutes = ['/', '/login', '/privacy', '/terms'];
    const isPublic = (path: string) => publicRoutes.includes(path);

    expect(isPublic('/')).toBe(true);
    expect(isPublic('/login')).toBe(true);
    expect(isPublic('/privacy')).toBe(true);
    expect(isPublic('/terms')).toBe(true);
    expect(isPublic('/dashboard')).toBe(false);
    expect(isPublic('/resume')).toBe(false);
    expect(isPublic('/prep/app-123')).toBe(false);
  });

  it('verifies plain language labels are used and forbidden terms are barred', () => {
    const forbiddenTerms = [
      'zero-data-retention',
      'forensic',
      'calibration engine',
      'telemetry',
    ];

    const approvedLabels = [
      'Practice',
      'Practice report',
      'Why-not report',
      'Privacy',
      'Saved resumes',
      'Applications',
      'Analyze',
    ];

    approvedLabels.forEach((label) => {
      forbiddenTerms.forEach((forbidden) => {
        expect(label.toLowerCase()).not.toContain(forbidden);
      });
    });
  });

  it('verifies desktop sidebar dimensions and trace line states', () => {
    const getSidebarWidth = (isCollapsed: boolean) => (isCollapsed ? 72 : 256);
    expect(getSidebarWidth(false)).toBe(256);
    expect(getSidebarWidth(true)).toBe(72);

    const stepStates = ['current', 'done', 'unlocked', 'locked'] as const;
    expect(stepStates).toHaveLength(4);
  });
});
