import { SupabaseClient } from '@supabase/supabase-js';

// Concurrency mutex lock to prevent concurrent double-spend race conditions in Node process
const activeDeductionLocks = new Map<string, Promise<DeductResult>>();

export interface DeductResult {
  success: boolean;
  charged: boolean;
  creditsRemaining?: number;
  existingSessionId?: string;
  error?: string;
}

/**
 * Atomically deducts 1 credit for an interview start session using a transactional
 * row lock / RPC, with concurrency mutex protection. If two simultaneous start requests
 * occur for the same application, exactly 1 credit is deducted.
 */
export async function deductInterviewCredit(
  supabase: SupabaseClient,
  userId: string,
  applicationId: string,
  reason = 'Voice practice session'
): Promise<DeductResult> {
  const lockKey = `${userId}:${applicationId}`;

  // If a transaction for this user and application is already executing simultaneously,
  // reuse its promise to prevent duplicate credit deduction.
  if (activeDeductionLocks.has(lockKey)) {
    const existing = await activeDeductionLocks.get(lockKey)!;
    // For the concurrent duplicate request, it shares the session with charged: false
    return {
      success: existing.success,
      charged: false,
      existingSessionId: existing.existingSessionId,
      creditsRemaining: existing.creditsRemaining,
      error: existing.error,
    };
  }

  const executionPromise = (async (): Promise<DeductResult> => {
    try {
      // 1. Try Postgres RPC transaction if available
      const { data: rpcData, error: rpcError } = await supabase.rpc('deduct_interview_credit', {
        p_user_id: userId,
        p_application_id: applicationId,
        p_reason: reason,
      });

      if (!rpcError && rpcData) {
        return rpcData as DeductResult;
      }

      // 2. Fallback transactional flow with idempotency and optimistic lock
      // Check recent session within 15 seconds to prevent double charge on double-click
      const { data: recentSession } = await supabase
        .from('interview_sessions')
        .select('id')
        .eq('user_id', userId)
        .eq('application_id', applicationId)
        .gt('started_at', new Date(Date.now() - 15000).toISOString())
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (recentSession) {
        return {
          success: true,
          charged: false,
          existingSessionId: recentSession.id,
        };
      }

      // Read current profile credits
      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('credits')
        .eq('id', userId)
        .single();

      if (profileErr || !profile || profile.credits < 1) {
        return {
          success: false,
          charged: false,
          error: 'INSUFFICIENT_CREDITS',
        };
      }

      // Atomically decrement credits where credits equals the read value and > 0
      const { data: updatedProfile, error: updateErr } = await supabase
        .from('profiles')
        .update({ credits: profile.credits - 1 })
        .eq('id', userId)
        .eq('credits', profile.credits)
        .gt('credits', 0)
        .select('credits')
        .single();

      if (updateErr || !updatedProfile) {
        return {
          success: false,
          charged: false,
          error: 'INSUFFICIENT_CREDITS',
        };
      }

      // Log credit ledger entry
      await supabase.from('credit_ledger').insert({
        user_id: userId,
        delta: -1,
        reason: `${reason} for application: ${applicationId}`,
      });

      return {
        success: true,
        charged: true,
        creditsRemaining: updatedProfile.credits,
      };
    } finally {
      // Clean up lock after a brief cooling window
      setTimeout(() => {
        activeDeductionLocks.delete(lockKey);
      }, 500);
    }
  })();

  activeDeductionLocks.set(lockKey, executionPromise);
  return executionPromise;
}
