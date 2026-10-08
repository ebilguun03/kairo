// Web-chat transport for the Kairo Owner Agent.
//
// POST /api/agent/chat
//
// Request body:
//   {
//     messages: [{ role: "user" | "assistant", content: string }, ...]
//   }
//
// Response body:
//   { reply: string }
//   or { error: string } on validation/runtime failure.
//
// Auth: optional. If KAIRO_CHAT_PASSWORD is set in the environment, the route
// requires `Authorization: Bearer <password>`. If unset, the route is open —
// only do that on localhost or behind another gate (e.g., Vercel team access).

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { runOwnerAgentChat } from "@/lib/claude/agent";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(8000),
      })
    )
    .min(1)
    .max(40),
});

export async function POST(req: NextRequest) {
  // Optional password gate. Keep it dead simple — single shared bearer token.
  const requiredPassword = env.KAIRO_CHAT_PASSWORD;
  if (requiredPassword) {
    const auth = req.headers.get("authorization") ?? "";
    const presented = auth.replace(/^Bearer\s+/i, "").trim();
    if (presented !== requiredPassword) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const { reply, steps } = await runOwnerAgentChat({
      messages: parsed.data.messages,
      restaurantSlug: env.KAIRO_DEMO_RESTAURANT_SLUG,
    });
    return NextResponse.json({ reply, steps });
  } catch (err) {
    const msg = String(err);
    console.error("[agent/chat] failed:", msg);
    // Always return JSON — never let Next.js render an HTML error page.
    return NextResponse.json(
      { error: "Kairo ran into an issue. Please try again.", detail: msg },
      { status: 500 }
    );
  }
}
