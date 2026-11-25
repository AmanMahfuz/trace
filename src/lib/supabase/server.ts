import { createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';

export async function createClient(request?: Request | NextRequest) {
  let tokenFromHeader: string | undefined;
  if (request) {
    const authHeader = request.headers.get('Authorization') || request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      tokenFromHeader = authHeader.substring(7);
    }
  }

  try {
    const cookieStore = await cookies();

    return createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: tokenFromHeader
          ? {
              headers: {
                Authorization: `Bearer ${tokenFromHeader}`,
              },
            }
          : undefined,
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // Can happen in Server Components if not writing cookies
            }
          },
        },
      }
    );
  } catch {
    // Fallback if called outside Next.js request cookie scope (e.g., in standalone testing)
    return createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: tokenFromHeader
          ? {
              headers: {
                Authorization: `Bearer ${tokenFromHeader}`,
              },
            }
          : undefined,
        cookies: {
          getAll() {
            return [];
          },
          setAll() {},
        },
      }
    );
  }
}

export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
