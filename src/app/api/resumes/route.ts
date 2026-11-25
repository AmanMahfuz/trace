import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import crypto from 'crypto';
import { extractText } from 'unpdf';
import { runIngestAgent } from '@trace/engine';
import { normalizeToResumeTree, computeContentHash, runFormatChecks } from '@trace/engine';
import { router } from '@/lib/ai/provider';
import { v4 as uuidv4 } from 'uuid';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient(req);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Fetch user's resumes
    const { data: resumes, error: resumeErr } = await supabase
      .from('resumes')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (resumeErr) {
      return NextResponse.json({ error: resumeErr.message }, { status: 500 });
    }

    // 2. Fetch user's applications to calculate application counts per resume
    const { data: apps } = await supabase
      .from('applications')
      .select('id, role, company, resume_id, resume_version_id')
      .eq('user_id', user.id);

    // 3. Format resumes list with format checks and metadata
    const formatted = (resumes || []).map((r) => {
      const parts = (r.storage_path || '').split('/');
      const rawName = parts.pop() || 'resume.pdf';
      const cleanFileName = rawName.replace(/^\d+_/, '') || rawName;
      const title = r.title || cleanFileName.replace(/\.pdf$/i, '') || 'Untitled Resume';

      // Normalize parsed tree to run real-time format checks
      const tree = normalizeToResumeTree(r.parsed);
      const formatResult = runFormatChecks(tree);

      // Associated applications count
      const matchingApps = (apps || []).filter(
        (a) => a.resume_id === r.id || (r.version_ids && r.version_ids.includes(a.resume_version_id))
      );

      // Parse status fallback if not yet set in database
      let parseStatus: 'good' | 'needs_review' | 'failed' = r.parse_status || 'good';
      if (!r.parse_status) {
        if (!r.parsed || (typeof r.parsed === 'object' && Object.keys(r.parsed).length === 0)) {
          parseStatus = 'failed';
        } else if (tree.experience.length === 0 && tree.education.length === 0) {
          parseStatus = 'needs_review';
        }
      }

      return {
        id: r.id,
        title,
        source: r.source || 'uploaded',
        isDefault: Boolean(r.is_default),
        parseStatus,
        parseWarnings: Array.isArray(r.parse_warnings) ? r.parse_warnings : [],
        updatedAt: r.updated_at || r.created_at,
        createdAt: r.created_at,
        fileName: cleanFileName,
        applicationsCount: matchingApps.length,
        applications: matchingApps.map((a) => ({ id: a.id, role: a.role, company: a.company })),
        formatSummary: {
          passed: formatResult.passed,
          issuesCount: formatResult.issuesCount,
          opportunitiesCount: formatResult.opportunitiesCount,
        },
        tree,
      };
    });

    // Sort by default first, then updated_at descending
    formatted.sort((a, b) => {
      if (a.isDefault && !b.isDefault) return -1;
      if (!a.isDefault && b.isDefault) return 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

    return NextResponse.json({
      resumes: formatted,
      totalCount: formatted.length,
      maxAllowed: 5,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient(req);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Enforce 5-resume cap on the free plan
    const { count: currentCount, error: countErr } = await supabase
      .from('resumes')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    if (countErr) {
      return NextResponse.json({ error: countErr.message }, { status: 500 });
    }

    if ((currentCount || 0) >= 5) {
      return NextResponse.json(
        {
          error:
            'You have reached the 5-resume limit on your account. Delete an older resume to add or build a new one.',
          limitReached: true,
        },
        { status: 400 }
      );
    }

    const contentType = req.headers.get('content-type') || '';

    // CASE A: Build with Trace (Blank / Structured Starter Resume)
    if (contentType.includes('application/json')) {
      const body = await req.json();
      const title = (body.title || 'Untitled Resume').trim();

      const starterTree = normalizeToResumeTree({
        contact: {
          name: user.user_metadata?.full_name || 'Candidate Name',
          email: user.email || '',
        },
        summary: '',
        experience: [],
        education: [],
        projects: [],
        skills: [],
      });

      const contentHash = computeContentHash(starterTree);
      const isFirst = (currentCount || 0) === 0;

      const { data: newResume, error: insertErr } = await supabase
        .from('resumes')
        .insert({
          user_id: user.id,
          title,
          source: 'built',
          is_default: isFirst,
          parse_status: 'good',
          parse_warnings: [],
          parsed: starterTree,
        })
        .select()
        .single();

      if (insertErr) {
        return NextResponse.json({ error: insertErr.message }, { status: 500 });
      }

      // Also create version 1 in resume_versions if available
      try {
        await supabase.from('resume_versions').insert({
          resume_id: newResume.id,
          kind: 'original',
          version_number: 1,
          tree: starterTree,
          content_hash: contentHash,
        });
      } catch {
        // Safe fallback if table not yet migrated
      }

      return NextResponse.json({
        success: true,
        resume: {
          id: newResume.id,
          title,
          source: 'built',
          isDefault: isFirst,
          parseStatus: 'good',
          parseWarnings: [],
          updatedAt: newResume.created_at,
          createdAt: newResume.created_at,
          tree: starterTree,
        },
      });
    }

    // CASE B: Upload and Parse PDF
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file || file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'A valid PDF file is required' }, { status: 400 });
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size must not exceed 5MB' }, { status: 400 });
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());

    // 2. Hash the file first for deduplication
    const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    // Check if duplicate hash exists for this user
    const { data: existingDuplicate } = await supabase
      .from('resumes')
      .select('id, title, storage_path')
      .eq('user_id', user.id)
      .eq('file_hash', fileHash)
      .maybeSingle();

    if (existingDuplicate) {
      return NextResponse.json({
        duplicate: true,
        existingId: existingDuplicate.id,
        title: existingDuplicate.title || 'Existing Resume',
        message: 'This resume has already been uploaded.',
      });
    }

    // 3. Extract text from PDF
    let textToParse = '';
    try {
      const { text: unpdfText } = await extractText(new Uint8Array(fileBuffer));
      textToParse = Array.isArray(unpdfText) ? unpdfText.join('\n') : String(unpdfText || '');
    } catch {
      // Fallback
    }

    if (!textToParse || textToParse.trim().length < 50) {
      textToParse = fileBuffer.toString('utf-8', 0, 15000);
    }

    // 4. Run Ingest agent to parse structured resume
    let ingestResult;
    let parseStatus: 'good' | 'needs_review' | 'failed' = 'good';
    const parseWarnings: string[] = [];

    try {
      ingestResult = await runIngestAgent({
        rawText: textToParse,
        router,
        userId: user.id,
        generateId: () => uuidv4(),
      });

      if (!textToParse || textToParse.trim().length < 50) {
        parseStatus = 'needs_review';
        parseWarnings.push('Text extraction was minimal. Please verify all sections.');
      }
    } catch (ingestErr) {
      console.error('[Ingest] Failed parsing resume:', ingestErr);
      parseStatus = 'failed';
      parseWarnings.push('Automatic parsing encountered an error. You can re-read or edit directly.');
      ingestResult = {
        resume: {
          contact: { name: file.name.replace(/\.pdf$/i, '') },
          experience: [],
          education: [],
          projects: [],
          skills: [],
        },
      };
    }

    const normalizedTree = normalizeToResumeTree(ingestResult.resume);
    const contentHash = computeContentHash(normalizedTree);
    const isFirst = (currentCount || 0) === 0;
    const title = file.name.replace(/\.pdf$/i, '').trim() || 'Uploaded Resume';

    // 5. Insert into resumes table
    const { data: newResume, error: insertErr } = await supabase
      .from('resumes')
      .insert({
        user_id: user.id,
        title,
        source: 'uploaded',
        file_hash: fileHash,
        is_default: isFirst,
        parse_status: parseStatus,
        parse_warnings: parseWarnings,
        parsed: ingestResult.resume,
        storage_path: `resumes/${user.id}/${Date.now()}_${file.name}`,
      })
      .select()
      .single();

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    // 6. Insert initial version into resume_versions table
    try {
      await supabase.from('resume_versions').insert({
        resume_id: newResume.id,
        kind: 'original',
        version_number: 1,
        tree: normalizedTree,
        content_hash: contentHash,
      });
    } catch {
      // Safe fallback if table not yet migrated
    }

    return NextResponse.json({
      success: true,
      resume: {
        id: newResume.id,
        title,
        source: 'uploaded',
        isDefault: isFirst,
        parseStatus,
        parseWarnings,
        updatedAt: newResume.created_at,
        createdAt: newResume.created_at,
        tree: normalizedTree,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
