import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as handleOutcomePost } from '../app/api/applications/[id]/outcome/route';

// Mock Supabase server client
const mockUpdate = vi.fn();
const mockEq = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: 'test-user-123' } },
      })),
    },
    from: vi.fn(() => ({
      update: mockUpdate.mockReturnValue({
        eq: mockEq.mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
    })),
  })),
}));

describe('Application Outcome API Boundary', () => {
  it('rejects invalid outcome strings with HTTP 400', async () => {
    const req = new NextRequest('http://localhost:3000/api/applications/app-1/outcome', {
      method: 'POST',
      body: JSON.stringify({ outcome: 'not_a_valid_outcome' }),
    });

    const res = await handleOutcomePost(req, {
      params: Promise.resolve({ id: 'app-1' }),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Invalid outcome type');
  });

  it('accepts valid outcome and updates status to closed', async () => {
    const req = new NextRequest('http://localhost:3000/api/applications/app-1/outcome', {
      method: 'POST',
      body: JSON.stringify({ outcome: 'rejected' }),
    });

    const res = await handleOutcomePost(req, {
      params: Promise.resolve({ id: 'app-1' }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: 'rejected',
        status: 'closed',
      })
    );
  });
});
