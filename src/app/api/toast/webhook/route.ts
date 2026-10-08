// Toast POS webhook endpoint.
//
// Toast sends webhooks for events like new orders, customer creation,
// menu changes, etc. We verify the signature, normalize the payload,
// and write to Supabase. Lifecycle automations (24-hour follow-up,
// birthday, lapsed-guest) are triggered downstream by n8n watching
// the database.
//
// Toast partner-program docs: https://doc.toasttab.com/openapi/

import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { env } from "@/lib/env";
import { supabaseService } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("toast-signature") ?? "";

  if (!verifyToastSignature(body, signature, env.TOAST_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const payload = JSON.parse(body);

  // TODO: switch on payload.eventCategory (`ORDERS`, `CONFIGURATION`, ...) and
  // payload.eventType. For the MVP we care about ORDERS.* to populate the
  // `visits` and `orders` tables, and CUSTOMERS.* to keep `guests` in sync.
  console.log("[toast/webhook] received", {
    eventCategory: payload.eventCategory,
    eventType: payload.eventType,
  });

  // Stash the raw event for now so nothing is lost while we build out parsers.
  const supabase = supabaseService();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await supabase.from("agent_actions").insert({
    kind: "toast_webhook",
    payload,
  } as any);

  return NextResponse.json({ ok: true });
}

function verifyToastSignature(body: string, signature: string, secret: string) {
  if (!secret || !signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
  // Constant-time compare to prevent timing attacks.
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length) return false;
  return crypto.timingSafeEqual(sigBuf, expBuf);
}
