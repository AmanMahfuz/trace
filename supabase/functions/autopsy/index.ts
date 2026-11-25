// supabase/functions/autopsy/index.ts
// Generates diagnostic reasons (citing factors), concrete fix plan, and follow-up email
import { createClient } from "jsr:@supabase/supabase-js@2";
import { generateAutopsy, ModelRouter } from "../_shared/engine.js";

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const startMs = Date.now();

  try {
    const { applicationId, outcome = "rejected" } = await req.json();

    if (!applicationId) {
      return new Response(JSON.stringify({ error: "applicationId is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const db = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch application details & odds factors
    const { data: app, error: appErr } = await db
      .from("applications")
      .select("id, odds, autopsy, jobs(title, company)")
      .eq("id", applicationId)
      .single();

    if (appErr || !app) {
      return new Response(JSON.stringify({ error: "Application not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Check cached autopsy if outcome has not changed
    if (app.autopsy && (app.autopsy as any).outcome === outcome) {
      return new Response(JSON.stringify(app.autopsy), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const odds = (app.odds as any) || {};
    const jobInfo = (app as any).jobs || {};

    const router = new ModelRouter({
      overrides: [
        {
          id: "gemini",
          apiKey: Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_GENERATIVE_AI_API_KEY"),
        },
      ],
    });

    const autopsyData = await generateAutopsy({
      jobTitle: jobInfo.title || "Target Role",
      companyName: jobInfo.company || "Hiring Company",
      oddsBand: odds.band || "Fair",
      outcome,
      factorScores: odds.factors || {},
      topGaps: odds.top_gaps || [],
      router,
    });

    const fullRecord = {
      ...autopsyData,
      outcome,
      applicationId,
    };

    // Cache on application record
    await db
      .from("applications")
      .update({
        autopsy: fullRecord,
        outcome,
        outcome_at: new Date().toISOString(),
      })
      .eq("id", applicationId);

    // Metric-only log: no personal text
    console.log(JSON.stringify({
      event: "autopsy_generated",
      applicationId,
      outcome,
      reasonsCount: autopsyData.reasons.length,
      latencyMs: Date.now() - startMs,
      timestamp: new Date().toISOString(),
    }));

    return new Response(JSON.stringify(fullRecord), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(JSON.stringify({ event: "autopsy_error", error }));
    return new Response(JSON.stringify({ error }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
