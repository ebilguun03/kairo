// Slack request signature verification.
// https://api.slack.com/authentication/verifying-requests-from-slack
//
// Slack signs every request with HMAC-SHA256 of `v0:{timestamp}:{body}`
// using your app's signing secret. We must verify this on every webhook
// to be sure the request is actually from Slack.

import crypto from "node:crypto";

export function verifySlackSignature(args: {
  signingSecret: string;
  timestamp: string;
  body: string;
  signature: string;
}): boolean {
  const { signingSecret, timestamp, body, signature } = args;

  if (!signingSecret || !timestamp || !signature) return false;

  // Reject requests older than 5 minutes (replay-attack protection).
  const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 60 * 5;
  if (Number(timestamp) < fiveMinutesAgo) return false;

  const baseString = `v0:${timestamp}:${body}`;
  const expected =
    "v0=" +
    crypto.createHmac("sha256", signingSecret).update(baseString).digest("hex");

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length) return false;
  return crypto.timingSafeEqual(sigBuf, expBuf);
}
