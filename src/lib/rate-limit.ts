import { createAdminClient } from '@/lib/supabase/server';

export async function checkRateLimit(
  userId: string,
  taskPrefix: string,
  maxPerHour = 10
): Promise<boolean> {
  try {
    const supabase = createAdminClient();
    const oneHourAgo = new Date(Date.now() - 3600 * 1000).toISOString();

    const { count, error } = await supabase
      .from('ai_logs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .ilike('task', `${taskPrefix}%`)
      .gte('created_at', oneHourAgo);

    if (error || count === null) return true;
    return count < maxPerHour;
  } catch {
    return true;
  }
}
