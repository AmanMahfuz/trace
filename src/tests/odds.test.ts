import { describe, it, expect } from 'vitest';
import {
  computeOdds,
  computeSkillCoverage,
  computeProofStrength,
  computeLevelFit,
  computeApplicationQuality,
  verifyRequirementQuotes,
  JobRequirementItem,
} from '../lib/odds';
import { Resume } from '../lib/schemas';

describe('Honest Odds Calculation and Boundaries', () => {
  const makeFactors = (scores: [number, number, number, number, number]) => ({
    skill_coverage: { score: scores[0], evidence: 'skill' },
    proof_strength: { score: scores[1], evidence: 'proof' },
    level_fit: { score: scores[2], evidence: 'level' },
    domain_relevance: { score: scores[3], evidence: 'domain' },
    application_quality: { score: scores[4], evidence: 'quality' },
  });

  it('computes exact weighting: skill*0.30 + proof*0.20 + level*0.20 + domain*0.15 + application*0.15', () => {
    // 100*0.30 + 50*0.20 + 50*0.20 + 50*0.15 + 50*0.15 = 30 + 10 + 10 + 7.5 + 7.5 = 65
    const factors = makeFactors([100, 50, 50, 50, 50]);
    const res = computeOdds(factors, ['gap1'], 'one change', 'High');
    expect(res.weighted_score).toBe(65);
    expect(res.band).toBe('Strong');
  });

  it('tests boundary at 34 (Long shot) vs 35 (Fair)', () => {
    const factors34 = makeFactors([34, 34, 34, 34, 34]);
    const res34 = computeOdds(factors34, [], '', 'Medium');
    expect(res34.weighted_score).toBe(34);
    expect(res34.band).toBe('Long shot');

    const factors35 = makeFactors([35, 35, 35, 35, 35]);
    const res35 = computeOdds(factors35, [], '', 'Medium');
    expect(res35.weighted_score).toBe(35);
    expect(res35.band).toBe('Fair');
  });

  it('tests boundary at 64 (Fair) vs 65 (Strong)', () => {
    const factors64 = makeFactors([64, 64, 64, 64, 64]);
    const res64 = computeOdds(factors64, [], '', 'High');
    expect(res64.weighted_score).toBe(64);
    expect(res64.band).toBe('Fair');

    const factors65 = makeFactors([65, 65, 65, 65, 65]);
    const res65 = computeOdds(factors65, [], '', 'High');
    expect(res65.weighted_score).toBe(65);
    expect(res65.band).toBe('Strong');
  });
});

describe('Three-Fixture Calibration Tests (Strong, Average, Weak)', () => {
  const targetJobRequirements: JobRequirementItem[] = [
    { requirement: 'TypeScript', type: 'must', jd_quote: 'Strong TS', status: 'met', resume_quote: 'TypeScript' },
    { requirement: 'React', type: 'must', jd_quote: 'React frontend', status: 'met', resume_quote: 'React components' },
    { requirement: 'PostgreSQL', type: 'must', jd_quote: 'Relational DB', status: 'met', resume_quote: 'PostgreSQL queries' },
    { requirement: 'Docker', type: 'nice', jd_quote: 'Containerization', status: 'missing' },
    { requirement: 'CI/CD deployment', type: 'nice', jd_quote: 'Modern deployment', status: 'missing' },
  ];

  const strongResume: Resume = {
    contact: {
      name: 'Sarah Connor',
      email: 'sarah@mit.edu',
      links: ['https://github.com/sarahc', 'https://sarah.dev'],
    },
    experience: [
      {
        id: '11111111-1111-4111-8111-111111111111',
        company: 'Stripe',
        title: 'Software Engineer Intern',
        bullets: [
          {
            id: '11111111-1111-4111-8111-111111111112',
            text: 'Engineered high-throughput TypeScript checkout microservice reducing API latency by 35%.',
          },
          {
            id: '11111111-1111-4111-8111-111111111113',
            text: 'Architected PostgreSQL database partitioning strategy handling 250k daily transactions.',
          },
        ],
      },
      {
        id: '11111111-1111-4111-8111-111111111114',
        company: 'Vercel',
        title: 'Frontend Intern',
        bullets: [
          {
            id: '11111111-1111-4111-8111-111111111115',
            text: 'Built React design system components used by 15,000 developers worldwide.',
          },
        ],
      },
    ],
    projects: [
      {
        id: '11111111-1111-4111-8111-111111111116',
        name: 'OpenMetrics',
        tech: ['TypeScript', 'Next.js', 'PostgreSQL'],
        bullets: [
          {
            id: '11111111-1111-4111-8111-111111111117',
            text: 'Deployed live production analytics app at https://openmetrics.dev with 1,200 active users.',
          },
        ],
      },
    ],
    education: [
      {
        id: '11111111-1111-4111-8111-111111111118',
        school: 'MIT',
        degree: 'B.S. Computer Science',
      },
    ],
    skills: ['TypeScript', 'React', 'Node.js', 'PostgreSQL', 'Docker'],
    certifications: [],
  };

  const averageResume: Resume = {
    contact: {
      name: 'Alex Chen',
      email: 'alex@state.edu',
      links: [],
    },
    experience: [
      {
        id: '22222222-2222-4222-8222-222222222221',
        company: 'Campus IT',
        title: 'Student Web Assistant',
        bullets: [
          {
            id: '22222222-2222-4222-8222-222222222222',
            text: 'Built student portal components using React and HTML/CSS.',
          },
          {
            id: '22222222-2222-4222-8222-222222222223',
            text: 'Assisted senior developer with MySQL database schema updates.',
          },
        ],
      },
    ],
    projects: [
      {
        id: '22222222-2222-4222-8222-222222222224',
        name: 'Todo App',
        tech: ['JavaScript', 'React'],
        bullets: [
          {
            id: '22222222-2222-4222-8222-222222222225',
            text: 'Created responsive task manager in React with local storage persistence.',
          },
        ],
      },
    ],
    education: [
      {
        id: '22222222-2222-4222-8222-222222222226',
        school: 'State University',
        degree: 'B.Tech IT',
      },
    ],
    skills: ['JavaScript', 'React', 'HTML', 'CSS', 'MySQL'],
    certifications: [],
  };

  const weakResume: Resume = {
    contact: {
      name: 'Jordan Smith',
      email: 'jordan@gmail.com',
      links: [],
    },
    experience: [],
    projects: [
      {
        id: '33333333-3333-4333-8333-333333333331',
        name: 'Coursework Simulation',
        tech: ['Python'],
        bullets: [
          {
            id: '33333333-3333-4333-8333-333333333332',
            text: 'Calculated basic statistical models in Python for academic class.',
          },
        ],
      },
    ],
    education: [
      {
        id: '33333333-3333-4333-8333-333333333333',
        school: 'Community College',
        degree: 'General Studies',
      },
    ],
    skills: ['Python', 'Excel', 'Word'],
    certifications: [],
  };

  it('asserts that Strong, Average, and Weak candidates land in three distinct bands for the same job', () => {
    // 1. Strong Candidate
    const strongSkills = computeSkillCoverage(targetJobRequirements); // 6/8 = 75%
    const strongProof = computeProofStrength(strongResume);
    const strongLevel = computeLevelFit(strongResume, 0, true);
    const strongDomain = { score: 90, evidence: 'Direct web SaaS experience' };
    const strongQuality = computeApplicationQuality(strongResume);

    const strongOdds = computeOdds(
      {
        skill_coverage: strongSkills,
        proof_strength: strongProof,
        level_fit: strongLevel,
        domain_relevance: strongDomain,
        application_quality: strongQuality,
      },
      ['Docker'],
      'Deploy Docker container',
      'High'
    );

    // 2. Average Fresher (1 small internship, 1 basic project, no metrics/links)
    const avgReqs: JobRequirementItem[] = [
      { requirement: 'TypeScript', type: 'must', jd_quote: 'TS', status: 'partial' },
      { requirement: 'React', type: 'must', jd_quote: 'React', status: 'met', resume_quote: 'React' },
      { requirement: 'PostgreSQL', type: 'must', jd_quote: 'PostgreSQL', status: 'partial' }, // MySQL partial
      { requirement: 'Docker', type: 'nice', jd_quote: 'Docker', status: 'missing' },
      { requirement: 'CI/CD', type: 'nice', jd_quote: 'CI/CD', status: 'missing' },
    ];
    const avgSkills = computeSkillCoverage(avgReqs);
    const avgProof = computeProofStrength(averageResume); // capped at 50 because no metrics/links
    const avgLevel = computeLevelFit(averageResume, 0, true);
    const avgDomain = { score: 30, evidence: 'Campus IT student assistant only' };
    const avgQuality = computeApplicationQuality(averageResume);

    const avgOdds = computeOdds(
      {
        skill_coverage: avgSkills,
        proof_strength: avgProof,
        level_fit: avgLevel,
        domain_relevance: avgDomain,
        application_quality: avgQuality,
      },
      ['TypeScript production evidence', 'Verifiable links'],
      'Add live project demo link',
      'Medium'
    );

    // 3. Weak / Unrelated Candidate
    const weakReqs: JobRequirementItem[] = [
      { requirement: 'TypeScript', type: 'must', jd_quote: 'TS', status: 'missing' },
      { requirement: 'React', type: 'must', jd_quote: 'React', status: 'missing' },
      { requirement: 'PostgreSQL', type: 'must', jd_quote: 'PostgreSQL', status: 'missing' },
      { requirement: 'Docker', type: 'nice', jd_quote: 'Docker', status: 'missing' },
      { requirement: 'CI/CD', type: 'nice', jd_quote: 'CI/CD', status: 'missing' },
    ];
    const weakSkills = computeSkillCoverage(weakReqs); // 0%
    const weakProof = computeProofStrength(weakResume); // ~30%
    const weakLevel = computeLevelFit(weakResume, 1, false);
    const weakDomain = { score: 10, evidence: 'Unrelated Python stats' };
    const weakQuality = computeApplicationQuality(weakResume);

    const weakOdds = computeOdds(
      {
        skill_coverage: weakSkills,
        proof_strength: weakProof,
        level_fit: weakLevel,
        domain_relevance: weakDomain,
        application_quality: weakQuality,
      },
      ['All core requirements missing'],
      'Build a fullstack web project from scratch',
      'Low'
    );

    // Verify Three Distinct Bands
    expect(strongOdds.band).toBe('Strong');
    expect(avgOdds.band).toBe('Fair');
    expect(weakOdds.band).toBe('Long shot');

    // Assert that scores properly stratify
    expect(strongOdds.weighted_score).toBeGreaterThanOrEqual(65);
    expect(avgOdds.weighted_score).toBeGreaterThanOrEqual(35);
    expect(avgOdds.weighted_score).toBeLessThan(65);
    expect(weakOdds.weighted_score).toBeLessThan(35);

    // Assert proof capping worked on average resume (no metrics/links)
    expect(avgProof.score).toBeLessThanOrEqual(60);
  });
});

describe('Odds Hardening Suite', () => {
  const sampleResume: Resume = {
    contact: {
      name: 'Taylor Swift',
      email: 'taylor@example.com',
      links: ['https://github.com/taylor'],
    },
    skills: ['TypeScript', 'React', 'Docker'],
    experience: [
      {
        id: 'exp-1',
        company: 'Acme Corp',
        title: 'Intern',
        bullets: [
          {
            id: 'b-1',
            text: 'Engineered high-throughput TypeScript checkout microservice reducing latency by 35%.',
          },
        ],
      },
    ],
    projects: [
      {
        id: 'proj-1',
        name: 'Portfolio',
        tech: ['React'],
        bullets: [
          {
            id: 'b-2',
            text: 'Built responsive web application deployed at https://taylor.dev',
          },
        ],
      },
    ],
    education: [],
    certifications: [],
  };

  describe('1. verifyRequirementQuotes', () => {
    it('preserves status "met" when quote appears in resume text', () => {
      const reqs: JobRequirementItem[] = [
        {
          requirement: 'TypeScript',
          type: 'must',
          jd_quote: 'Strong TS',
          status: 'met',
          resume_quote: 'TypeScript checkout microservice',
        },
      ];
      const verified = verifyRequirementQuotes(reqs, sampleResume);
      expect(verified[0].status).toBe('met');
      expect(verified[0].resume_quote).toBe('TypeScript checkout microservice');
    });

    it('downgrades "met" to "partial" if quote is missing but skill is in resume.skills', () => {
      const reqs: JobRequirementItem[] = [
        {
          requirement: 'Docker',
          type: 'must',
          jd_quote: 'Docker containerization',
          status: 'met',
          resume_quote: 'Fabricated containerized quote not in resume',
        },
      ];
      const verified = verifyRequirementQuotes(reqs, sampleResume);
      expect(verified[0].status).toBe('partial');
      expect(verified[0].resume_quote).toBeUndefined();
    });

    it('downgrades "met" to "missing" if quote is missing and skill is NOT in resume', () => {
      const reqs: JobRequirementItem[] = [
        {
          requirement: 'Kubernetes',
          type: 'must',
          jd_quote: 'K8s orchestration',
          status: 'met',
          resume_quote: 'Fabricated k8s cluster setup',
        },
      ];
      const verified = verifyRequirementQuotes(reqs, sampleResume);
      expect(verified[0].status).toBe('missing');
      expect(verified[0].resume_quote).toBeUndefined();
    });
  });

  describe('2. level_fit for fresher roles', () => {
    it('scores 95 for candidate with 0 experience when role is fresher-friendly', () => {
      const fresherNoExp: Resume = {
        contact: { name: 'Fresher' },
        skills: ['Python'],
        experience: [],
        projects: [],
        education: [],
        certifications: [],
      };
      const fit1 = computeLevelFit(fresherNoExp, 0, false);
      expect(fit1.score).toBe(95);

      const fit2 = computeLevelFit(fresherNoExp, 1, true);
      expect(fit2.score).toBe(95);
    });

    it('penalizes when role strictly mandates 3+ years experience', () => {
      const fresherNoExp: Resume = {
        contact: { name: 'Fresher' },
        skills: ['Python'],
        experience: [],
        projects: [],
        education: [],
        certifications: [],
      };
      const fit = computeLevelFit(fresherNoExp, 3, false);
      expect(fit.score).toBe(20);
    });
  });

  describe('3. application_quality (no keyword overlap)', () => {
    it('grades solely on contact, verbs, and bullet depth', () => {
      const quality = computeApplicationQuality(sampleResume);
      expect(quality.score).toBeGreaterThanOrEqual(60);
      expect(quality.evidence).toContain('Application presentation scored');
      expect(quality.evidence).not.toContain('keyword');
    });
  });

  describe('5. Borderline Fixtures Calibration', () => {
    // Borderline A: 1 internship + deployed project with NO metrics
    const borderlineInternshipNoMetrics: Resume = {
      contact: {
        name: 'Jordan Baseline',
        email: 'jordan@college.edu',
        links: ['https://github.com/jordan/proj'],
      },
      skills: ['TypeScript', 'React', 'Node.js', 'PostgreSQL'],
      experience: [
        {
          id: 'b-exp-1',
          company: 'Regional Software Co',
          title: 'Software Development Intern',
          bullets: [
            {
              id: 'b-exp-b1',
              text: 'Developed customer dashboard frontend features using React and TypeScript.',
            },
            {
              id: 'b-exp-b2',
              text: 'Integrated backend REST APIs with PostgreSQL database queries.',
            },
          ],
        },
      ],
      projects: [
        {
          id: 'b-proj-1',
          name: 'Task Board',
          tech: ['TypeScript', 'React'],
          bullets: [
            {
              id: 'b-proj-b1',
              text: 'Deployed fullstack application live to Vercel at https://taskboard-demo.vercel.app',
            },
          ],
        },
      ],
      education: [],
      certifications: [],
    };

    // Borderline B: Strong skills resume with NO commercial experience (only deep hobby projects)
    const borderlineSkillsNoExp: Resume = {
      contact: {
        name: 'Devon Hacker',
        email: 'devon@gmail.com',
        links: ['https://github.com/devon'],
      },
      skills: ['TypeScript', 'React', 'PostgreSQL', 'Docker', 'GraphQL'],
      experience: [],
      projects: [
        {
          id: 'b2-proj-1',
          name: 'Distributed Cache',
          tech: ['TypeScript', 'Node.js'],
          bullets: [
            {
              id: 'b2-proj-b1',
              text: 'Implemented distributed in-memory cache achieving 15,000 rps in load benchmarks.',
            },
          ],
        },
        {
          id: 'b2-proj-2',
          name: 'E-commerce Clone',
          tech: ['React', 'PostgreSQL'],
          bullets: [
            {
              id: 'b2-proj-b2',
              text: 'Built end-to-end shopping cart with PostgreSQL transactions at https://shop.devon.io',
            },
          ],
        },
      ],
      education: [],
      certifications: [],
    };

    it('evaluates Borderline A (internship + deployed link without metrics) into Fair band', () => {
      const reqs: JobRequirementItem[] = [
        { requirement: 'TypeScript', type: 'must', jd_quote: 'TS', status: 'met', resume_quote: 'TypeScript' },
        { requirement: 'React', type: 'must', jd_quote: 'React', status: 'met', resume_quote: 'React' },
        { requirement: 'PostgreSQL', type: 'must', jd_quote: 'PostgreSQL', status: 'met', resume_quote: 'PostgreSQL' },
        { requirement: 'Automated Testing', type: 'must', jd_quote: 'Testing', status: 'missing' },
        { requirement: 'Docker', type: 'nice', jd_quote: 'Docker', status: 'missing' },
        { requirement: 'CI/CD', type: 'nice', jd_quote: 'CI/CD', status: 'missing' },
      ];

      const skills = computeSkillCoverage(reqs); // 6/10 = 60%
      const proof = computeProofStrength(borderlineInternshipNoMetrics); // Has link -> not capped at 50
      const level = computeLevelFit(borderlineInternshipNoMetrics, 0, true); // 95%
      const domain = { score: 45, evidence: 'General internal tool' };
      const quality = computeApplicationQuality(borderlineInternshipNoMetrics);

      const odds = computeOdds(
        {
          skill_coverage: skills,
          proof_strength: proof,
          level_fit: level,
          domain_relevance: domain,
          application_quality: quality,
        },
        ['Docker experience', 'Quantified production metrics'],
        'Add measurable impact metrics to internship bullets',
        'Medium'
      );

      // Score lands in the Fair band (~55-64)
      expect(odds.band).toBe('Fair');
      expect(odds.weighted_score).toBeGreaterThanOrEqual(35);
      expect(odds.weighted_score).toBeLessThan(65);
    });

    it('evaluates Borderline B (strong skills & metrics but zero commercial experience) into Fair band', () => {
      const reqs: JobRequirementItem[] = [
        { requirement: 'TypeScript', type: 'must', jd_quote: 'TS', status: 'met', resume_quote: 'TypeScript' },
        { requirement: 'React', type: 'must', jd_quote: 'React', status: 'met', resume_quote: 'React' },
        { requirement: 'PostgreSQL', type: 'must', jd_quote: 'PostgreSQL', status: 'met', resume_quote: 'PostgreSQL' },
        { requirement: 'Production System Design', type: 'must', jd_quote: 'System Design', status: 'missing' },
        { requirement: 'Docker', type: 'nice', jd_quote: 'Docker', status: 'partial' },
        { requirement: 'CI/CD', type: 'nice', jd_quote: 'CI/CD', status: 'missing' },
      ];

      const skills = computeSkillCoverage(reqs);
      const proof = computeProofStrength(borderlineSkillsNoExp); // projects + metrics + links
      const level = computeLevelFit(borderlineSkillsNoExp, 0, true); // 95% on fresher-friendly
      const domain = { score: 30, evidence: 'Academic coursework and hobby projects only' };
      const quality = computeApplicationQuality(borderlineSkillsNoExp);

      const odds = computeOdds(
        {
          skill_coverage: skills,
          proof_strength: proof,
          level_fit: level,
          domain_relevance: domain,
          application_quality: quality,
        },
        ['Commercial team experience'],
        'Highlight collaborative engineering or open-source PRs',
        'Medium'
      );

      // Lands in Fair band: high skills/proof, but lack of commercial experience anchors domain
      expect(odds.band).toBe('Fair');
      expect(odds.weighted_score).toBeGreaterThanOrEqual(35);
      expect(odds.weighted_score).toBeLessThan(65);
    });
  });
});
