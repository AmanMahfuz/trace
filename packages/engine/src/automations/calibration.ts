export interface CalibrationDb {
  from: (table: string) => {
    select: (cols: string) => {
      not: (col: string, op: string, val: unknown) => Promise<{ data: unknown; error: unknown }>;
    };
  };
}

export interface CalibrationBucket {
  predictedBand: string;
  totalApplications: number;
  outcomes: {
    interview: number;
    offer: number;
    rejected: number;
    ghosted: number;
  };
  interviewRate: number;
  offerRate: number;
}

export interface CalibrationReport {
  generatedAt: string;
  sampleSize: number;
  sufficientSamples: boolean;
  buckets: Record<string, CalibrationBucket>;
  recommendation: string;
}

/**
 * Weekly calibration analysis:
 * Compares predicted odds bands ('Strong', 'Fair', 'Long shot') against real outcomes
 * logged by candidates. Produces a diagnostic report without modifying algorithmic weights.
 */
export async function runWeeklyCalibration(db: CalibrationDb): Promise<CalibrationReport> {
  const buckets: Record<string, CalibrationBucket> = {
    Strong: {
      predictedBand: 'Strong',
      totalApplications: 0,
      outcomes: { interview: 0, offer: 0, rejected: 0, ghosted: 0 },
      interviewRate: 0,
      offerRate: 0,
    },
    Fair: {
      predictedBand: 'Fair',
      totalApplications: 0,
      outcomes: { interview: 0, offer: 0, rejected: 0, ghosted: 0 },
      interviewRate: 0,
      offerRate: 0,
    },
    'Long shot': {
      predictedBand: 'Long shot',
      totalApplications: 0,
      outcomes: { interview: 0, offer: 0, rejected: 0, ghosted: 0 },
      interviewRate: 0,
      offerRate: 0,
    },
  };

  let totalSampleCount = 0;

  try {
    const { data: rows } = await db
      .from('applications')
      .select('odds, outcome')
      .not('outcome', 'is', null);

    if (Array.isArray(rows)) {
      for (const row of rows) {
        const band = (row.odds as { band?: string })?.band || 'Fair';
        const outcome = row.outcome as 'interview' | 'offer' | 'rejected' | 'ghosted';

        const targetBucket = buckets[band] || buckets['Fair'];
        targetBucket.totalApplications += 1;
        totalSampleCount += 1;

        if (outcome === 'interview') targetBucket.outcomes.interview += 1;
        else if (outcome === 'offer') targetBucket.outcomes.offer += 1;
        else if (outcome === 'rejected') targetBucket.outcomes.rejected += 1;
        else if (outcome === 'ghosted') targetBucket.outcomes.ghosted += 1;
      }
    }
  } catch (err) {
    console.warn('Calibration data fetch notice:', err);
  }

  // Calculate conversion rates
  for (const b of Object.values(buckets)) {
    if (b.totalApplications > 0) {
      b.interviewRate = Number(
        (((b.outcomes.interview + b.outcomes.offer) / b.totalApplications) * 100).toFixed(1)
      );
      b.offerRate = Number(((b.outcomes.offer / b.totalApplications) * 100).toFixed(1));
    }
  }

  const sufficientSamples = totalSampleCount >= 30;
  let recommendation = 'Sample volume too low (< 30 outcomes) to recalibrate scoring thresholds.';

  if (sufficientSamples) {
    const strongRate = buckets.Strong.interviewRate;
    const fairRate = buckets.Fair.interviewRate;
    const longRate = buckets['Long shot'].interviewRate;

    if (strongRate >= fairRate && fairRate >= longRate) {
      recommendation = 'Model calibration verified: monotonicity holds across all three bands.';
    } else {
      recommendation =
        'Notice: Inversion detected in outcome distribution. Recommend inspecting hard_skill_fit weight.';
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    sampleSize: totalSampleCount,
    sufficientSamples,
    buckets,
    recommendation,
  };
}
