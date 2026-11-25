// supabase/functions/engine-advance/index.ts
// Thin Deno adapter over packages/engine bundled into _shared/engine.js
import { createClient } from "jsr:@supabase/supabase-js@2";
import { advanceRun, ModelRouter } from "../_shared/engine.js";

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const { runId } = await req.json();
    if (!runId) {
      return new Response(JSON.stringify({ error: "runId is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const db = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Authorization: check caller JWT owns runId or CRON_SECRET matches
    const authHeader = req.headers.get("Authorization");
    const cronSecretHeader = req.headers.get("x-cron-secret");
    const expectedCron = Deno.env.get("CRON_SECRET");

    let isAuthorized = false;

    if (cronSecretHeader && expectedCron && cronSecretHeader === expectedCron) {
      isAuthorized = true;
    } else if (authHeader) {
      const userToken = authHeader.replace("Bearer ", "");
      const { data: { user }, error: userErr } = await db.auth.getUser(userToken);
      if (!userErr && user) {
        const { data: run } = await db
          .from("pipeline_runs")
          .select("user_id")
          .eq("id", runId)
          .single();
        if (run && run.user_id === user.id) {
          isAuthorized = true;
        }
      }
    }

    if (!isAuthorized) {
      return new Response(JSON.stringify({ error: "Unauthorized access to run" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 2. Initialize ModelRouter with secrets
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

    // 3. Atomically advance next step (idempotent via FOR UPDATE SKIP LOCKED)
    const result = await advanceRun({ runId, db: db as any, router });

    // Metric-only log: no resume or personal text
    console.log(JSON.stringify({
      event: "engine_advance_step",
      runId,
      step: result.claimedStep,
      status: result.status,
      hasMore: result.hasMore,
      timestamp: new Date().toISOString(),
    }));

    // If more steps remain, optionally invoke next step asynchronously
    if (result.hasMore) {
      const selfUrl = `${supabaseUrl}/functions/v1/engine-advance`;
      fetch(selfUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseServiceKey}`,
          "x-cron-secret": expectedCron || "",
        },
        body: JSON.stringify({ runId }),
      }).catch((e) => console.warn("Self-trigger dispatch note:", e));
    }

    return new Response(JSON.stringify(result), {
      status: 202,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(JSON.stringify({ event: "engine_advance_error", error }));
    return new Response(JSON.stringify({ error }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
