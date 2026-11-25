import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateText } from '@/lib/ai/provider';
import { checkRateLimit } from '@/lib/rate-limit';
import { deductInterviewCredit } from '@/lib/credits';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const allowed = await checkRateLimit(user.id, 'interview', 10);
  if (!allowed) {
    return NextResponse.json(
      { error: 'Hourly rate limit exceeded for interview practice (10/hour).' },
      { status: 429 }
    );
  }

  const { applicationId, mode = 'full-round' } = await req.json();

  // Credit check: self-intro is free (up to 5/day), other modes cost 1 credit
  if (mode === 'self-intro') {
    const today = new Date().toISOString().slice(0, 10);
    const { count } = await supabase
      .from('credit_ledger')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .like('reason', 'self-intro:%')
      .gte('created_at', `${today}T00:00:00Z`);

    if ((count ?? 0) >= 5) {
      return NextResponse.json(
        { error: 'Daily free self-introduction limit reached (5/day).' },
        { status: 429 }
      );
    }

    // Log free session usage
    await supabase.from('credit_ledger').insert({
      user_id: user.id,
      delta: 0,
      reason: `self-intro:${applicationId}:${new Date().toISOString()}`,
    });
  } else {
    // Deduct 1 credit via transactional atomic deduction
    const deductResult = await deductInterviewCredit(
      supabase,
      user.id,
      applicationId,
      `${mode} practice session`
    );

    if (!deductResult.success) {
      return NextResponse.json({ error: 'INSUFFICIENT_CREDITS' }, { status: 402 });
    }
  }

  // Load application with JD text, company, title and candidate tailored resume
  const { data: app } = await supabase
    .from('applications')
    .select('tailored, jobs(title, company, raw_text)')
    .eq('id', applicationId)
    .single();

  const rawJob = app?.jobs as unknown as
    | { title?: string; company?: string; raw_text?: string }
    | { title?: string; company?: string; raw_text?: string }[]
    | null;
  const jobData = Array.isArray(rawJob) ? rawJob[0] : rawJob;
  const jobTitle = jobData?.title || 'Target Role';
  const companyName = jobData?.company || 'Hiring Company';
  const jdText = (jobData?.raw_text || '').slice(0, 3500);

  // Mode-specific, JD-grounded interviewer instructions
  let systemPrompt = '';
  let userPrompt = '';

  if (mode === 'self-intro') {
    systemPrompt = `You are the hiring manager for ${jobTitle} at ${companyName}.
You are conducting a 60-second self-introduction round.
The candidate must pitch their background and explain why they fit this specific posting.
Job Description context:
${jdText}

STRICT RULES:
1. Max 25 words.
2. Ask exactly ONE opening question instructing the candidate to introduce themselves and highlight what they have built that aligns with ${companyName}'s requirements for ${jobTitle}.
3. No conversational pleasantries.`;
    userPrompt = `Candidate resume: ${JSON.stringify(app?.tailored)}`;
  } else if (mode === 'project-deepdive') {
    systemPrompt = `You are a principal technical interviewer for ${jobTitle} at ${companyName}.
You are conducting a technical project deep-dive.
Job Description:
${jdText}

STRICT RULES:
1. Max 25 words.
2. Select one technical project or core stack item from the candidate's resume that is critical for ${jobTitle}.
3. Ask a probing question about architectural choices, concurrency, debugging, or technical trade-offs required in that project.
4. No pleasantries. Jump directly into the question.`;
    userPrompt = `Candidate resume: ${JSON.stringify(app?.tailored)}`;
  } else if (mode === 'hr') {
    systemPrompt = `You are an HR and behavioral hiring manager for ${jobTitle} at ${companyName}.
Job Description context:
${jdText}

STRICT RULES:
1. Max 25 words.
2. Ask exactly ONE behavioral question evaluating cultural fit, cross-functional collaboration, or how they handle ambiguity or tight deadlines for this specific role at ${companyName}.
3. No pleasantries.`;
    userPrompt = `Candidate resume: ${JSON.stringify(app?.tailored)}`;
  } else {
    // full-round
    systemPrompt = `You are the lead engineering hiring manager conducting a technical pre-screen for ${jobTitle} at ${companyName}.
Job Description:
${jdText}

STRICT RULES:
1. Max 25 words.
2. Ask ONE sharp opening question prompting the candidate to walk through their most relevant technical implementation and how it directly prepares them for ${jobTitle} at ${companyName}.
3. No pleasantries.`;
    userPrompt = `Candidate resume: ${JSON.stringify(app?.tailored)}`;
  }

  const rawQuestion = await generateText({
    tier: 'fast',
    userId: user.id,
    task: 'interview_start',
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: userPrompt,
      },
    ],
  });

  // Code-enforced max 25 words
  const words = rawQuestion.trim().split(/\s+/);
  const firstQuestion =
    words.length > 25 ? words.slice(0, 25).join(' ') + '?' : rawQuestion.trim();

  const { data: session, error } = await supabase
    .from('interview_sessions')
    .insert({
      application_id: applicationId,
      user_id: user.id,
      mode,
      transcript: [{ speaker: 'interviewer', text: firstQuestion, timestamp: Date.now() }],
    })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ sessionId: session?.id, firstQuestion, mode });
}
