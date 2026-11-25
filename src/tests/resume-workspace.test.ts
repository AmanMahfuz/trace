import { describe, it, expect } from 'vitest';
import { normalizeToResumeTree, computeContentHash, runFormatChecks } from '@trace/engine';

describe('Resume Workspace Pure Logic', () => {
  it('normalizes arbitrary parsed JSON into a standard ResumeTree', () => {
    const rawParsed = {
      contact: {
        name: 'Alex Morgan',
        email: 'alex@example.com',
        phone: '+1 555-0199',
        location: 'San Francisco, CA',
        github: 'https://github.com/alexm',
      },
      summary: 'Passionate backend developer with 1 year experience building REST APIs.',
      experience: [
        {
          id: 'exp-1',
          company: 'Acme Corp',
          title: 'Junior Software Engineer',
          startDate: '2025-01',
          endDate: 'Present',
          bullets: [
            'Built real-time order processing pipeline handling 10k events/sec with Kafka.',
            'Refactored Postgres query indexes, reducing p95 latency from 450ms to 95ms.',
          ],
        },
      ],
      education: [
        {
          id: 'edu-1',
          school: 'State University',
          degree: 'B.S. in Computer Science',
          year: '2024',
        },
      ],
      skills: ['TypeScript', 'Go', 'PostgreSQL', 'Docker'],
    };

    const tree = normalizeToResumeTree(rawParsed);
    expect(tree.contact.name).toBe('Alex Morgan');
    expect(tree.contact.email).toBe('alex@example.com');
    expect(tree.experience.length).toBe(1);
    expect(tree.experience[0].bullets.length).toBe(2);
    expect(tree.experience[0].bullets[0].id).toBeDefined();
    expect(tree.skills).toContain('TypeScript');

    const hash = computeContentHash(tree);
    expect(typeof hash).toBe('string');
    expect(hash.length).toBeGreaterThan(0);
  });

  it('runs format checks and returns structured issues and opportunities', () => {
    const tree = normalizeToResumeTree({
      contact: { name: 'Incomplete Candidate' },
      experience: [],
    });

    const result = runFormatChecks(tree);
    expect(result.passed).toBe(false);
    expect(result.issuesCount).toBeGreaterThan(0);

    const contactCheck = result.checks.find((c) => c.id === 'contact_essential');
    expect(contactCheck).toBeDefined();
    expect(contactCheck?.level).toBe('issue');
  });

  it('flags metrics as opportunities rather than blocking errors', () => {
    const tree = normalizeToResumeTree({
      contact: {
        name: 'Alex Morgan',
        email: 'alex@example.com',
        phone: '1234567890',
        location: 'Bengaluru',
      },
      experience: [
        {
          id: 'exp-1',
          company: 'Tech Co',
          title: 'Developer',
          startDate: '2025-01',
          endDate: 'Present',
          bullets: [{ id: 'b1', text: 'Developed backend modules for customer portal.' }],
        },
      ],
      education: [{ id: 'ed1', school: 'Tech College', degree: 'B.Tech' }],
      skills: ['Python', 'SQL'],
    });

    const result = runFormatChecks(tree);
    const metricCheck = result.checks.find((c) => c.id === 'metrics_opportunity');
    expect(metricCheck).toBeDefined();
    expect(metricCheck?.level).toBe('opportunity');
  });
});
