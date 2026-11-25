// supabase/functions/evaluate-session/index.ts
// Grades STAR components, writes fact-locked suggestions, saves session scorecard
import { createClient } from "jsr:@supabase/supabase-js@2";
import { evaluateSession, ModelRouter } from "../_shared/engine.js";

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const startMs = Date.now();

  try {
    const { sessionId, transcript: directTranscript, jobTitle } = await req.json();

    if (!sessionId && (!directTranscript || !Array.isArray(directTranscript))) {
      return new Response(JSON.stringify({ error: "sessionId or transcript array is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const db = createClient(supabaseUrl, supabaseServiceKey);

    let transcript = directTranscript;
    let resolvedTitle = jobTitle || "Target Role";

    // If sessionId provided, fetch session from DB
    if (sessionId) {
      const { data: session, error: sessErr } = await db
        .from("interview_sessions")
        .select("transcript, applications(jobs(title))")
        .eq("id", sessionId)
        .single();

      if (sessErr || !session) {
        return new Response(JSON.stringify({ error: "Interview session not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      transcript = session.transcript;
      resolvedTitle = (session as any).applications?.jobs?.title || resolvedTitle;
    }

    const router = new ModelRouter({
      overrides: [
        {
          id: "gemini",
          apiKey: Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_GENERATIVE_AI_API_KEY"),
        },
      ],
    });

    const scorecard = await evaluateSession({
      transcript,
      jobTitle: resolvedTitle,
      router,
    });

    // Save scorecard to database
    if (sessionId) {
      await db
        .from("interview_sessions")
        .update({
          scorecard,
          ended_at: new Date().toISOString(),
        })
        .eq("id", sessionId);
    }

    // Metric-only log: no transcript or text
    console.log(JSON.stringify({
      event: "evaluate_session_completed",
      sessionId: sessionId || "ephemeral",
      overallScore: scorecard.overallScore,
      band: scorecard.band,
      latencyMs: Date.now() - startMs,
      timestamp: new Date().toISOString(),
    }));

    return new Response(JSON.stringify(scorecard), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(JSON.stringify({ event: "evaluate_session_error", error }));
    return new Response(JSON.stringify({ error }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
