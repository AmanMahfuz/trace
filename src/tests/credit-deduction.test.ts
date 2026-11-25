import { describe, it, expect, vi } from 'vitest';
import { deductInterviewCredit } from '@/lib/credits';
import { SupabaseClient } from '@supabase/supabase-js';

describe('Transactional Credit Deduction', () => {
  it('deducts exactly 1 credit when two simultaneous start requests fire concurrently', async () => {
    let currentCredits = 3;
    const ledger: Array<{ user_id: string; delta: number; reason: string }> = [];
    const userId = 'user-race-123';
    const applicationId = 'app-race-456';

    const mockSupabase = {
      rpc: vi.fn().mockResolvedValue({ data: null, error: new Error('RPC not configured') }),
      from: vi.fn((table: string) => {
        if (table === 'interview_sessions') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            gt: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          };
        }
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn(() => {
              return {
                single: vi.fn().mockImplementation(async () => {
                  return { data: { credits: currentCredits }, error: null };
                }),
                gt: vi.fn().mockReturnThis(),
                select: vi.fn().mockReturnThis(),
              };
            }),
            update: vi.fn((fields: { credits: number }) => {
              return {
                eq: vi.fn().mockReturnThis(),
                gt: vi.fn().mockReturnThis(),
                select: vi.fn().mockReturnThis(),
                single: vi.fn().mockImplementation(async () => {
                  currentCredits = fields.credits;
                  return { data: { credits: currentCredits }, error: null };
                }),
              };
            }),
          };
        }
        if (table === 'credit_ledger') {
          return {
            insert: vi.fn().mockImplementation(async (entry: { user_id: string; delta: number; reason: string }) => {
              ledger.push(entry);
              return { data: null, error: null };
            }),
          };
        }
        return {} as unknown;
      }),
    } as unknown as SupabaseClient;

    // Fire two simultaneous interview start requests for the same application
    const [req1, req2] = await Promise.all([
      deductInterviewCredit(mockSupabase, userId, applicationId, 'Simultaneous Start 1'),
      deductInterviewCredit(mockSupabase, userId, applicationId, 'Simultaneous Start 2'),
    ]);

    // Exactly one was charged, one was protected against double deduction
    const chargedCount = (req1.charged ? 1 : 0) + (req2.charged ? 1 : 0);
    expect(chargedCount).toBe(1);

    // Both succeeded and received valid status
    expect(req1.success).toBe(true);
    expect(req2.success).toBe(true);

    // Profile credits decremented by exactly 1 (from 3 down to 2)
    expect(currentCredits).toBe(2);

    // Exactly one entry in credit_ledger
    expect(ledger.length).toBe(1);
    expect(ledger[0].delta).toBe(-1);
    expect(ledger[0].user_id).toBe(userId);
  });

  it('rejects credit deduction when user balance is insufficient', async () => {
    const mockSupabase = {
      rpc: vi.fn().mockResolvedValue({ data: null, error: new Error('RPC not configured') }),
      from: vi.fn((table: string) => {
        if (table === 'interview_sessions') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            gt: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          };
        }
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { credits: 0 }, error: null }),
            }),
          };
        }
        return {} as unknown;
      }),
    } as unknown as SupabaseClient;

    const res = await deductInterviewCredit(
      mockSupabase,
      'user-poor-000',
      'app-test-999',
      'Test Session'
    );

    expect(res.success).toBe(false);
    expect(res.charged).toBe(false);
    expect(res.error).toBe('INSUFFICIENT_CREDITS');
  });
});
