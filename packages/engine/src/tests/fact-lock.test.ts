import { describe, it, expect } from 'vitest';
import { verifyRewriteWithFactLock } from '../guards/factLock';

describe('Fact-Lock Guard', () => {
  const originalSources = [
    'Built an internal dashboard using React and Node.js.',
    'Optimized PostgreSQL database queries, reducing query time from 800ms to 200ms.',
    'Collaborated with a team of 4 engineers to deploy updates weekly.',
  ];

  it('passes a rewrite that stays strictly grounded in verified facts', () => {
    const rewrite = 'Architected an internal dashboard in React and Node.js, slashing PostgreSQL query latency from 800ms to 200ms.';
    const result = verifyRewriteWithFactLock(rewrite, originalSources);

    expect(result.passed).toBe(true);
    expect(result.unverifiedTokens).toHaveLength(0);
  });

  it('fails and catches hallucinated metrics and percentages', () => {
    // Model invented 99.9% uptime and 45% throughput increase
    const hallucinatedRewrite = 'Engineered dashboard in React and Node.js, achieving 99.9% uptime and increasing throughput by 45%.';
    const result = verifyRewriteWithFactLock(hallucinatedRewrite, originalSources);

    expect(result.passed).toBe(false);
    expect(result.unverifiedTokens).toContain('99.9%');
    expect(result.unverifiedTokens).toContain('45%');
  });

  it('fails and catches hallucinated currency and scale claims', () => {
    // Model invented $150,000 cost savings
    const hallucinatedRewrite = 'Optimized PostgreSQL queries, saving $150,000 in cloud compute costs.';
    const result = verifyRewriteWithFactLock(hallucinatedRewrite, originalSources);

    expect(result.passed).toBe(false);
    expect(result.unverifiedTokens.some((t) => t.includes('$150,000'))).toBe(true);
  });

  it('fails and catches ungrounded tools and frameworks', () => {
    // Candidate never used Kubernetes or Docker
    const hallucinatedRewrite = 'Automated weekly deployments using Docker and Kubernetes clusters.';
    const result = verifyRewriteWithFactLock(hallucinatedRewrite, originalSources);

    expect(result.passed).toBe(false);
    expect(result.unverifiedTokens).toContain('Docker');
    expect(result.unverifiedTokens).toContain('Kubernetes');
  });

  it('allows new details if verified in additional user interview transcript or answers', () => {
    const interviewTranscript = 'In the interview, candidate explained: "We scaled the service to 50,000 active users and added Redis for caching."';
    const combinedSources = [...originalSources, interviewTranscript];

    const rewriteWithInterviewDetail = 'Scaled Node.js service to 50,000 active users, implementing Redis caching to reduce query latency to 200ms.';
    const result = verifyRewriteWithFactLock(rewriteWithInterviewDetail, combinedSources);

    expect(result.passed).toBe(true);
    expect(result.unverifiedTokens).toHaveLength(0);
  });
});
