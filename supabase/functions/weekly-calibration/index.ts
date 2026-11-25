// supabase/functions/weekly-calibration/index.ts
// Analyzes predicted odds bands vs real logged outcomes and reports conversion metrics
import { createClient } from "jsr:@supabase/supabase-js@2";
import { runWeeklyCalibration } from "../_shared/engine.js";

Deno.serve(async (req: Request) => {
  // Check CRON_SECRET header (verify_jwt = false)
  const cronSecretHeader = req.headers.get("x-cron-secret");
  const authHeader = req.headers.get("Authorization");
  const expectedCron = Deno.env.get("CRON_SECRET");

  const isCronValid = cronSecretHeader && expectedCron && cronSecretHeader === expectedCron;
  const isBearerValid = authHeader && expectedCron && authHeader === `Bearer ${expectedCron}`;

  if (!isCronValid && !isBearerValid) {
    return new Response(JSON.stringify({ error: "Unauthorized: Invalid CRON_SECRET header" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const startMs = Date.now();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const db = createClient(supabaseUrl, supabaseServiceKey);

    const report = await runWeeklyCalibration(db as any);

    console.log(JSON.stringify({
      event: "weekly_calibration_completed",
      sampleSize: report.sampleSize,
      sufficientSamples: report.sufficientSamples,
      recommendation: report.recommendation,
      latencyMs: Date.now() - startMs,
      timestamp: new Date().toISOString(),
    }));

    return new Response(JSON.stringify(report), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(JSON.stringify({ event: "weekly_calibration_error", error }));
    return new Response(JSON.stringify({ error }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
