import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { outcome } = await req.json();

  const validOutcomes = ['applied', 'interview', 'rejected', 'ghosted', 'offer', 'interview_no_offer'];
  if (!validOutcomes.includes(outcome)) {
    return NextResponse.json({ error: 'Invalid outcome type' }, { status: 400 });
  }

  const { error } = await supabase
    .from('applications')
    .update({
      outcome,
      outcome_at: new Date().toISOString(),
      status: outcome === 'applied' ? 'applied' : 'closed',
    })
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
