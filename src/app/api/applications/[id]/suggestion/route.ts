import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateJSON } from '@/lib/ai/provider';
import { z } from 'zod';
import { Resume, TailorSuggestion } from '@/lib/schemas';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { bulletId, action, detail } = await req.json();
  const { data: app, error } = await supabase
    .from('applications')
    .select('tailored, suggestions')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (error || !app) {
    return NextResponse.json({ error: 'Application record not found' }, { status: 404 });
  }

  const tailored: Resume = app.tailored;
  const suggestions: TailorSuggestion[] = app.suggestions || [];
  const targetSuggestion = suggestions.find((s) => s.bullet_id === bulletId);

  if (!targetSuggestion) {
    return NextResponse.json({ error: 'Bullet suggestion mapping not found' }, { status: 404 });
  }

  if (action === 'accept') {
    let finalBulletText = targetSuggestion.suggested;

    if (detail && typeof detail === 'string') {
      const generated = await generateJSON({
        tier: 'mid',
        userId: user.id,
        task: 'regenerate_bullet_with_detail',
        schema: z.object({ rewritten_bullet: z.string() }),
        system:
          'Rewrite the resume bullet incorporating the user-supplied details strictly. Never add fabricated facts or metrics.',
        prompt: `Original bullet: ${targetSuggestion.original}\nCandidate Detail: ${detail}`,
      });
      finalBulletText = generated.rewritten_bullet;
    }

    if (finalBulletText) {
      tailored.experience?.forEach((e) => {
        e.bullets?.forEach((b) => {
          if (b.id === bulletId) b.text = finalBulletText!;
        });
      });
      tailored.projects?.forEach((p) => {
        p.bullets?.forEach((b) => {
          if (b.id === bulletId) b.text = finalBulletText!;
        });
      });

      const updatedSuggestions = suggestions.filter((s) => s.bullet_id !== bulletId);

      await supabase
        .from('applications')
        .update({ tailored, suggestions: updatedSuggestions })
        .eq('id', id);

      return NextResponse.json({ success: true, tailored, suggestions: updatedSuggestions });
    }

    // No rewrite text available (suggestion had no text and no detail provided) — just dismiss
    const updatedSuggestionsNoText = suggestions.filter((s) => s.bullet_id !== bulletId);
    await supabase
      .from('applications')
      .update({ suggestions: updatedSuggestionsNoText })
      .eq('id', id);
    return NextResponse.json({ success: true, tailored, suggestions: updatedSuggestionsNoText });
  }

  if (action === 'decline') {
    const updatedSuggestions = suggestions.filter((s) => s.bullet_id !== bulletId);
    await supabase
      .from('applications')
      .update({ suggestions: updatedSuggestions })
      .eq('id', id);

    return NextResponse.json({ success: true, tailored, suggestions: updatedSuggestions });
  }

  return NextResponse.json({ success: true, tailored, suggestions });
}
