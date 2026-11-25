import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { extractText } from 'unpdf';
import { createClient } from '@/lib/supabase/server';
import { router } from '@/lib/ai/provider';
import { Resume } from '@/lib/schemas';
import { scrapeJobUrl } from '@/lib/scrape';
import { evaluateGhostRisk } from '@/lib/ghost';
import {
  computeOdds,
  computeSkillCoverage,
  computeProofStrength,
  computeLevelFit,
  computeApplicationQuality,
  JobRequirementItem,
} from '@/lib/odds';
import { checkRateLimit } from '@/lib/rate-limit';
import { checkEligibility, EligibilityCriteria } from '@/lib/eligibility';
import { SupabaseClient } from '@supabase/supabase-js';
import {
  runIngestAgent,
  runJobReaderAgent,
  runMatcherAgent,
  runTailorAgent,
} from '@trace/engine';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient(req);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const allowed = await checkRateLimit(user.id, 'analyze', 10);
    if (!allowed) {
      return NextResponse.json(
        { error: 'Hourly rate limit exceeded (10/hour). Please wait before running another analysis.' },
        { status: 429 }
      );
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const resumeIdInput = formData.get('resumeId') as string | null;
    const jobUrl = formData.get('jobUrl') as string | null;
    const jobText = formData.get('jobText') as string | null;

    let targetResumeId: string;
    let existingParsedResume: Resume | null = null;
    let textToParse = '';

    if (resumeIdInput) {
      // Reuse existing saved resume by ID (skip re-upload and re-parse)
      const { data: existingResume, error: resumeFetchErr } = await supabase
        .from('resumes')
        .select('id, parsed, storage_path')
        .eq('id', resumeIdInput)
        .eq('user_id', user.id)
        .single();

      if (!existingResume || resumeFetchErr) {
        return NextResponse.json({ error: 'Saved resume not found' }, { status: 404 });
      }

      targetResumeId = existingResume.id;
      existingParsedResume = existingResume.parsed as unknown as Resume;
    } else {
      if (!file || file.type !== 'application/pdf') {
        return NextResponse.json({ error: 'A valid PDF resume is required' }, { status: 400 });
      }

      if (file.size > 5 * 1024 * 1024) {
        return NextResponse.json({ error: 'File size must not exceed 5MB' }, { status: 400 });
      }

      // 1. Upload Resume PDF to private Supabase Storage
      const fileBuffer = Buffer.from(await file.arrayBuffer());
      const storagePath = `${user.id}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '')}`;

      const { error: storageError } = await supabase.storage
        .from('resumes-raw')
        .upload(storagePath, fileBuffer, { contentType: 'application/pdf' });

      if (storageError) {
        console.warn('Storage upload notice:', storageError.message);
      }

      // 2. Quick CPU text extraction via unpdf (<100ms)
      try {
        const { text: unpdfText } = await extractText(new Uint8Array(fileBuffer));
        textToParse = Array.isArray(unpdfText) ? unpdfText.join('\n') : String(unpdfText || '');
      } catch (pdfErr) {
        console.warn('unpdf text extraction note:', pdfErr);
      }

      if (!textToParse || textToParse.trim().length < 50) {
        const rawString = fileBuffer.toString('latin1');
        const textMatches: string[] = [];
        const tjMatches = rawString.matchAll(/\((.*?)\)\s*Tj/g);
        for (const m of tjMatches) {
          if (m[1]) textMatches.push(m[1]);
        }
        if (textMatches.length > 0) {
          textToParse = textMatches.join('\n');
        } else {
          textToParse = fileBuffer.toString('utf-8', 0, 15000);
        }
      }

      // Initial database record created immediately
      const { data: resumeRow, error: resumeErr } = await supabase
        .from('resumes')
        .insert({
          user_id: user.id,
          storage_path: storagePath,
          parsed: { status: 'parsing', text_length: textToParse.length },
        })
        .select('id')
        .single();

      if (resumeErr) throw resumeErr;
      targetResumeId = resumeRow.id;
    }

    // 3. Process Job Description or fetch URL
    let rawJobText = jobText || '';
    let jobTitle = 'Target Role';
    let companyName = 'Hiring Company';
    let location: string | undefined;
    let datePosted: Date | undefined;
    let validThrough: Date | undefined;

    if (jobUrl) {
      try {
        const scraped = await scrapeJobUrl(jobUrl);
        rawJobText = scraped.raw_text;
        jobTitle = scraped.title || jobTitle;
        companyName = scraped.company || companyName;
        datePosted = scraped.date_posted;
        validThrough = scraped.valid_through;
      } catch {
        return NextResponse.json(
          {
            error: "We couldn't read that page. Paste the raw job description instead.",
          },
          { status: 400 }
        );
      }
    }

    const jdHash = crypto.createHash('sha256').update(rawJobText.trim().toLowerCase()).digest('hex');

    const { count: priorSeenCount } = await supabase
      .from('jobs')
      .select('id', { count: 'exact', head: true })
      .eq('jd_hash', jdHash);

    const isRepost = (priorSeenCount || 0) > 0;

    const { data: jobRow, error: jobErr } = await supabase
      .from('jobs')
      .insert({
        user_id: user.id,
        source_url: jobUrl || null,
        raw_text: rawJobText,
        title: jobTitle,
        company: companyName,
        location,
        jd_hash: jdHash,
        date_posted: datePosted?.toISOString(),
        valid_through: validThrough?.toISOString(),
      })
      .select('id')
      .single();

    if (jobErr) throw jobErr;

    const { data: appRow, error: appErr } = await supabase
      .from('applications')
      .insert({
        user_id: user.id,
        resume_id: targetResumeId,
        job_id: jobRow.id,
        status: 'saved',
        odds: null,
        ghost: null,
        suggestions: [],
      })
      .select('id')
      .single();

    if (appErr) throw appErr;

    // 5. Create pipeline run and enqueue steps for engine-advance
    const { data: runRow } = await supabase
      .from('pipeline_runs')
      .insert({
        user_id: user.id,
        status: 'pending',
        current_step: 'ingest',
        context: {
          applicationId: appRow.id,
          resumeId: targetResumeId,
          jobId: jobRow.id,
        },
      })
      .select('id')
      .single();

    if (runRow?.id) {
      const stepNames = ['ingest', 'job_read', 'match', 'score', 'tailor'];
      const stepsToInsert = stepNames.map((name, idx) => ({
        run_id: runRow.id,
        step_name: name,
        step_order: idx + 1,
        status: 'pending',
        input: {
          applicationId: appRow.id,
          resumeId: targetResumeId,
          jobId: jobRow.id,
        },
      }));
      await supabase.from('pipeline_steps').insert(stepsToInsert);
    }

    // 6. Launch asynchronous pipeline progression in background without blocking response
    executeAnalysisPipelineAsync({
      runId: runRow?.id,
      applicationId: appRow.id,
      resumeId: targetResumeId,
      jobId: jobRow.id,
      userId: user.id,
      textToParse,
      existingParsedResume,
      rawJobText,
      jobTitle,
      companyName,
      datePosted,
      validThrough,
      isRepost,
      supabase,
    }).catch((err) => {
      console.error('Async analysis pipeline failed:', err);
    });

    // 7. Return applicationId immediately (sub-200ms)
    return NextResponse.json({
      applicationId: appRow.id,
      runId: runRow?.id,
      status: 'enqueued',
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Processing failed';
    console.error('Fatal Analyze Route Error:', errorMsg);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

/**
 * Asynchronously advances the analysis pipeline steps, updating database state progressively.
 */
interface AsyncPipelineParams {
  runId?: string;
  applicationId: string;
  resumeId: string;
  jobId: string;
  userId: string;
  textToParse: string;
  existingParsedResume?: Resume | null;
  rawJobText: string;
  jobTitle: string;
  companyName: string;
  datePosted?: Date;
  validThrough?: Date;
  isRepost: boolean;
  supabase: SupabaseClient;
}

async function executeAnalysisPipelineAsync({
  runId,
  applicationId,
  resumeId,
  jobId,
  userId,
  textToParse,
  existingParsedResume,
  rawJobText,
  jobTitle,
  companyName,
  datePosted,
  validThrough,
  isRepost,
  supabase,
}: AsyncPipelineParams) {
  try {
    if (runId) {
      await supabase
        .from('pipeline_runs')
        .update({ status: 'running', current_step: 'ingest' })
        .eq('id', runId);
    }

    // Step 1: Ingest Resume (skip if reusing pre-parsed resume)
    let parsedResume: Resume;
    if (existingParsedResume && typeof existingParsedResume === 'object') {
      parsedResume = existingParsedResume;
    } else {
      const ingestResult = await runIngestAgent({
        rawText: textToParse,
        router,
        userId,
        generateId: () => uuidv4(),
      });
      parsedResume = ingestResult.resume as unknown as Resume;

      await supabase
        .from('resumes')
        .update({ parsed: parsedResume })
        .eq('id', resumeId);
    }

    // Step 2: Job Read & Ghost Evaluation
    if (runId) {
      await supabase
        .from('pipeline_runs')
        .update({ current_step: 'job_read' })
        .eq('id', runId);
    }

    const [jobReaderResult, ghostRisk] = await Promise.all([
      runJobReaderAgent({
        rawJobText,
        router,
        userId,
      }),
      Promise.resolve(
        evaluateGhostRisk({
          raw_text: rawJobText,
          date_posted: datePosted,
          valid_through: validThrough,
          is_repost: isRepost,
        })
      ),
    ]);

    const resolvedTitle = jobReaderResult.data.title || jobTitle;
    const resolvedCompany = jobReaderResult.data.company || companyName;

    await supabase
      .from('jobs')
      .update({
        title: resolvedTitle,
        company: resolvedCompany,
      })
      .eq('id', jobId);

    // Step 3: Match Evidence
    if (runId) {
      await supabase
        .from('pipeline_runs')
        .update({ current_step: 'match' })
        .eq('id', runId);
    }

    const matcherResult = await runMatcherAgent({
      resume: parsedResume as unknown as Parameters<typeof runMatcherAgent>[0]['resume'],
      rawJobText,
      requirements: jobReaderResult.verifiedRequirements,
      router,
      userId,
    });

    const verifiedRequirements = matcherResult.verifiedRequirements as unknown as JobRequirementItem[];

    // Step 4: Pure deterministic scoring
    if (runId) {
      await supabase
        .from('pipeline_runs')
        .update({ current_step: 'score' })
        .eq('id', runId);
    }

    const skillCoverageFactor = computeSkillCoverage(verifiedRequirements);
    const proofStrengthFactor = computeProofStrength(parsedResume);
    const levelFitFactor = computeLevelFit(
      parsedResume,
      jobReaderResult.data.yearsRequired,
      jobReaderResult.data.isFresherFriendly
    );
    const domainRelevanceFactor = {
      score: matcherResult.data.domain_relevance,
      evidence: matcherResult.data.domain_evidence,
    };
    const applicationQualityFactor = computeApplicationQuality(parsedResume);

    let oneChange = matcherResult.data.one_change_to_move_up;
    const preliminaryOdds = computeOdds(
      {
        skill_coverage: skillCoverageFactor,
        proof_strength: proofStrengthFactor,
        level_fit: levelFitFactor,
        domain_relevance: domainRelevanceFactor,
        application_quality: applicationQualityFactor,
      },
      matcherResult.data.top_gaps,
      oneChange,
      matcherResult.data.confidence
    );

    if (preliminaryOdds.band === 'Long shot') {
      const topSkills = parsedResume.skills?.slice(0, 3).join(', ') || 'current skills';
      oneChange = `Significant mismatch for this specific stack/seniority level. You would have much higher odds targeting junior/entry-level roles centered on ${topSkills} or foundational software engineering internships before applying to roles requiring commercial production experience.`;
    }

    const finalOdds = computeOdds(
      {
        skill_coverage: skillCoverageFactor,
        proof_strength: proofStrengthFactor,
        level_fit: levelFitFactor,
        domain_relevance: domainRelevanceFactor,
        application_quality: applicationQualityFactor,
      },
      matcherResult.data.top_gaps,
      oneChange,
      matcherResult.data.confidence
    );

    // Step 5: Fact-Locked Bullet Tailoring
    if (runId) {
      await supabase
        .from('pipeline_runs')
        .update({ current_step: 'tailor' })
        .eq('id', runId);
    }

    const tailorResult = await runTailorAgent({
      resume: parsedResume as unknown as Parameters<typeof runTailorAgent>[0]['resume'],
      rawJobText,
      router,
      userId,
    });

    // Check if user has profile and evaluate initial eligibility
    let initialEligibility = null;
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('grad_year, branch, aggregate_pct, active_backlogs, track')
      .eq('id', userId)
      .maybeSingle();

    if (userProfile?.grad_year && jobReaderResult.data.eligibility) {
      initialEligibility = checkEligibility(
        jobReaderResult.data.eligibility as unknown as EligibilityCriteria,
        userProfile
      );
    }

    // Commit final application outputs
    await supabase
      .from('applications')
      .update({
        tailored: parsedResume,
        odds: finalOdds,
        ghost: ghostRisk,
        suggestions: tailorResult.suggestions,
        status: 'saved',
        eligibility: initialEligibility,
      })
      .eq('id', applicationId);

    if (runId) {
      await supabase
        .from('pipeline_runs')
        .update({
          status: 'completed',
          current_step: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', runId);
    }
  } catch (err) {
    console.error('Pipeline step execution error:', err);
    if (runId) {
      await supabase
        .from('pipeline_runs')
        .update({ status: 'failed', updated_at: new Date().toISOString() })
        .eq('id', runId);
    }
  }
}
