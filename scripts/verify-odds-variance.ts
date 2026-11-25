import { generateJSON } from '../src/lib/ai/provider';
import {
  computeOdds,
  computeSkillCoverage,
  computeProofStrength,
  computeLevelFit,
  computeApplicationQuality,
  verifyRequirementQuotes,
  JobRequirementItem,
} from '../src/lib/odds';
import { Resume } from '../src/lib/schemas';
import { z } from 'zod';

const targetJob = `
Senior/Junior Fullstack Engineer at Stripe (Entry-Level / Fresher Friendly)
Location: Remote
About the Role:
We are looking for early-career software engineers to build reliable, high-throughput financial infrastructure.
Requirements:
- Strong foundations in TypeScript and React for building resilient frontend applications.
- Experience with relational databases like PostgreSQL (schema design, query optimization).
- Nice to have: Experience with Docker containers and automated CI/CD deployment.
- 0-1 years of experience. We welcome new university graduates and interns.
`;

const strongResume: Resume = {
  contact: { name: 'Sarah Connor', email: 'sarah@mit.edu', links: ['https://github.com/sarahc', 'https://sarah.dev'] },
  experience: [
    {
      id: 'e1',
      company: 'Stripe',
      title: 'Software Engineer Intern',
      bullets: [
        { id: 'b1', text: 'Engineered high-throughput TypeScript checkout microservice reducing API latency by 35%.' },
        { id: 'b2', text: 'Architected PostgreSQL database partitioning strategy handling 250k daily transactions.' },
      ],
    },
    {
      id: 'e2',
      company: 'Vercel',
      title: 'Frontend Intern',
      bullets: [
        { id: 'b3', text: 'Built React design system components used by 15,000 developers worldwide.' },
      ],
    },
  ],
  projects: [
    {
      id: 'p1',
      name: 'OpenMetrics',
      tech: ['TypeScript', 'Next.js', 'PostgreSQL'],
      bullets: [
        { id: 'b4', text: 'Deployed live production analytics app at https://openmetrics.dev with 1,200 active users.' },
      ],
    },
  ],
  skills: ['TypeScript', 'React', 'Node.js', 'PostgreSQL', 'Docker'],
  education: [{ id: 'ed1', school: 'MIT', degree: 'B.S. Computer Science' }],
};

const averageResume: Resume = {
  contact: { name: 'Alex Chen', email: 'alex@state.edu', links: [] },
  experience: [
    {
      id: 'e1',
      company: 'Campus IT',
      title: 'Student Web Assistant',
      bullets: [
        { id: 'b1', text: 'Built student portal components using React and HTML/CSS.' },
        { id: 'b2', text: 'Assisted senior developer with MySQL database schema updates.' },
      ],
    },
  ],
  projects: [
    {
      id: 'p1',
      name: 'Todo App',
      tech: ['JavaScript', 'React'],
      bullets: [
        { id: 'b3', text: 'Created responsive task manager in React with local storage persistence.' },
      ],
    },
  ],
  skills: ['JavaScript', 'React', 'HTML', 'CSS', 'MySQL'],
  education: [{ id: 'ed1', school: 'State University', degree: 'B.Tech IT' }],
};

const weakResume: Resume = {
  contact: { name: 'Jordan Smith', email: 'jordan@gmail.com', links: [] },
  experience: [],
  projects: [
    {
      id: 'p1',
      name: 'Coursework Simulation',
      tech: ['Python'],
      bullets: [
        { id: 'b1', text: 'Calculated basic statistical models in Python for academic class.' },
      ],
    },
  ],
  skills: ['Python', 'Excel', 'Word'],
  education: [{ id: 'ed1', school: 'Community College', degree: 'General Studies' }],
};

// Borderline A: 1 internship + deployed project with NO metrics
const borderlineInternshipNoMetrics: Resume = {
  contact: { name: 'Jordan Baseline', email: 'jordan@college.edu', links: ['https://github.com/jordan/proj'] },
  skills: ['TypeScript', 'React', 'Node.js', 'PostgreSQL'],
  experience: [
    {
      id: 'b-exp-1',
      company: 'Regional Software Co',
      title: 'Software Development Intern',
      bullets: [
        { id: 'b-exp-b1', text: 'Developed customer dashboard frontend features using React and TypeScript.' },
        { id: 'b-exp-b2', text: 'Integrated backend REST APIs with PostgreSQL database queries.' },
      ],
    },
  ],
  projects: [
    {
      id: 'b-proj-1',
      name: 'Task Board',
      tech: ['TypeScript', 'React'],
      bullets: [
        { id: 'b-proj-b1', text: 'Deployed fullstack application live to Vercel at https://taskboard-demo.vercel.app' },
      ],
    },
  ],
};

// Borderline B: Strong skills resume with NO commercial experience
const borderlineSkillsNoExp: Resume = {
  contact: { name: 'Devon Hacker', email: 'devon@gmail.com', links: ['https://github.com/devon'] },
  skills: ['TypeScript', 'React', 'PostgreSQL', 'Docker', 'GraphQL'],
  experience: [],
  projects: [
    {
      id: 'b2-proj-1',
      name: 'Distributed Cache',
      tech: ['TypeScript', 'Node.js'],
      bullets: [
        { id: 'b2-proj-b1', text: 'Implemented distributed in-memory cache achieving 15,000 rps in load benchmarks.' },
      ],
    },
    {
      id: 'b2-proj-2',
      name: 'E-commerce Clone',
      tech: ['React', 'PostgreSQL'],
      bullets: [
        { id: 'b2-proj-b2', text: 'Built end-to-end shopping cart with PostgreSQL transactions at https://shop.devon.io' },
      ],
    },
  ],
};

async function evaluateCandidate(resume: Resume, runLabel: string) {
  const analysisOutput = await generateJSON({
    tier: 'mid',
    task: `variance_test_${runLabel}`,
    temperature: 0,
    schema: z.object({
      requirements: z
        .array(
          z.object({
            requirement: z.string(),
            type: z.enum(['must', 'nice']),
            jd_quote: z.string(),
            status: z.enum(['met', 'partial', 'missing']),
            resume_quote: z.string().optional(),
          })
        )
        .max(12),
      years_required: z.number().default(0),
      is_fresher_friendly: z.boolean().default(true),
      domain_relevance: z.number().min(0).max(100),
      domain_evidence: z.string(),
      key_jd_keywords: z.array(z.string()).max(10),
      top_gaps: z.array(z.string()).max(3),
      one_change_to_move_up: z.string(),
      confidence: z.enum(['Low', 'Medium', 'High']),
    }),
    system: `You are an honest, rigorous hiring diagnostic engine for tech freshers.
SCORING ANCHORS:
- A typical fresher with one internship and one project scores 45-65.
- Reserve 85+ for rare, clearly evidenced commercial matches.
- In evaluating requirements:
  - 'met' REQUIRES a direct quote from the resume proving the skill was applied in work or a substantial project.
  - A skill listed only in the skills list with NO project/work bullet proof is 'partial'.
  - No quote or evidence means 'missing'.
- Domain relevance anchors:
  - 100: Same commercial domain and exact same stack in production work.
  - 60: Adjacent domain or similar modern stack.
  - 30: Academic coursework or hobby projects only.
  - 0: Unrelated domain.
Do not invent facts or inflate candidate scores.`,
    prompt: `Candidate Resume JSON:\n${JSON.stringify(resume)}\n\nTarget Job Posting:\n${targetJob}`,
  });

  const verified = verifyRequirementQuotes(analysisOutput.requirements as JobRequirementItem[], resume);
  const skillsFactor = computeSkillCoverage(verified);
  const proofFactor = computeProofStrength(resume);
  const levelFactor = computeLevelFit(resume, analysisOutput.years_required, analysisOutput.is_fresher_friendly);
  const domainFactor = { score: analysisOutput.domain_relevance, evidence: analysisOutput.domain_evidence };
  const qualityFactor = computeApplicationQuality(resume);

  let oneChange = analysisOutput.one_change_to_move_up;
  const initialOdds = computeOdds(
    {
      skill_coverage: skillsFactor,
      proof_strength: proofFactor,
      level_fit: levelFactor,
      domain_relevance: domainFactor,
      application_quality: qualityFactor,
    },
    analysisOutput.top_gaps,
    oneChange,
    analysisOutput.confidence
  );

  if (initialOdds.band === 'Long shot') {
    const topSkills = resume.skills?.slice(0, 3).join(', ') || 'current skills';
    oneChange = `Significant mismatch for this specific stack/seniority level. You would have much higher odds targeting junior/entry-level roles centered on ${topSkills} or foundational software engineering internships before applying to roles requiring commercial production experience.`;
  }

  return computeOdds(
    {
      skill_coverage: skillsFactor,
      proof_strength: proofFactor,
      level_fit: levelFactor,
      domain_relevance: domainFactor,
      application_quality: qualityFactor,
    },
    analysisOutput.top_gaps,
    oneChange,
    analysisOutput.confidence
  );
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  console.log('=== RUNNING 5-RUN VARIANCE TEST AT TEMPERATURE 0 ===\n');

  const fixtures = [
    { name: 'Strong (Sarah Connor)', resume: strongResume },
    { name: 'Average (Alex Chen)', resume: averageResume },
    { name: 'Weak (Jordan Smith)', resume: weakResume },
  ];

  for (const fix of fixtures) {
    const scores: number[] = [];
    const bands: string[] = [];
    console.log(`Evaluating "${fix.name}" across 5 identical runs...`);

    for (let i = 1; i <= 5; i++) {
      process.stdout.write(`  Run ${i}/5... `);
      let success = false;
      let attempts = 0;
      while (!success && attempts < 4) {
        try {
          attempts++;
          const res = await evaluateCandidate(fix.resume, `${fix.name}_run_${i}`);
          scores.push(res.weighted_score);
          bands.push(res.band);
          console.log(`Score: ${res.weighted_score} (${res.band}) [Domain: ${res.factors.domain_relevance.score}, Skill: ${res.factors.skill_coverage.score}]`);
          success = true;
        } catch (err: unknown) {
          if (attempts >= 4) throw err;
          const msg = err instanceof Error ? err.message : String(err);
          console.log(`\n    Attempt ${attempts} error (${msg.slice(0, 80)}...). Backing off 25s...`);
          await sleep(25000);
        }
      }
      // Pause 10s between requests to stay smoothly within the free tier 5 req/min limit
      if (i < 5) await sleep(10000);
    }

    const min = Math.min(...scores);
    const max = Math.max(...scores);
    const variance = max - min;
    console.log(`=> Summary for ${fix.name}: Min=${min}, Max=${max}, Variance=${variance} points, Bands=[${Array.from(new Set(bands)).join(', ')}]\n`);
    await sleep(15000);
  }

  console.log('=== EVALUATING BORDERLINE FIXTURES ===\n');

  console.log('Borderline A: 1 internship + deployed project with NO metrics');
  const resBorderlineA = await evaluateCandidate(borderlineInternshipNoMetrics, 'borderline_A');
  console.log(`Result: Score=${resBorderlineA.weighted_score}, Band=${resBorderlineA.band}`);
  console.log(`Factors: Skill=${resBorderlineA.factors.skill_coverage.score}, Proof=${resBorderlineA.factors.proof_strength.score}, Level=${resBorderlineA.factors.level_fit.score}, Domain=${resBorderlineA.factors.domain_relevance.score}, Quality=${resBorderlineA.factors.application_quality.score}`);
  console.log(`One Change: "${resBorderlineA.one_change_to_move_up}"\n`);

  await sleep(15000);

  console.log('Borderline B: Strong skills resume with NO commercial experience');
  const resBorderlineB = await evaluateCandidate(borderlineSkillsNoExp, 'borderline_B');
  console.log(`Result: Score=${resBorderlineB.weighted_score}, Band=${resBorderlineB.band}`);
  console.log(`Factors: Skill=${resBorderlineB.factors.skill_coverage.score}, Proof=${resBorderlineB.factors.proof_strength.score}, Level=${resBorderlineB.factors.level_fit.score}, Domain=${resBorderlineB.factors.domain_relevance.score}, Quality=${resBorderlineB.factors.application_quality.score}`);
  console.log(`One Change: "${resBorderlineB.one_change_to_move_up}"\n`);
}

main().catch((err) => {
  console.error('Variance evaluation error:', err);
  process.exit(1);
});
