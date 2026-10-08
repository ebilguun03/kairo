# Kairo — Setup Guide

This walks you from a clean machine to Kairo running locally with a working Slack bot.

## Prereqs

- Node.js 20+ (`node --version`)
- A GitHub account (for Vercel deploys later)
- A free Supabase account
- A free Anthropic Console account with an API key
- A Slack workspace where you can install custom apps (your personal workspace works)
- `ngrok` or a similar tunnel for Slack webhooks during local dev

## 1. Install dependencies

```bash
cd hearth-app
npm install
```

## 2. Provision Supabase

1. Go to https://supabase.com → **New project**. Pick a strong DB password and save it.
2. Wait ~1 minute for provisioning.
3. **Project Settings → API**, copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` `public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` `secret` key → `SUPABASE_SERVICE_ROLE_KEY`
4. Open **SQL Editor → New query**, paste the contents of `supabase/migrations/0001_initial_schema.sql`, and run.
5. In **Table Editor**, confirm the `restaurants` row for Paper Lantern Demo was inserted.

## 3. Anthropic API key

1. https://console.anthropic.com → **API keys → Create**.
2. Save the key as `ANTHROPIC_API_KEY` in `.env.local`.
3. The default model is `claude-sonnet-4-6`. You can also use `claude-opus-4-6` or `claude-haiku-4-5-20251001`. Set `ANTHROPIC_MODEL` to override.

## 4. Slack app

See `docs/slack-app-setup.md` for the full walkthrough.

## 5. Run locally

```bash
cp .env.example .env.local
# then edit .env.local and paste in real values

npm run dev
```

Visit http://localhost:3000 — you should see the Kairo landing page.
Visit http://localhost:3000/api/health — you should see `status: "ok"` with checks for each integration.

## 6. Expose to Slack via ngrok

In a new terminal:

```bash
ngrok http 3000
```

Copy the `https://*.ngrok-free.app` URL. In your Slack app settings:

- **Event Subscriptions** → Request URL: `https://YOUR.ngrok-free.app/api/slack/events`
- Slack will send a verification challenge; the route handles it automatically.

Once verified, DM your Kairo bot in Slack. It should reply.

## 7. Deploy to Vercel (later)

When you're ready to move off localhost:

```bash
npx vercel
```

In the Vercel dashboard, add the same env vars from `.env.local` to **Project Settings → Environment Variables**. Update Slack's Event Subscription URL to your Vercel URL.

## Troubleshooting

**`Invalid environment configuration` on dev server start**
Check `.env.local` against `.env.example`. The `env.ts` loader fails fast if a required variable is missing.

**Slack webhook 401**
Signature verification failed. Make sure `SLACK_SIGNING_SECRET` matches the value at **Slack app → Basic Information → Signing Secret**. Also check that ngrok is forwarding correctly and that you didn't accidentally use the old ngrok URL after restart.

**Agent replies with "(no reply)"**
Claude returned `end_turn` with empty content. Usually means the model had an error or returned only tool_use blocks past the safety cap. Check server logs.

**Toast webhook 401**
You haven't set `TOAST_WEBHOOK_SECRET` yet. For local dev you can set it to any string and use that same string when generating test signatures.
