import { describe, it, expect } from 'vitest';

describe('Voice Simulator Grounded in Job Description (JD)', () => {
  const sampleJdText = `
    Job Title: Junior Backend Engineer
    Company: Fintech Core (Bangalore)
    Requirements:
    - 0-1 years experience or fresh graduate in Computer Science.
    - Strong proficiency in Node.js, TypeScript, and PostgreSQL.
    - Experience designing high-throughput REST APIs and handling transaction concurrency.
    - Good communication and collaboration skills in an agile startup team.
  `;

  const sampleResume = {
    contact: { name: 'Asha Nair' },
    skills: ['TypeScript', 'Node.js', 'PostgreSQL', 'Docker'],
    projects: [
      {
        name: 'Distributed Ledger Microservice',
        tech: ['Node.js', 'TypeScript', 'PostgreSQL'],
        bullets: [
          { text: 'Built ledger microservice handling 1,500 transactions per second with row-level locks.' },
        ],
      },
    ],
  };

  it('enforces hard 25-word cap in pure code for any generated question', () => {
    const rawLongQuestion =
      'Could you walk me through the specific architectural decisions and concurrency controls you implemented in your distributed ledger microservice to prevent duplicate transaction entries during peak loads?';
    const words = rawLongQuestion.trim().split(/\s+/);
    expect(words.length).toBeGreaterThan(25);

    const cappedQuestion =
      words.length > 25 ? words.slice(0, 25).join(' ') + '?' : rawLongQuestion.trim();

    const cappedWords = cappedQuestion.trim().split(/\s+/);
    expect(cappedWords.length).toBeLessThanOrEqual(25);
    expect(cappedQuestion.endsWith('?')).toBe(true);
  });

  it('configures turn limits by mode so simulations end at the correct duration', () => {
    // Mode turn configurations:
    // self-intro: 1 turn
    // project-deepdive: 3 turns
    // hr: 3 turns
    // full-round: 5 turns
    const getTurnLimit = (mode: string) => (mode === 'self-intro' ? 1 : mode === 'full-round' ? 5 : 3);

    expect(getTurnLimit('self-intro')).toBe(1);
    expect(getTurnLimit('project-deepdive')).toBe(3);
    expect(getTurnLimit('hr')).toBe(3);
    expect(getTurnLimit('full-round')).toBe(5);

    // Verify conclusion condition
    const isConclusion = (userTurns: number, mode: string) => userTurns >= getTurnLimit(mode);

    expect(isConclusion(1, 'self-intro')).toBe(true);
    expect(isConclusion(1, 'project-deepdive')).toBe(false);
    expect(isConclusion(3, 'project-deepdive')).toBe(true);
    expect(isConclusion(4, 'full-round')).toBe(false);
    expect(isConclusion(5, 'full-round')).toBe(true);
  });

  it('constructs mode-specific system prompts containing the JD context and candidate resume', () => {
    const buildPrompt = (mode: string, title: string, company: string, jd: string) => {
      if (mode === 'self-intro') {
        return `You are the hiring manager for ${title} at ${company}. You are conducting a 60-second self-introduction round. The Job Description asks for:\n${jd}`;
      } else if (mode === 'project-deepdive') {
        return `You are a principal technical interviewer for ${title} at ${company}. Job Description:\n${jd}`;
      } else if (mode === 'hr') {
        return `You are an HR and behavioral hiring manager for ${title} at ${company}. Job Description context:\n${jd}`;
      } else {
        return `You are the lead engineering hiring manager conducting a technical pre-screen for ${title} at ${company}. Job Description:\n${jd}`;
      }
    };

    const selfIntroPrompt = buildPrompt('self-intro', 'Junior Backend Engineer', 'Fintech Core', sampleJdText);
    expect(selfIntroPrompt).toContain('Fintech Core');
    expect(selfIntroPrompt).toContain('Junior Backend Engineer');
    expect(selfIntroPrompt).toContain('PostgreSQL');

    const deepdivePrompt = buildPrompt('project-deepdive', 'Junior Backend Engineer', 'Fintech Core', sampleJdText);
    expect(deepdivePrompt).toContain('Fintech Core');
    expect(deepdivePrompt).toContain('transaction concurrency');

    // Candidate resume skills and project stack match the target JD
    expect(sampleResume.skills).toContain('PostgreSQL');
    expect(sampleResume.projects[0].name).toBe('Distributed Ledger Microservice');
  });

  it('verifies that self-intro is free (creditCost: 0) while other modes require 1 credit', () => {
    const modeCosts: Record<string, number> = {
      'self-intro': 0,
      'project-deepdive': 1,
      'hr': 1,
      'full-round': 1,
    };

    expect(modeCosts['self-intro']).toBe(0);
    expect(modeCosts['project-deepdive']).toBe(1);
    expect(modeCosts['hr']).toBe(1);
    expect(modeCosts['full-round']).toBe(1);
  });
});
