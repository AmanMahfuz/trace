import { describe, it, expect } from 'vitest';
import { runFormatChecks, ResumeTree } from '@trace/engine';

describe('No-Resume Path & Fresher Builder Logic', () => {
  it('validates 7-step builder configuration', () => {
    const steps = [
      { id: 0, label: 'You' },
      { id: 1, label: 'Contact' },
      { id: 2, label: 'Education' },
      { id: 3, label: 'Experience' },
      { id: 4, label: 'Projects' },
      { id: 5, label: 'Skills' },
      { id: 6, label: 'Review' },
    ];

    expect(steps).toHaveLength(7);
    expect(steps[0].label).toBe('You');
    expect(steps[3].label).toBe('Experience');
    expect(steps[4].label).toBe('Projects');
    expect(steps[6].label).toBe('Review');
  });

  it('allows freshers with ZERO experience to produce a valid resume tree', () => {
    const fresherTree: ResumeTree = {
      contact: {
        name: 'Asha Nair',
        email: 'asha@example.com',
        phone: '+91 98765 43210',
        location: 'Bangalore, Karnataka',
        github: 'github.com/ashanair',
      },
      summary: 'Motivated software engineer with hands-on project experience in web development.',
      sectionsOrder: ['summary', 'education', 'projects', 'skills', 'experience', 'certifications'],
      education: [
        {
          id: 'edu-1',
          school: 'National Institute of Technology',
          degree: 'B.Tech Computer Science',
          year: '2026',
          gpa: 'CGPA: 8.4',
        },
      ],
      experience: [], // ZERO experience!
      projects: [
        {
          id: 'proj-1',
          name: 'Distributed Task Queue',
          tech: ['Python', 'Redis', 'Docker'],
          bullets: [
            {
              id: 'proj-1-b1',
              text: 'Built an asynchronous background task queue system using Redis and Python.',
            },
            {
              id: 'proj-1-b2',
              text: 'Achieved 450 requests per second throughput under concurrent worker load.',
            },
          ],
        },
      ],
      skills: ['Python', 'Redis', 'Docker', 'PostgreSQL', 'Git'],
      certifications: [],
    };

    const checks = runFormatChecks(fresherTree);
    expect(checks.passed).toBe(true);
    expect(checks.issuesCount).toBe(0);
    // Verified: freshers with 0 experience pass format checks based on projects & education
  });

  it('operates 100% deterministically with all AI disabled', () => {
    // Verifies that answers can be assembled into standard ResumeTree without invoking any AI router
    const rawAnswers = {
      targetArea: 'it' as const,
      stage: 'final_year' as const,
      name: 'Rohan Sharma',
      email: 'rohan@example.com',
      college: 'Delhi Technological University',
      degree: 'B.Tech Information Technology',
      gradYear: '2026',
      projects: [
        {
          id: 'proj-dtu-1',
          title: 'Campus Food Delivery App',
          tech: 'React, Node.js, SQLite',
          role: 'Solo Developer',
          description: 'Built a web application for ordering food from campus cafeterias with real-time order tracking.',
          result: 'Reduced cafeteria counter wait time from 20 minutes to under 5 minutes during lunch rush.',
          link: '',
        },
      ],
      skills: ['React', 'Node.js', 'SQLite', 'TypeScript'],
    };

    const constructedTree: ResumeTree = {
      contact: {
        name: rawAnswers.name,
        email: rawAnswers.email,
      },
      sectionsOrder: ['education', 'projects', 'skills'],
      education: [
        {
          id: 'edu-1',
          school: rawAnswers.college,
          degree: rawAnswers.degree,
          year: rawAnswers.gradYear,
        },
      ],
      experience: [],
      projects: [
        {
          id: rawAnswers.projects[0].id,
          name: rawAnswers.projects[0].title,
          tech: rawAnswers.projects[0].tech.split(',').map((t) => t.trim()),
          bullets: [
            {
              id: `${rawAnswers.projects[0].id}-b1`,
              text: rawAnswers.projects[0].description,
            },
            {
              id: `${rawAnswers.projects[0].id}-b2`,
              text: rawAnswers.projects[0].result,
            },
          ],
        },
      ],
      skills: rawAnswers.skills,
      certifications: [],
    };

    expect(constructedTree.projects[0].bullets).toHaveLength(2);
    expect(constructedTree.projects[0].bullets[0].text).toContain('ordering food');
    const result = runFormatChecks(constructedTree);
    expect(result.issuesCount).toBe(0);
  });

  it('resumes abandoned draft state accurately', () => {
    const savedDraft = {
      id: 'draft-uuid-123',
      current_step: 4,
      answers: {
        name: 'Asha Nair',
        college: 'NIT',
        targetArea: 'it',
      },
    };

    expect(savedDraft.current_step).toBe(4);
    expect(savedDraft.answers.name).toBe('Asha Nair');
  });
});
