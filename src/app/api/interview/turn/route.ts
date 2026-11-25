import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateText } from '@/lib/ai/provider';

interface TranscriptItem {
  speaker: string;
  text: string;
  timestamp: number;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { sessionId, userAnswer } = await req.json();

  const { data: session, error } = await supabase
    .from('interview_sessions')
    .select('mode, transcript, applications(tailored, jobs(title, company, raw_text))')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .single();

  if (error || !session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

  const rawApp = session.applications as unknown as {
    tailored?: Record<string, unknown>;
    jobs?:
      | { title?: string; company?: string; raw_text?: string }
      | { title?: string; company?: string; raw_text?: string }[];
  } | null;
  const rawJob = rawApp?.jobs;
  const jobData = Array.isArray(rawJob) ? rawJob[0] : rawJob;
  const jobTitle = jobData?.title || 'Target Role';
  const companyName = jobData?.company || 'Hiring Company';
  const jdText = (jobData?.raw_text || '').slice(0, 3500);
  const mode = (session as { mode?: string }).mode || 'full-round';

  const updatedTranscript: TranscriptItem[] = [
    ...(session.transcript as TranscriptItem[]),
    { speaker: 'user', text: userAnswer, timestamp: Date.now() },
  ];

  const userTurnsCount = updatedTranscript.filter((t) => t.speaker === 'user').length;
  const maxTurns = mode === 'self-intro' ? 1 : mode === 'full-round' ? 5 : 3;
  const isConclusion = userTurnsCount >= maxTurns;

  let nextQuestion = '';

  if (isConclusion) {
    nextQuestion = `Thank you. That completes the ${mode === 'self-intro' ? 'self-introduction' : mode === 'project-deepdive' ? 'project deep-dive' : mode === 'hr' ? 'HR interview' : 'simulation'} for ${jobTitle} at ${companyName}.`;
  } else {
    const rawQuestion = await generateText({
      tier: 'fast',
      userId: user.id,
      task: 'interview_turn',
      system: `You are the hiring manager conducting a ${mode} interview for ${jobTitle} at ${companyName}.
Target Job Description:
${jdText}

Candidate resume context:
${JSON.stringify(rawApp?.tailored)}

STRICT RULES:
1. Max 25 words. Ask exactly ONE direct question.
2. Cross-examine the candidate's last answer directly against the requirements, tools, and technical challenges demanded in the Job Description.
3. If they gave a vague or buzzword-heavy response, challenge them to provide concrete technical details, trade-offs, or production metrics.
4. No pleasantries or filler. Jump straight to the question.`,
      messages: updatedTranscript.map((t) => ({
        role: t.speaker === 'user' ? ('user' as const) : ('assistant' as const),
        content: t.text,
      })),
    });

    // Code-enforced max 25 words
    const words = rawQuestion.trim().split(/\s+/);
    nextQuestion =
      words.length > 25 ? words.slice(0, 25).join(' ') + '?' : rawQuestion.trim();
  }

  updatedTranscript.push({ speaker: 'interviewer', text: nextQuestion, timestamp: Date.now() });

  await supabase
    .from('interview_sessions')
    .update({ transcript: updatedTranscript })
    .eq('id', sessionId);

  return NextResponse.json({
    nextQuestion,
    reply: nextQuestion,
    isConclusion,
    turnIndex: userTurnsCount + 1,
  });
}
