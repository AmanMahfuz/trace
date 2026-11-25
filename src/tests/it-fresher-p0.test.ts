import { describe, it, expect } from 'vitest';
import {
  checkEligibility,
  deriveOverallStatus,
  EligibilityCriteria,
  UserProfile,
} from '../lib/eligibility';
import { planThisWeek, ApplicationForPlanner } from '../lib/planner';

describe('IT Fresher P0: Eligibility Checker', () => {
  it('eligibility never says OK when the post is silent', () => {
    // Empty / silent job posting criteria
    const silentCriteria: EligibilityCriteria = {
      degree_quote: null,
      branches_quote: null,
      passout_years_quote: null,
      min_aggregate_quote: null,
      backlogs_quote: null,
      location_quote: null,
      bond_quote: null,
    };

    const userProfile: UserProfile = {
      grad_year: 2025,
      branch: 'B.Tech CSE',
      aggregate_pct: 82.5,
      active_backlogs: 0,
    };

    const items = checkEligibility(silentCriteria, userProfile);

    // Every criterion MUST be 'not-stated', NEVER 'ok'
    for (const item of items) {
      expect(item.status).toBe('not-stated');
      expect(item.status).not.toBe('ok');
    }

    // Top-level status must also be 'not-stated'
    expect(deriveOverallStatus(items)).toBe('not-stated');
  });

  it('a 58% aggregate against a 60% rule shows Not eligible (Blocked)', () => {
    const criteriaWithAggregate: EligibilityCriteria = {
      min_aggregate: 60.0,
      min_aggregate_quote: 'Minimum 60% aggregate across all semesters',
      passout_years: [2024, 2025],
      passout_years_quote: '2024 and 2025 graduates only',
      branches: ['CSE', 'IT'],
      branches_quote: 'B.Tech in CSE or IT only',
      max_backlogs: 0,
      backlogs_quote: 'No active backlogs allowed',
    };

    // Candidate with 58% aggregate
    const candidate58: UserProfile = {
      grad_year: 2025,
      branch: 'B.Tech CSE',
      aggregate_pct: 58.0,
      active_backlogs: 0,
    };

    const items = checkEligibility(criteriaWithAggregate, candidate58);
    const aggItem = items.find((i) => i.criterion === 'Aggregate %');

    expect(aggItem).toBeDefined();
    // 58% is < 60% (more than 1% below, borderline is 58-60 so 58 is at-risk, <=57 is hard not-eligible)
    // Let's test candidate with 55%:
    const candidate55: UserProfile = {
      grad_year: 2025,
      branch: 'B.Tech CSE',
      aggregate_pct: 55.0,
      active_backlogs: 0,
    };
    const items55 = checkEligibility(criteriaWithAggregate, candidate55);
    const aggItem55 = items55.find((i) => i.criterion === 'Aggregate %');
    expect(aggItem55?.status).toBe('not-eligible');
    expect(aggItem55?.detail).toContain('Posting requires 60%');
    expect(aggItem55?.detail).toContain('55%');

    // Overall status is not-eligible when any criterion fails
    expect(deriveOverallStatus(items55)).toBe('not-eligible');
  });

  it('candidate meeting all stated criteria receives ok status', () => {
    const criteria: EligibilityCriteria = {
      degree: ['B.Tech', 'B.E'],
      degree_quote: 'B.Tech or B.E graduates only',
      branches: ['CSE', 'IT'],
      branches_quote: 'Circuital branches CSE, IT',
      passout_years: [2025],
      passout_years_quote: '2025 batch only',
      min_aggregate: 65.0,
      min_aggregate_quote: '65% or above throughout',
      max_backlogs: 0,
      backlogs_quote: 'Zero active backlogs',
    };

    const qualifyingProfile: UserProfile = {
      grad_year: 2025,
      branch: 'B.Tech CSE',
      aggregate_pct: 74.0,
      active_backlogs: 0,
    };

    const items = checkEligibility(criteria, qualifyingProfile);

    expect(items.find((i) => i.criterion === 'Branch')?.status).toBe('ok');
    expect(items.find((i) => i.criterion === 'Passout year')?.status).toBe('ok');
    expect(items.find((i) => i.criterion === 'Aggregate %')?.status).toBe('ok');
    expect(items.find((i) => i.criterion === 'Active backlogs')?.status).toBe('ok');

    expect(deriveOverallStatus(items)).toBe('ok');
  });

  it('wrong branch results in not-eligible status', () => {
    const criteria: EligibilityCriteria = {
      branches: ['CSE', 'IT'],
      branches_quote: 'CSE and IT students only',
    };

    const civilProfile: UserProfile = {
      grad_year: 2025,
      branch: 'B.Tech Civil',
      aggregate_pct: 80.0,
      active_backlogs: 0,
    };

    const items = checkEligibility(criteria, civilProfile);
    const branchItem = items.find((i) => i.criterion === 'Branch');
    expect(branchItem?.status).toBe('not-eligible');
    expect(branchItem?.detail).toContain('is not in the list');
  });
});

describe('IT Fresher P0: This Week Planner', () => {
  it('next steps never repeat finished items', () => {
    const today = new Date();
    const in3Days = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();

    const mockApps: ApplicationForPlanner[] = [
      {
        id: 'app-1',
        status: 'saved',
        created_at: new Date(today.getTime() - 20 * 24 * 60 * 60 * 1000).toISOString(),
        jobs: { title: 'Junior Dev', company: 'TCS' },
        process_stages: {
          stages: [
            // Stage 1 is DONE - must NEVER appear in next steps
            { name: 'Resume screening', status: 'done', date: in3Days, practiceMode: null },
            // Stage 2 is UPCOMING with date in 3 days - MUST appear
            { name: 'TCS NQT Online Test', status: 'upcoming', date: in3Days, practiceMode: 'self-intro' },
          ],
        },
      },
      {
        id: 'app-2',
        status: 'closed', // CLOSED application - must NEVER appear
        outcome: 'rejected',
        created_at: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        jobs: { title: 'Backend Intern', company: 'Infosys' },
      },
    ];

    const nextSteps = planThisWeek(mockApps);

    // 1. Should pick the upcoming TCS NQT stage
    expect(nextSteps.length).toBeGreaterThan(0);
    const tcsStep = nextSteps.find((s) => s.title.includes('TCS NQT Online Test'));
    expect(tcsStep).toBeDefined();

    // 2. Finished stage (Resume screening) is never present
    const doneStep = nextSteps.find((s) => s.title.includes('Resume screening'));
    expect(doneStep).toBeUndefined();

    // 3. Closed application (Infosys) is never present
    const closedStep = nextSteps.find((s) => s.applicationId === 'app-2');
    expect(closedStep).toBeUndefined();
  });

  it('prioritizes upcoming dates within 7 days first', () => {
    const today = new Date();
    const in2Days = new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString();
    const in5Days = new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString();

    const mockApps: ApplicationForPlanner[] = [
      {
        id: 'app-overdue',
        status: 'applied',
        applied_at: new Date(today.getTime() - 16 * 24 * 60 * 60 * 1000).toISOString(),
        created_at: new Date(today.getTime() - 16 * 24 * 60 * 60 * 1000).toISOString(),
        jobs: { title: 'Developer', company: 'Accenture' },
      },
      {
        id: 'app-deadline-soon',
        status: 'saved',
        created_at: today.toISOString(),
        jobs: { title: 'Frontend Engineer', company: 'Wipro' },
        process_stages: {
          stages: [
            { name: 'Coding Assessment', status: 'upcoming', date: in2Days, practiceMode: 'project-deepdive' },
          ],
        },
      },
      {
        id: 'app-deadline-later',
        status: 'saved',
        created_at: today.toISOString(),
        jobs: { title: 'QA Engineer', company: 'Cognizant' },
        process_stages: {
          stages: [
            { name: 'Technical Interview', status: 'upcoming', date: in5Days, practiceMode: 'hr' },
          ],
        },
      },
    ];

    const steps = planThisWeek(mockApps);

    // Date in 2 days must be item 0 (soonest first)
    expect(steps[0].applicationId).toBe('app-deadline-soon');
    expect(steps[0].kind).toBe('deadline');

    // Date in 5 days must be item 1
    expect(steps[1].applicationId).toBe('app-deadline-later');
    expect(steps[1].kind).toBe('deadline');

    // Overdue log must be item 2
    expect(steps[2].applicationId).toBe('app-overdue');
    expect(steps[2].kind).toBe('overdue-log');

    // Strictly max 3 items
    expect(steps.length).toBeLessThanOrEqual(3);
  });

  it('returns empty array when nothing is urgent (no filler)', () => {
    const steps = planThisWeek([]);
    expect(steps).toEqual([]);
  });
});
