import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { normalizeToResumeTree, computeContentHash } from '@trace/engine';

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

    const body = await req.json();
    const { action } = body;

    // Fetch the target resume
    const { data: resume, error: resumeErr } = await supabase
      .from('resumes')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (resumeErr || !resume) {
      return NextResponse.json({ error: 'Resume not found' }, { status: 404 });
    }

    // ACTION: RENAME
    if (action === 'rename') {
      const newTitle = (body.title || '').trim();
      if (!newTitle) {
        return NextResponse.json({ error: 'A valid title is required' }, { status: 400 });
      }

      const { error: updateErr } = await supabase
        .from('resumes')
        .update({ title: newTitle, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', user.id);

      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, title: newTitle });
    }

    // ACTION: SET DEFAULT
    if (action === 'set-default') {
      // 1. Clear is_default from all user's resumes
      await supabase
        .from('resumes')
        .update({ is_default: false })
        .eq('user_id', user.id);

      // 2. Set this resume as default
      const { error: setErr } = await supabase
        .from('resumes')
        .update({ is_default: true, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', user.id);

      if (setErr) {
        return NextResponse.json({ error: setErr.message }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    // ACTION: DUPLICATE
    if (action === 'duplicate') {
      // 1. Enforce 5-resume cap
      const { count: currentCount } = await supabase
        .from('resumes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      if ((currentCount || 0) >= 5) {
        return NextResponse.json(
          {
            error:
              'Cannot duplicate resume: you have reached the 5-resume limit. Delete an older resume first.',
          },
          { status: 400 }
        );
      }

      const newTitle = `${resume.title || 'Resume'} (Copy)`;
      const tree = normalizeToResumeTree(resume.parsed);
      const contentHash = computeContentHash(tree);

      const { data: newResume, error: insertErr } = await supabase
        .from('resumes')
        .insert({
          user_id: user.id,
          title: newTitle,
          source: resume.source || 'uploaded',
          file_hash: resume.file_hash,
          is_default: false,
          parse_status: resume.parse_status || 'good',
          parse_warnings: resume.parse_warnings || [],
          parsed: tree,
          storage_path: resume.storage_path,
        })
        .select()
        .single();

      if (insertErr) {
        return NextResponse.json({ error: insertErr.message }, { status: 500 });
      }

      try {
        await supabase.from('resume_versions').insert({
          resume_id: newResume.id,
          kind: 'original',
          version_number: 1,
          tree,
          content_hash: contentHash,
        });
      } catch {
        // Safe fallback
      }

      return NextResponse.json({ success: true, duplicatedResume: newResume });
    }

    // ACTION: RE-READ
    if (action === 're-read') {
      // Resets parse_status and parse_warnings
      const tree = normalizeToResumeTree(resume.parsed);
      const status = tree.experience.length > 0 || tree.education.length > 0 ? 'good' : 'needs_review';

      await supabase
        .from('resumes')
        .update({
          parse_status: status,
          parse_warnings: status === 'good' ? [] : ['Reviewed. Please check missing fields.'],
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('user_id', user.id);

      return NextResponse.json({ success: true, parseStatus: status });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
