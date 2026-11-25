import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateJSON } from '@/lib/ai/provider';
import { z } from 'zod';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { sessionId, transcript, metrics } = await req.json();

  const ScorecardSchema = z.object({
    readiness_score: z.number().min(0).max(100),
    star_completeness: z.object({
      situation: z.number().min(0).max(100),
      task: z.number().min(0).max(100),
      action: z.number().min(0).max(100),
      result: z.number().min(0).max(100),
    }),
    top_answer_rewrites: z
      .array(
        z.object({
          question: z.string(),
          user_said: z.string(),
          stronger_version: z.string(),
        })
      )
      .max(3),
  });

  const scorecard = await generateJSON({
    tier: 'strong',
    userId: user.id,
    task: 'interview_grading',
    schema: ScorecardSchema,
    system:
      'Grade the interview session transcript strictly using STAR framework metrics (0-100 each). Pick the 3 weakest answers and produce stronger versions grounded solely in facts from the candidate resume or dialogue. Never fabricate experience.',
    prompt: `Interview Transcript: ${JSON.stringify(transcript)}`,
  });

  await supabase
    .from('interview_sessions')
    .update({
      scorecard,
      metrics,
      ended_at: new Date().toISOString(),
    })
    .eq('id', sessionId)
    .eq('user_id', user.id);

  return NextResponse.json({ success: true, scorecard });
}
