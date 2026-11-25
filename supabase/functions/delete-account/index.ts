// supabase/functions/delete-account/index.ts
// Deletes files, relational rows, caches, logs, and auth user using service role
import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
  if (req.method !== "POST" && req.method !== "DELETE") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing authorization token" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const db = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Verify caller JWT first to authenticate user identity
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userErr } = await db.auth.getUser(token);

    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Invalid user token" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const userId = user.id;

    // 2. Delete storage files in resumes-raw for user
    const { data: files } = await db.storage.from("resumes-raw").list(userId);
    if (files && files.length > 0) {
      const paths = files.map((f: { name: string }) => `${userId}/${f.name}`);
      await db.storage.from("resumes-raw").remove(paths);
    }

    // 3. Delete database records in reverse dependency order
    await db.from("interview_sessions").delete().eq("user_id", userId);
    await db.from("applications").delete().eq("user_id", userId);
    await db.from("jobs").delete().eq("user_id", userId);
    await db.from("resumes").delete().eq("user_id", userId);
    await db.from("credit_ledger").delete().eq("user_id", userId);
    await db.from("pipeline_runs").delete().eq("user_id", userId);

    try {
      await db.from("llm_cache").delete().eq("user_id", userId);
    } catch {
      // Ignored if user_id column not present
    }

    try {
      await db.from("ai_logs").delete().eq("user_id", userId);
    } catch {
      // Ignored if table not populated
    }

    await db.from("profiles").delete().eq("id", userId);

    // 4. Delete the auth user from auth.users
    const { error: deleteAuthErr } = await db.auth.admin.deleteUser(userId);
    if (deleteAuthErr) {
      console.warn("Delete auth user notice:", deleteAuthErr.message);
    }

    console.log(JSON.stringify({
      event: "account_deleted",
      userId,
      timestamp: new Date().toISOString(),
    }));

    return new Response(JSON.stringify({ success: true, deletedUserId: userId }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(JSON.stringify({ event: "delete_account_error", error }));
    return new Response(JSON.stringify({ error }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
