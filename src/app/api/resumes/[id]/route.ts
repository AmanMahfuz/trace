import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { normalizeToResumeTree, computeContentHash, ResumeTree } from '@trace/engine';

export async function GET(
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

    // 1. Fetch resume record
    const { data: resume, error: resumeErr } = await supabase
      .from('resumes')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (resumeErr || !resume) {
      return NextResponse.json({ error: 'Resume not found' }, { status: 404 });
    }

    // 2. Fetch versions from resume_versions
    let versions: Array<{
      id: string;
      kind: 'original' | 'edited' | 'tailored';
      version_number: number;
      tree: ResumeTree;
      content_hash: string;
      created_at: string;
      application_id?: string;
    }> = [];

    try {
      const { data: vData } = await supabase
        .from('resume_versions')
        .select('*')
        .eq('resume_id', id)
        .order('version_number', { ascending: false });

      if (vData && vData.length > 0) {
        versions = vData.map((v) => ({
          ...v,
          tree: normalizeToResumeTree(v.tree),
        }));
      }
    } catch {
      // Table may not exist yet
    }

    // 3. Determine activeTree and originalTree
    const originalVersion = versions.find((v) => v.kind === 'original');
    const originalTree = originalVersion
      ? originalVersion.tree
      : normalizeToResumeTree(resume.parsed);

    // Latest version is the top one (ordered by version_number desc)
    const latestVersion = versions[0];
    const activeTree = latestVersion ? latestVersion.tree : originalTree;
    const currentVersionNumber = latestVersion ? latestVersion.version_number : 1;

    // 4. Fetch associated applications
    const versionIds = versions.map((v) => v.id);
    const { data: apps } = await supabase
      .from('applications')
      .select('id, role, company, created_at, resume_version_id, resume_id')
      .eq('user_id', user.id);

    const matchingApps = (apps || []).filter(
      (a) => a.resume_id === id || (a.resume_version_id && versionIds.includes(a.resume_version_id))
    );

    // Attach application names to tailored versions
    const enrichedVersions = versions.map((v) => {
      if (v.kind === 'tailored' && v.application_id) {
        const app = matchingApps.find((a) => a.id === v.application_id);
        return {
          ...v,
          applicationTitle: app ? `${app.role} · ${app.company}` : undefined,
        };
      }
      return v;
    });

    const parts = (resume.storage_path || '').split('/');
    const rawName = parts.pop() || 'resume.pdf';
    const cleanFileName = rawName.replace(/^\d+_/, '') || rawName;

    return NextResponse.json({
      resume: {
        id: resume.id,
        title: resume.title || cleanFileName.replace(/\.pdf$/i, '') || 'Untitled Resume',
        source: resume.source || 'uploaded',
        isDefault: Boolean(resume.is_default),
        parseStatus: resume.parse_status || 'good',
        parseWarnings: Array.isArray(resume.parse_warnings) ? resume.parse_warnings : [],
        updatedAt: resume.updated_at || resume.created_at,
        createdAt: resume.created_at,
        fileName: cleanFileName,
      },
      activeTree,
      originalTree,
      currentVersionNumber,
      versions: enrichedVersions,
      applications: matchingApps.map((a) => ({
        id: a.id,
        role: a.role,
        company: a.company,
        createdAt: a.created_at,
      })),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(
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
    const { tree, expectedVersion, title } = body;

    if (!tree) {
      return NextResponse.json({ error: 'Resume tree payload is required' }, { status: 400 });
    }

    // Verify resume ownership
    const { data: resume, error: resumeErr } = await supabase
      .from('resumes')
      .select('id, title')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (resumeErr || !resume) {
      return NextResponse.json({ error: 'Resume not found' }, { status: 404 });
    }

    // Optimistic Concurrency Control
    if (typeof expectedVersion === 'number') {
      try {
        const { data: latest } = await supabase
          .from('resume_versions')
          .select('version_number')
          .eq('resume_id', id)
          .order('version_number', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (latest && latest.version_number !== expectedVersion) {
          return NextResponse.json(
            {
              error:
                'Conflict: This resume was modified in another tab or session. Please reload to see the latest version before saving.',
              conflict: true,
              currentVersion: latest.version_number,
            },
            { status: 409 }
          );
        }
      } catch {
        // Fallback
      }
    }

    const normalizedTree = normalizeToResumeTree(tree);
    const contentHash = computeContentHash(normalizedTree);
    const nextVersionNumber = (expectedVersion || 1) + 1;
    const now = new Date().toISOString();

    // 1. Update resumes table
    const updatePayload: Record<string, unknown> = {
      parsed: normalizedTree,
      updated_at: now,
    };
    if (title && typeof title === 'string') {
      updatePayload.title = title.trim();
    }

    const { error: updateErr } = await supabase
      .from('resumes')
      .update(updatePayload)
      .eq('id', id)
      .eq('user_id', user.id);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    // 2. Insert new version into resume_versions
    try {
      await supabase.from('resume_versions').insert({
        resume_id: id,
        kind: 'edited',
        version_number: nextVersionNumber,
        tree: normalizedTree,
        content_hash: contentHash,
      });
    } catch {
      // Safe fallback if table not yet migrated
    }

    return NextResponse.json({
      success: true,
      versionNumber: nextVersionNumber,
      updatedAt: now,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
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

    // Check applications count using this resume
    const { data: apps } = await supabase
      .from('applications')
      .select('id')
      .eq('user_id', user.id)
      .eq('resume_id', id);

    const applicationsRetainedCount = apps ? apps.length : 0;

    const { error } = await supabase
      .from('resumes')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      applicationsRetainedCount,
      message: `Resume deleted. ${applicationsRetainedCount} past application analysis snapshots were preserved.`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
