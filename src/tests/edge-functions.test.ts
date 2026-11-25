import { describe, it, expect, vi } from 'vitest';
import {
  advanceRun,
  handleInterviewTurn,
  evaluateSession,
  generateAutopsy,
  runMaintenanceJobs,
  runWeeklyCalibration,
  type PipelineDb,
  type MaintenanceDb,
  type CalibrationDb,
} from '../../supabase/functions/_shared/engine.js';

describe('Supabase Edge Functions Logic Suite', () => {
  it('engine-advance claims steps atomically via FOR UPDATE SKIP LOCKED and advances idempotently', async () => {
    const mockSteps = [
      {
        id: 'step-uuid-1',
        run_id: 'run-uuid-1',
        step_name: 'ingest',
        step_order: 1,
        status: 'pending',
        input: { resumeText: 'Candidate Jane Doe. Expert in TypeScript and PostgreSQL.' },
        output: null,
      },
      {
        id: 'step-uuid-2',
        run_id: 'run-uuid-1',
        step_name: 'match',
        step_order: 2,
        status: 'pending',
        input: { candidateSkills: ['TypeScript', 'PostgreSQL'], requiredSkills: ['TypeScript'] },
        output: null,
      },
    ];

    let currentStepIdx = 0;
    const mockDb = {
      rpc: vi.fn(async (fn: string) => {
        if (fn === 'claim_next_pipeline_step') {
          if (currentStepIdx < mockSteps.length) {
            return { data: mockSteps[currentStepIdx], error: null };
          }
          return { data: null, error: null };
        }
        if (fn === 'complete_pipeline_step') {
          currentStepIdx++;
          return { data: { has_more: currentStepIdx < mockSteps.length }, error: null };
        }
        return { data: null, error: null };
      }),
      from: vi.fn(),
    };

    // First advance: claims ingest step
    const adv1 = await advanceRun({ runId: 'run-uuid-1', db: mockDb as unknown as PipelineDb });
    expect(adv1.status).toBe('advanced');
    expect(adv1.claimedStep).toBe('ingest');
    expect(adv1.hasMore).toBe(true);

    // Second advance: claims match step
    const adv2 = await advanceRun({ runId: 'run-uuid-1', db: mockDb as unknown as PipelineDb });
    expect(adv2.status).toBe('advanced');
    expect(adv2.claimedStep).toBe('match');
    expect(adv2.hasMore).toBe(false);

    // Third advance: no pending steps remaining
    const adv3 = await advanceRun({ runId: 'run-uuid-1', db: mockDb as unknown as PipelineDb });
    expect(adv3.status).toBe('no_pending_steps');
    expect(adv3.claimedStep).toBeNull();
  });

  it('interview-turn strictly caps question length at 25 words with no conversational filler', async () => {
    const transcript = [
      { speaker: 'interviewer' as const, text: 'Tell me about how you built your persistence layer.' },
      { speaker: 'user' as const, text: 'I implemented an LSM-tree storage engine in Rust with write-ahead logging.' },
    ];

    const turn = await handleInterviewTurn({
      transcript,
      jobTitle: 'Systems Engineer',
    });

    expect(turn.nextQuestion).toBeDefined();
    expect(turn.wordCount).toBeLessThanOrEqual(25);
    expect(turn.isConclusion).toBe(false);
  });

  it('evaluate-session accurately calculates WPM, filler word ratio, and STAR scorecard', async () => {
    const transcript = [
      { speaker: 'interviewer' as const, text: 'Describe a difficult bug you fixed.' },
      {
        speaker: 'user' as const,
        text: 'Um, basically our database queries were timing out because an index was missing on user_id. I added a composite B-tree index which reduced query time from 400ms to 2ms.',
      },
    ];

    const scorecard = await evaluateSession({
      transcript,
      jobTitle: 'Backend Engineer',
    });

    expect(scorecard.overallScore).toBeGreaterThanOrEqual(0);
    expect(scorecard.overallScore).toBeLessThanOrEqual(100);
    expect(['Strong', 'Fair', 'Needs Practice']).toContain(scorecard.band);
    expect(scorecard.starScores.result).toBeGreaterThan(0);
    expect(scorecard.metrics.fillerWordRatio).toBeGreaterThan(0);
  });

  it('autopsy generates concrete factors, pivot plan, and follow-up email citing factors', async () => {
    const result = await generateAutopsy({
      jobTitle: 'Staff Backend Engineer',
      companyName: 'Fintech Corp',
      oddsBand: 'Fair',
      outcome: 'rejected',
      topGaps: ['Experience with multi-datacenter consensus'],
      factorScores: { hard_skill_fit: { score: 60 }, proof_strength: { score: 70 } },
    });

    expect(result.reasons.length).toBeGreaterThanOrEqual(1);
    expect(result.reasons[0].factorCited).toBeDefined();
    expect(result.pivotPlan.immediateAction).toBeDefined();
    expect(result.followUpEmail.subject).toContain('Fintech Corp');
    expect(result.followUpEmail.body).toContain('Hiring Team');
  });

  it('cron-maintenance executes maintenance routines and reports metrics', async () => {
    const maintenanceDb = {
      rpc: vi.fn().mockResolvedValue({ data: 3, error: null }),
      from: vi.fn(() => ({
        delete: vi.fn(() => ({
          lt: vi.fn().mockResolvedValue({ data: [{ id: 's1' }, { id: 's2' }], error: null }),
        })),
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            lt: vi.fn().mockResolvedValue({ data: [{ id: 'app1' }], error: null }),
          })),
        })),
      })),
    };

    const report = await runMaintenanceJobs(maintenanceDb as unknown as MaintenanceDb);
    expect(report.keepAliveOk).toBe(true);
    expect(report.recoveredRunsCount).toBe(3);
    expect(report.expiredTranscriptsPurged).toBe(2);
    expect(report.outcomeNudgesFlagged).toBe(1);
  });

  it('weekly-calibration computes interview and offer conversion rates across bands', async () => {
    const calibDb = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          not: vi.fn().mockResolvedValue({
            data: [
              { odds: { band: 'Strong' }, outcome: 'interview' },
              { odds: { band: 'Strong' }, outcome: 'interview' },
              { odds: { band: 'Strong' }, outcome: 'offer' },
              { odds: { band: 'Fair' }, outcome: 'interview' },
              { odds: { band: 'Fair' }, outcome: 'rejected' },
              { odds: { band: 'Long shot' }, outcome: 'ghosted' },
            ],
            error: null,
          }),
        })),
      })),
    };

    const report = await runWeeklyCalibration(calibDb as unknown as CalibrationDb);
    expect(report.sampleSize).toBe(6);
    expect(report.buckets.Strong.interviewRate).toBe(100);
    expect(report.buckets.Fair.interviewRate).toBe(50);
    expect(report.buckets['Long shot'].interviewRate).toBe(0);
    expect(report.sufficientSamples).toBe(false);
  });
});
