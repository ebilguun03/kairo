// Send a message to Slack via chat.postMessage.
// https://api.slack.com/methods/chat.postMessage

import { env } from "@/lib/env";

export async function postSlackMessage(args: {
  channel: string;
  text: string;
  threadTs?: string;
  blocks?: unknown[];
}) {
  const res = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.SLACK_BOT_TOKEN}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      channel: args.channel,
      text: args.text,
      thread_ts: args.threadTs,
      blocks: args.blocks,
    }),
  });

  const data = (await res.json()) as { ok: boolean; error?: string };
  if (!data.ok) {
    throw new Error(`Slack postMessage failed: ${data.error}`);
  }
  return data;
}
