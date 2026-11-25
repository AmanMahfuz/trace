import { describe, it, expect } from 'vitest';
import { runIngestAgent } from '../agents/ingest';
import { runJobReaderAgent } from '../agents/jobReader';
import { runMatcherAgent } from '../agents/matcher';
import { runTailorAgent } from '../agents/tailor';
import { Router, LLMRequest } from '../types';

function createMockRouter(responses: Record<string, unknown>): Router {
  return {
    async json<T>(req: LLMRequest<T>) {
      const match = responses[req.task] || responses.default;
      if (!match) throw new Error(`No mock response for task: ${req.task}`);
      return {
        data: match as T,
        meta: {
          provider: 'mock',
          model: 'mock-model',
          latencyMs: 10,
          fallbackDepth: 0,
          cached: false,
        },
      };
    },
    async text() {
      return {
        text: 'mock',
        meta: {
          provider: 'mock',
          model: 'mock-model',
          latencyMs: 10,
          fallbackDepth: 0,
          cached: false,
        },
      };
    },
  };
}

describe('Engine Agents Single Source of Truth', () => {
  it('runIngestAgent parses resume, assigns UUIDs and constructs quoteIndex', async () => {
    const mockRouter = createMockRouter({
      ingest_resume: {
        contact: { name: 'Alice Smith', email: 'alice@example.com' },
        summary: 'Passionate software engineer',
        skills: ['TypeScript', 'React'],
        experience: [
          {
            company: 'Tech Corp',
            title: 'Frontend Intern',
            bullets: [{ text: 'Built UI dashboard in React' }],
          },
        ],
        projects: [
          {
            name: 'OpenSource CLI',
            tech: ['Node.js'],
            bullets: [{ text: 'Implemented argument parser' }],
          },
        ],
        education: [
          { school: 'State University', degree: 'BS Computer Science', year: '2025' },
        ],
      },
    });

    const result = await runIngestAgent({
      rawText: 'Alice Smith, Tech Corp Intern, built UI dashboard in React',
      router: mockRouter,
    });

    expect(result.resume.contact.name).toBe('Alice Smith');
    expect(result.resume.experience[0].id).toBeDefined();
    expect(result.resume.experience[0].bullets[0].id).toBeDefined();
    expect(result.quoteIndex).toContain('Built UI dashboard in React');
    expect(result.injectionDetected).toBe(false);
  });

  it('runJobReaderAgent extracts requirements and verifies jd_quotes in code', async () => {
    const rawJobText = 'We are hiring a Frontend Engineer. Must have 2+ years of React experience. Nice to have Tailwind CSS.';

    const mockRouter = createMockRouter({
      read_job_description: {
        title: 'Frontend Engineer',
        company: 'Innovate Labs',
        requirements: [
          { requirement: 'React', type: 'must', jd_quote: 'Must have 2+ years of React experience' },
          { requirement: 'Vue', type: 'nice', jd_quote: 'Proficiency in Vue.js' }, // Fabricated quote!
        ],
        yearsRequired: 2,
        isFresherFriendly: false,
        keyJdKeywords: ['React', 'Frontend'],
      },
    });

    const result = await runJobReaderAgent({
      rawJobText,
      router: mockRouter,
    });

    expect(result.data.title).toBe('Frontend Engineer');
    // First requirement quote is genuinely present in JD
    expect(result.verifiedRequirements[0].jd_quote).toBe('Must have 2+ years of React experience');
    // Second requirement quote was NOT in the JD text, so code verification strips the fake quote
    expect(result.verifiedRequirements[1].jd_quote).toBe('');
  });

  it('runMatcherAgent demotes ungrounded met claims to partial or missing', async () => {
    const resume = {
      contact: { name: 'Bob', links: [] },
      skills: ['Python', 'Docker'],
      experience: [
        {
          id: 'exp-1',
          company: 'Data Co',
          title: 'Intern',
          bullets: [{ id: 'b-1', text: 'Trained PyTorch models on GPU clusters', verified: true }],
        },
      ],
      projects: [],
      education: [],
    };

    const mockRouter = createMockRouter({
      match_evidence: {
        requirements: [
          {
            requirement: 'PyTorch experience',
            type: 'must',
            jd_quote: 'Experience with PyTorch',
            status: 'met',
            resume_quote: 'Trained PyTorch models on GPU clusters',
          },
          {
            requirement: 'Docker experience',
            type: 'nice',
            jd_quote: 'Knowledge of Docker containers',
            status: 'met',
            resume_quote: 'Managed massive Docker production clusters', // Fake resume quote!
          },
          {
            requirement: 'Kubernetes orchestration',
            type: 'must',
            jd_quote: 'Experience with K8s',
            status: 'met',
            resume_quote: 'Maintained Kubernetes clusters', // Fake quote and not in skills!
          },
        ],
        domain_relevance: 75,
        domain_evidence: 'Direct PyTorch machine learning experience',
        top_gaps: ['Kubernetes'],
        one_change_to_move_up: 'Add hands-on container orchestration projects',
        confidence: 'High',
      },
    });

    const result = await runMatcherAgent({
      resume,
      rawJobText: 'Job looking for PyTorch, Docker, Kubernetes',
      router: mockRouter,
    });

    // 1. PyTorch has real quote -> met
    expect(result.verifiedRequirements[0].status).toBe('met');
    // 2. Docker fake quote, but Docker in skills array -> downgraded to partial
    expect(result.verifiedRequirements[1].status).toBe('partial');
    // 3. Kubernetes fake quote and not in skills -> downgraded to missing
    expect(result.verifiedRequirements[2].status).toBe('missing');
  });

  it('runTailorAgent catches hallucinations and downgrades to needs_detail', async () => {
    const resume = {
      contact: { name: 'Charlie', links: [] },
      skills: ['React'],
      experience: [
        {
          id: 'exp-1',
          company: 'Acme Inc',
          title: 'Junior Web Dev',
          bullets: [
            { id: 'b-1', text: 'Created company marketing pages using React.', verified: true },
          ],
        },
      ],
      projects: [],
      education: [],
    };

    // First attempt returns an invented metric: $500,000 revenue
    // Repair attempt still hallucinates 99.9% uptime
    const router: Router = {
      async json<T>(req: LLMRequest<T>) {
        if (req.task === 'tailor_rewrites') {
          return {
            data: [
              {
                bullet_id: 'b-1',
                original: 'Created company marketing pages using React.',
                suggested: 'Engineered high-converting React pages generating $500,000 revenue.',
                reason: 'Add business impact',
              },
            ] as unknown as T,
            meta: { provider: 'mock', model: 'mock', latencyMs: 5, fallbackDepth: 0, cached: false },
          };
        }
        if (req.task === 'tailor_rewrite_repair') {
          return {
            data: {
              bullet_id: 'b-1',
              original: 'Created company marketing pages using React.',
              suggested: 'Engineered React pages maintaining 99.9% uptime.', // Still hallucinating!
              reason: 'Add uptime metrics',
            } as unknown as T,
            meta: { provider: 'mock', model: 'mock', latencyMs: 5, fallbackDepth: 0, cached: false },
          };
        }
        throw new Error('Unknown task');
      },
      async text() {
        return { text: '', meta: { provider: 'mock', model: 'mock', latencyMs: 0, fallbackDepth: 0, cached: false } };
      },
    };

    const result = await runTailorAgent({
      resume,
      rawJobText: 'Seeking frontend engineer',
      router,
    });

    // Persistent hallucination must be demoted to needs_detail
    expect(result.factLockDowngradedCount).toBe(1);
    expect(result.suggestions[0].suggested).toBeUndefined();
    expect(result.suggestions[0].needs_detail).toBeDefined();
    expect(result.suggestions[0].needs_detail?.question).toContain('marketing pages');
  });
});
