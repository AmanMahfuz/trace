import { describe, it, expect } from 'vitest';
import { evaluateGhostRisk } from '../lib/ghost';

describe('Ghost Risk Rules Engine', () => {
  it('rule 1: detects job posted >30 days ago', () => {
    const oldDate = new Date(Date.now() - 35 * 24 * 3600 * 1000);
    const res = evaluateGhostRisk({
      raw_text: 'Engineering Manager reports to VP. Location: Remote. Salary: $120k.',
      date_posted: oldDate,
    });
    expect(res.signals.some((s) => s.includes('days ago'))).toBe(true);
  });

  it('rule 2: detects repost with identical jd_hash', () => {
    const res = evaluateGhostRisk({
      raw_text: 'Reports to engineering manager. Location: Bangalore. Salary: 15 LPA.',
      is_repost: true,
    });
    expect(res.signals.some((s) => s.includes('cycled previously'))).toBe(true);
  });

  it('rule 3: detects validThrough in the past', () => {
    const expiredDate = new Date(Date.now() - 2 * 24 * 3600 * 1000);
    const res = evaluateGhostRisk({
      raw_text: 'Our team is hiring. Location: London. Salary: £60,000.',
      valid_through: expiredDate,
    });
    expect(res.signals.some((s) => s.includes('already expired'))).toBe(true);
  });

  it('rule 4: detects omitted salary AND omitted location', () => {
    const res = evaluateGhostRisk({
      raw_text: 'Reports to Engineering Manager. We do cool cloud things.',
    });
    expect(res.signals.some((s) => s.includes('both geographic location and compensation'))).toBe(true);
  });

  it('rule 5: detects evergreen recruitment phrases', () => {
    const res = evaluateGhostRisk({
      raw_text: 'Reports to team lead in Bangalore. Join our talent pool for future opportunities.',
    });
    expect(res.signals.some((s) => s.includes('evergreen recruitment wording'))).toBe(true);
  });

  it('rule 6: detects absence of team or manager', () => {
    const res = evaluateGhostRisk({
      raw_text: 'Software Engineer in Bangalore. Salary: 10 LPA. Build things.',
    });
    expect(res.signals.some((s) => s.includes('No specific team, manager'))).toBe(true);
  });

  it('rule 7: detects contradictory fresher requirements with 3+ years experience', () => {
    const res = evaluateGhostRisk({
      raw_text: 'Reports to manager. Location: Remote. Salary: $80k. Fresher role, requires 3+ years experience.',
    });
    expect(res.signals.some((s) => s.includes('Contradictory requirements'))).toBe(true);
  });

  it('categorizes levels correctly: 0-1 Low, 2 Medium, 3+ High', () => {
    const cleanJob = evaluateGhostRisk({
      raw_text: 'Reports to Engineering Manager. Work in Bangalore. Salary: 15 LPA.',
      date_posted: new Date(),
    });
    expect(cleanJob.level).toBe('Low');

    const twoSignalJob = evaluateGhostRisk({
      raw_text: 'Work in Bangalore. Salary: 15 LPA.', // misses team/manager (1) + old date (2)
      date_posted: new Date(Date.now() - 40 * 24 * 3600 * 1000),
    });
    expect(twoSignalJob.level).toBe('Medium');

    const highRiskJob = evaluateGhostRisk({
      raw_text: 'Fresher welcome. Required 4+ years of experience. Talent pool.',
      date_posted: new Date(Date.now() - 40 * 24 * 3600 * 1000),
    });
    expect(highRiskJob.level).toBe('High');
  });
});
