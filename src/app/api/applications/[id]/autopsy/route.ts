import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateJSON } from '@/lib/ai/provider';
import { AutopsyResultSchema } from '@/lib/schemas';

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

  const { data: app, error } = await supabase
    .from('applications')
    .select('odds, ghost, tailored, outcome, autopsy, jobs(title, company)')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (error || !app) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 });
  }

  // If already generated, return cached autopsy with application context
  if (app.autopsy) {
    return NextResponse.json({ autopsy: app.autopsy, application: app });
  }

  const autopsy = await generateJSON({
    tier: 'strong',
    userId: user.id,
    task: 'rejection_autopsy',
    schema: AutopsyResultSchema,
    system:
      'You are an honest career diagnostic strategist analyzing an application outcome. State likely reasons strictly as inferences from the stored odds breakdown and signals. All reasons MUST be explicitly labelled as "most likely", never as absolute fact. Provide a maximum 3-step action fix plan. If outcome is "ghosted", generate a polite, concise follow-up email draft.',
    prompt: `Recorded Outcome: ${app.outcome || 'rejected'}\nInitial Diagnostic Odds: ${JSON.stringify(
      app.odds
    )}\nGhost Signals: ${JSON.stringify(app.ghost)}`,
  });

  await supabase
    .from('applications')
    .update({ autopsy })
    .eq('id', id);

  return NextResponse.json({ autopsy, application: app });
}
