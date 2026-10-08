// Browser-side Supabase client. Safe to import in client components.
"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/types";

export function supabaseBrowser() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
