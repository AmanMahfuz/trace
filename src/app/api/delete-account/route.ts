import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const adminClient = createAdminClient();
  const userId = user.id;

  try {
    // 1. Delete all storage files in resumes-raw for user
    const { data: files } = await adminClient.storage.from('resumes-raw').list(userId);
    if (files && files.length > 0) {
      const paths = files.map((f) => `${userId}/${f.name}`);
      await adminClient.storage.from('resumes-raw').remove(paths);
    }

    // 2. Explicitly clean all user relational data in reverse dependency order
    await adminClient.from('interview_sessions').delete().eq('user_id', userId);
    await adminClient.from('applications').delete().eq('user_id', userId);
    await adminClient.from('jobs').delete().eq('user_id', userId);
    await adminClient.from('resumes').delete().eq('user_id', userId);
    await adminClient.from('credit_ledger').delete().eq('user_id', userId);

    // 3. Purge any user-linked LLM cache or logs
    try {
      await adminClient.from('llm_cache').delete().eq('user_id', userId);
    } catch {
      // llm_cache may not have user_id column in all environments
    }

    // 4. Delete profile
    await adminClient.from('profiles').delete().eq('id', userId);

    // 5. Delete the auth user from auth.users
    await adminClient.auth.admin.deleteUser(userId);

    // 6. Sign out current user session
    await supabase.auth.signOut();

    return NextResponse.json({ success: true, deletedUserId: userId });
  } catch (err: unknown) {
    console.error('Delete account failed:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Account deletion failed' },
      { status: 500 }
    );
  }
}
