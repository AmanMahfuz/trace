// supabase/functions/interview-turn/index.ts
// Fast-tier model returns the next question or follow-up (strict max 25 words)
import { createClient } from "jsr:@supabase/supabase-js@2";
import { handleInterviewTurn, ModelRouter } from "../_shared/engine.js";

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const startMs = Date.now();

  try {
    const { transcript, jobTitle, sessionId } = await req.json();

    if (!transcript || !Array.isArray(transcript)) {
      return new Response(JSON.stringify({ error: "transcript array is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const db = createClient(supabaseUrl, supabaseServiceKey);

    // Optional user attribution
    const authHeader = req.headers.get("Authorization");
    let userId: string | undefined;
    if (authHeader) {
      const { data: { user } } = await db.auth.getUser(authHeader.replace("Bearer ", ""));
      if (user) userId = user.id;
    }

    const router = new ModelRouter({
      overrides: [
        {
          id: "gemini",
          apiKey: Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_GENERATIVE_AI_API_KEY"),
        },
        {
          id: "groq",
          apiKey: Deno.env.get("GROQ_API_KEY"),
        },
      ],
    });

    const result = await handleInterviewTurn({
      transcript,
      jobTitle,
      router,
      userId,
    });

    // If sessionId provided, append to session transcript in database
    if (sessionId) {
      const { data: session } = await db
        .from("interview_sessions")
        .select("transcript")
        .eq("id", sessionId)
        .single();

      if (session) {
        const updated = [
          ...(session.transcript as any[]),
          { speaker: "interviewer", text: result.nextQuestion, timestamp: Date.now() },
        ];
        await db
          .from("interview_sessions")
          .update({ transcript: updated })
          .eq("id", sessionId);
      }
    }

    // Metric-only log: no transcript text
    console.log(JSON.stringify({
      event: "interview_turn",
      sessionId: sessionId || "ephemeral",
      wordCount: result.wordCount,
      latencyMs: Date.now() - startMs,
      timestamp: new Date().toISOString(),
    }));

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(JSON.stringify({ event: "interview_turn_error", error }));
    return new Response(JSON.stringify({ error }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
