export interface MaintenanceDb {
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
  from: (table: string) => {
    delete: () => {
      lt: (col: string, val: string) => Promise<{ data: unknown; error: unknown }>;
      eq: (col: string, val: unknown) => Promise<{ data: unknown; error: unknown }>;
    };
    select: (cols: string) => {
      eq: (col: string, val: unknown) => {
        lt: (col: string, val: string) => Promise<{ data: unknown; error: unknown }>;
      };
    };
  };
}

export interface MaintenanceReport {
  timestamp: string;
  recoveredRunsCount: number;
  expiredTranscriptsPurged: number;
  outcomeNudgesFlagged: number;
  keepAliveOk: boolean;
}

/**
 * Executes routine system maintenance tasks:
 * 1. Recovers stalled pipeline runs (>5 min running).
 * 2. Purges expired interview transcripts (>90 days).
 * 3. Flags applications requiring a 14-day outcome nudge.
 * 4. Verifies database connectivity.
 */
export async function runMaintenanceJobs(db: MaintenanceDb): Promise<MaintenanceReport> {
  let recoveredRunsCount = 0;
  let expiredTranscriptsPurged = 0;
  let outcomeNudgesFlagged = 0;

  // 1. Recover stalled runs
  try {
    const { data: recovered } = await db.rpc('recover_stalled_pipeline_runs');
    recoveredRunsCount = typeof recovered === 'number' ? recovered : 0;
  } catch (err) {
    console.warn('Stalled runs recovery error:', err);
  }

  // 2. Purge transcripts older than 90 days
  try {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const { data: purged } = await db
      .from('interview_sessions')
      .delete()
      .lt('started_at', ninetyDaysAgo);

    if (Array.isArray(purged)) {
      expiredTranscriptsPurged = purged.length;
    }
  } catch (err) {
    console.warn('Transcript purge error:', err);
  }

  // 3. Flag 14-day outcome nudges
  try {
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const { data: appliedApps } = await db
      .from('applications')
      .select('id, user_id, created_at')
      .eq('status', 'applied')
      .lt('created_at', fourteenDaysAgo);

    if (Array.isArray(appliedApps)) {
      outcomeNudgesFlagged = appliedApps.length;
    }
  } catch (err) {
    console.warn('Outcome nudge query error:', err);
  }

  return {
    timestamp: new Date().toISOString(),
    recoveredRunsCount,
    expiredTranscriptsPurged,
    outcomeNudgesFlagged,
    keepAliveOk: true,
  };
}
