// Slack Events API endpoint.
//
// Receives every event Slack sends to the Kairo app — most importantly,
// `app_mention` (someone @-mentioned Kairo) and `message.im` (someone DM'd
// Kairo). We verify the signature, route the event to the agent, and
// reply asynchronously.
//
// Slack expects a 200 response within 3 seconds, so we kick off the agent
// run in the background and return immediately.
//
// Setup: see docs/slack-app-setup.md

import { NextRequest, NextResponse } from "next/server";
import { verifySlackSignature } from "@/lib/slack/verify";
import { postSlackMessage } from "@/lib/slack/post";
import { runOwnerAgent } from "@/lib/claude/agent";
import { env } from "@/lib/env";

export const runtime = "nodejs";
// Disable caching — webhooks must always be live.
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // Slack is optional. If the workspace hasn't been set up yet, fail soft so
  // a leftover Slack subscription doesn't 500 the route. (Slack will retry on
  // 5xx; 503 makes it stop.)
  const signingSecret = env.SLACK_SIGNING_SECRET;
  const botToken = env.SLACK_BOT_TOKEN;
  if (!signingSecret || !botToken) {
    return NextResponse.json(
      { error: "Slack transport is not configured for this deployment." },
      { status: 503 }
    );
  }

  // We need the raw body string for signature verification.
  const body = await req.text();
  const timestamp = req.headers.get("x-slack-request-timestamp") ?? "";
  const signature = req.headers.get("x-slack-signature") ?? "";

  if (!verifySlackSignature({
    signingSecret,
    timestamp,
    body,
    signature,
  })) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const payload = JSON.parse(body);

  // Slack URL verification handshake (one-time when you register the URL).
  if (payload.type === "url_verification") {
    return NextResponse.json({ challenge: payload.challenge });
  }

  if (payload.type === "event_callback") {
    const event = payload.event;

    // Ignore the bot's own messages to prevent feedback loops.
    if (event.bot_id || event.subtype === "bot_message") {
      return NextResponse.json({ ok: true });
    }

    // Handle app mentions and direct messages.
    if (event.type === "app_mention" || (event.type === "message" && event.channel_type === "im")) {
      // Run the agent in the background; ack Slack immediately.
      void handleAgentTurn({
        channel: event.channel,
        userText: stripBotMention(event.text ?? ""),
        slackUserId: event.user,
        threadTs: event.thread_ts ?? event.ts,
      });
    }
  }

  return NextResponse.json({ ok: true });
}

async function handleAgentTurn(args: {
  channel: string;
  userText: string;
  slackUserId: string;
  threadTs: string;
}) {
  try {
    const reply = await runOwnerAgent({
      userMessage: args.userText,
      slackUserId: args.slackUserId,
    });
    await postSlackMessage({
      channel: args.channel,
      text: reply,
      threadTs: args.threadTs,
    });
  } catch (err) {
    console.error("[slack/events] agent error:", err);
    await postSlackMessage({
      channel: args.channel,
      text: "Something went wrong on my end. The dev has been notified.",
      threadTs: args.threadTs,
    });
  }
}

// Slack puts "<@U12345>" tokens at the start of app_mention text. Strip them.
function stripBotMention(text: string) {
  return text.replace(/<@[A-Z0-9]+>/g, "").trim();
}
