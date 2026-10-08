// Returns the live snapshot for the /demo left and right panels:
// guest counts, lapsed sample, upcoming birthdays, pending reviews,
// recent agent actions. Reads from the seeded Supabase tables.

import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { getRestaurantSnapshot } from "@/lib/supabase/demo-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // Same password gate as /api/agent/chat — single shared bearer token.
  const requiredPassword = env.KAIRO_CHAT_PASSWORD;
  if (requiredPassword) {
    const auth = req.headers.get("authorization") ?? "";
    const presented = auth.replace(/^Bearer\s+/i, "").trim();
    if (presented !== requiredPassword) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  try {
    const snap = await getRestaurantSnapshot(env.KAIRO_DEMO_RESTAURANT_SLUG);
    if (!snap) {
      return NextResponse.json(
        { error: "restaurant not found — apply migration + seed first" },
        { status: 404 }
      );
    }
    return NextResponse.json(snap);
  } catch (err) {
    console.error("[demo/context] failed:", err);
    return NextResponse.json(
      { error: "snapshot failed", detail: String(err) },
      { status: 500 }
    );
  }
}
