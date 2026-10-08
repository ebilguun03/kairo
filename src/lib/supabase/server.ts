// Server-side Supabase clients.
//
// `supabaseService()` uses the service-role key — full database access,
// bypasses Row-Level Security. Use only in server code (API routes, server
// actions). Never expose to the browser.
//
// `supabaseServer()` uses the user's session cookies via @supabase/ssr.
// Use this when responding to a request on behalf of a logged-in owner.

import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import type { Database } from "@/lib/types";

export function supabaseService() {
  return createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    }
  );
}

export async function supabaseServer() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll is called from a Server Component — ignore, middleware
            // will handle session refresh on the next request.
          }
        },
      },
    }
  );
}
