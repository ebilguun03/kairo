// Health check — used by Vercel and external monitors.
// Hit /api/health to confirm the app is up and env wiring works.

import { NextResponse } from "next/server";
import { env } from "@/lib/env";

export async function GET() {
  // Touch the env loader so misconfiguration surfaces here instead of in a webhook
  // path where the customer would notice it first.
  const checks = {
    supabase: Boolean(env.NEXT_PUBLIC_SUPABASE_URL),
    anthropic: Boolean(env.ANTHROPIC_API_KEY),
    chat: Boolean(env.KAIRO_DEMO_RESTAURANT_SLUG),
    slack: Boolean(env.SLACK_SIGNING_SECRET),
    toast: Boolean(env.TOAST_WEBHOOK_SECRET),
  };

  return NextResponse.json({
    status: "ok",
    time: new Date().toISOString(),
    checks,
  });
}
