import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { router } from '@/lib/ai/provider';
import { verifyRewriteWithFactLock } from '@trace/engine';
import { z } from 'zod';

// Simple in-memory rate limiting map: userId -> { count: number, date: string }
const dailyUsageTracker = new Map<string, { count: number; date: string }>();

function checkAndIncrementRateLimit(userId: string): { allowed: boolean; remaining: number } {
  const today = new Date().toISOString().slice(0, 10);
  const userRecord = dailyUsageTracker.get(userId);

  if (!userRecord || userRecord.date !== today) {
    dailyUsageTracker.set(userId, { count: 1, date: today });
    return { allowed: true, remaining: 19 };
  }

  if (userRecord.count >= 20) {
    return { allowed: false, remaining: 0 };
  }

  userRecord.count += 1;
  dailyUsageTracker.set(userId, userRecord);
  return { allowed: true, remaining: 20 - userRecord.count };
}

const QuestionsSchema = z.object({
  questions: z.array(z.string()).max(3),
});

const SuggestionSchema = z.object({
  suggestion: z.string(),
});

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const supabase = await createClient(req);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: resume } = await supabase
      .from('resumes')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!resume) {
      return NextResponse.json({ error: 'Resume not found' }, { status: 404 });
    }

    const { allowed, remaining } = checkAndIncrementRateLimit(user.id);
    if (!allowed) {
      return NextResponse.json(
        {
          error: 'Daily AI helper limit reached (20/day). You can edit bullets directly.',
          limitReached: true,
        },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { action } = body;

    // HELPER 1: SUGGEST WORDING
    if (action === 'suggest-wording') {
      const bulletText = (body.bulletText || '').trim();
      if (!bulletText) {
        return NextResponse.json({ error: 'Bullet text is required' }, { status: 400 });
      }

      try {
        const result = await router.json({
          tier: 'fast',
          task: 'resume_bullet_suggest',
          promptVersion: 'suggest@1',
          sensitivity: 'personal',
          schema: SuggestionSchema,
          temperature: 0.2,
          userId: user.id,
          system:
            'You are an expert ATS resume editor. Rewrite the candidate bullet to start with a strong action verb, remove filler words, and tighten phrasing. CRITICAL: Strictly stick to facts explicitly provided. NEVER invent numbers, percentages, tools, or projects.',
          prompt: `Original bullet:\n"${bulletText}"\n\nProvide a punchy, factual single-sentence rewrite.`,
        });

        const suggested = result.data.suggestion.trim();
        // Fact-Lock check
        const factCheck = verifyRewriteWithFactLock(suggested, [bulletText]);

        if (!factCheck.passed) {
          // If fact-lock flagged tokens, fall back to safe clean version
          return NextResponse.json({
            suggestion: bulletText.replace(/^(Responsible for|Worked on|Helped with)\s*/i, 'Delivered '),
            factLocked: true,
            warning: 'Adjusted wording to stay strictly within verified facts.',
            remainingUses: remaining,
          });
        }

        return NextResponse.json({
          suggestion: suggested,
          factLocked: true,
          remainingUses: remaining,
        });
      } catch (err) {
        console.warn('[suggest-wording] AI provider fallback:', err);
        // Graceful degradation when AI fails
        const cleaned = bulletText
          .replace(/^(I was responsible for|Responsible for|Handled|Assisted in)\s*/i, 'Built ')
          .trim();
        return NextResponse.json({
          suggestion: cleaned,
          fallback: true,
          remainingUses: remaining,
        });
      }
    }

    // HELPER 2: ASK QUESTIONS
    if (action === 'ask-questions') {
      const bulletText = (body.bulletText || '').trim();
      if (!bulletText) {
        return NextResponse.json({ error: 'Bullet text is required' }, { status: 400 });
      }

      try {
        const result = await router.json({
          tier: 'fast',
          task: 'resume_bullet_questions',
          promptVersion: 'questions@1',
          sensitivity: 'personal',
          schema: QuestionsSchema,
          temperature: 0.3,
          userId: user.id,
          system:
            'You are an expert technical interviewer helping a candidate add concrete evidence to their resume bullet. Generate 2 to 3 short, targeted questions asking for specific metrics, scale, technologies, or outcomes.',
          prompt: `Candidate bullet:\n"${bulletText}"\n\nReturn up to 3 targeted questions to elicit missing numbers, tools, or scope.`,
        });

        return NextResponse.json({
          questions: result.data.questions.slice(0, 3),
          remainingUses: remaining,
        });
      } catch (err) {
        console.warn('[ask-questions] AI provider fallback:', err);
        return NextResponse.json({
          questions: [
            'What quantitative metric changed (e.g. % speedup, data volume, error reduction)?',
            'Which specific tools, libraries, or frameworks did you use?',
          ],
          fallback: true,
          remainingUses: remaining,
        });
      }
    }

    // HELPER 3: APPLY ANSWERS
    if (action === 'apply-answers') {
      const originalBullet = (body.originalBullet || '').trim();
      const questions: string[] = Array.isArray(body.questions) ? body.questions : [];
      const answers: string[] = Array.isArray(body.answers) ? body.answers : [];

      if (!originalBullet) {
        return NextResponse.json({ error: 'Original bullet is required' }, { status: 400 });
      }

      const qnaContext = questions
        .map((q, idx) => `Q: ${q}\nA: ${answers[idx] || '(No answer provided)'}`)
        .join('\n');

      try {
        const result = await router.json({
          tier: 'fast',
          task: 'resume_bullet_synthesize',
          promptVersion: 'synthesize@1',
          sensitivity: 'personal',
          schema: SuggestionSchema,
          temperature: 0.2,
          userId: user.id,
          system:
            'You are a resume bullet synthesizer. Combine the candidate original bullet and the answers they just provided into a concise, high-impact bullet starting with a strong action verb. Include only the facts from the original bullet and user answers.',
          prompt: `Original bullet:\n"${originalBullet}"\n\nCandidate answers:\n${qnaContext}\n\nCombine into one polished bullet.`,
        });

        const newBullet = result.data.suggestion.trim();
        // Fact-lock allows both original bullet and user answers as ground truth!
        const factCheck = verifyRewriteWithFactLock(newBullet, [originalBullet, ...answers]);

        return NextResponse.json({
          newBullet,
          factLocked: factCheck.passed,
          remainingUses: remaining,
        });
      } catch (err) {
        console.warn('[apply-answers] AI provider fallback:', err);
        const answeredParts = answers.filter(Boolean).join('; ');
        const fallbackBullet = answeredParts
          ? `${originalBullet} (${answeredParts})`
          : originalBullet;
        return NextResponse.json({
          newBullet: fallbackBullet,
          fallback: true,
          remainingUses: remaining,
        });
      }
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
