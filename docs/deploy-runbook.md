# kairo-app — production deploy runbook

End state: a live Vercel URL (e.g. `https://kairo-<yourname>.vercel.app`) with a working web chat at `/chat`. You, your advisor, classmates, and the Paper Lantern Demo owner can each open the URL from any browser or phone and get real, on-brand drafts back from the Kairo agent. No Slack workspace required.

Estimated time: 15–25 minutes.

> This runbook configures the fictional Kairo demo. The separate capstone restaurant website is not a dependency.

> **Why chat-first, not Slack-first?** Slack is a great secondary transport for *you* (you're already in it) but adds real friction for everyone else: classmates have to join a workspace, the Paper Lantern Demo owner has to install an app he doesn't otherwise use. Web chat is a URL anyone can open. Slack is documented in the appendix at the bottom and can be wired up anytime later — the agent loop is the same.

## 0. Commit the wedge changes

```bash
cd kairo
npm install                              # first time only
npm run typecheck
npm run lint

git add -A
git commit -m "Kairo: web chat transport for the Owner Agent (chat-first wedge)"

# If kairo-app isn't on GitHub yet, create the remote first:
#   gh repo create kairo-app --private --source=. --remote=origin
git push origin main
```

## 1. Supabase project

You've likely done this already (project: `kairo-prod`). If not:

1. https://supabase.com → New project.
   - Name: `kairo-prod`.
   - Pick a region near your users (`us-west-1` for Pacific NW).
   - Save the database password somewhere safe.
2. **Project Settings → API**:
   - `Project URL` → goes into `NEXT_PUBLIC_SUPABASE_URL`.
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`. **Treat like a database password — never commit, never expose to the browser.**
3. **SQL Editor → New query** → paste the contents of `supabase/migrations/0001_initial_schema.sql` → Run. You should see "Success. No rows returned" and the tables appear in the Table Editor sidebar.
4. Verify the Paper Lantern Demo seed row exists:
   ```sql
   select id, slug, name, brand_voice from restaurants where slug = 'paper-lantern-demo';
   ```
   You should get one row.

5. **(Recommended for demo)** Apply the synthetic Paper Lantern Demo data seed so the `/demo` page has guests, reviews, and audit history to reason over:
   ```sql
   -- Paste the contents of supabase/seed_demo.sql here and Run.
   ```
   You should see `NOTICE: Seeded N guests, N visits, N reviews, N agent actions for Paper Lantern Demo.` in the output panel.

## 2. Anthropic API key

1. https://console.anthropic.com → API Keys → Create key. Name it `kairo-prod`.
2. Copy the key (starts with `sk-ant-`). Save it.
3. Make sure the workspace has spend limits set so a bug or a public URL can't run up a huge bill — the default $10/mo is fine for the capstone demo. We also gate `/chat` with a shared password (`KAIRO_CHAT_PASSWORD`) as a second line of defense.

## 3. Pick a chat password

You'll use this on the `/chat` page to keep random visitors from burning your Anthropic credits. Generate a strong one and save it to your password manager:

```bash
openssl rand -base64 16
```

You'll share this with your advisor / classmates / the Paper Lantern Demo owner when you want them to try the demo.

## 4. Vercel project

1. https://vercel.com/new → import `<your-username>/kairo-app` (or `hearth-app` if you haven't renamed the GitHub repo yet).
2. **Framework**: Next.js. **Root directory**: leave as `/`. **Build command**: default.
3. **Environment Variables** — Production environment:

   | Key | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | from step 1 |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | from step 1 |
   | `SUPABASE_SERVICE_ROLE_KEY` | from step 1 (mark as Secret) |
   | `ANTHROPIC_API_KEY` | from step 2 (mark as Secret) |
   | `ANTHROPIC_MODEL` | leave blank (default: claude-sonnet-4-6) |
   | `KAIRO_DEMO_RESTAURANT_SLUG` | `paper-lantern-demo` |
   | `KAIRO_CHAT_PASSWORD` | from step 3 (mark as Secret) |
   | `NEXT_PUBLIC_APP_URL` | leave blank for first deploy; fill after URL is assigned |

   Leave Slack / Toast / Twilio / Resend / PostHog blank for now. The app will deploy and run fine without them.

4. **Deploy.** First build ~1 min.

5. After it deploys, copy the URL (e.g. `https://kairo-<yourname>.vercel.app`). Update:
   - `NEXT_PUBLIC_APP_URL` env var → that URL → redeploy.

## 5. Smoke test

1. Open `https://<your-kairo-url>.vercel.app/api/health`. You should see `status: "ok"` with `supabase: true, anthropic: true, chat: true`. Slack and Toast will be `false` — that's expected.
2. Open `https://<your-kairo-url>.vercel.app/demo` — **this is the page to project for the capstone presentation.** Enter your `KAIRO_CHAT_PASSWORD` in the top-right field.
3. The left panel ("What Kairo knows about Paper Lantern Demo") should populate within a second: ~30 total guests, 10 lapsed, synthetic birthdays in the current month, a few pending review replies. If it stays empty, you haven't run `seed_demo.sql` yet — go back to step 1.5 above.
4. Click one of the four scenario cards at the top. Wait ~5-10 seconds. You should see:
   - Bullet points above the reply showing the tools the agent invoked ("query_restaurant_context · Read Paper Lantern Demo's customer context: 10 lapsed guests, 6 birthdays this month, 7 pending reviews").
   - A draft response that references real names from the seeded data.
   - A new entry in the audit log on the right.
5. Also visit `/chat` for the minimal owner-facing version (same chat, no panels).
6. Open Supabase → Table Editor → `agent_actions`. You should see your new draft rows.

## 6. Share-out

Send this to your advisor / classmates / the Paper Lantern Demo owner:

> Hey — Kairo's first wedge is live. Try the demo at `https://<your-kairo-url>.vercel.app/chat`. The password is `<your KAIRO_CHAT_PASSWORD>`. It drafts on behalf of Paper Lantern Demo Izakaya. Things to try:
> • Draft an IG post about [event/special]
> • Draft a review reply (paste the review text + star rating)
> Reply here with anything you wished it could do but couldn't. Those gaps are the most useful thing you can give me right now.

## What's still stubbed (intentionally)

`list_lapsed_guests`, `draft_winback_sms`, `fetch_pending_reviews` return placeholder data. The agent knows they're stubs; if a tester asks Kairo to "find lapsed guests," it'll surface the stub note rather than pretend. Real implementations require:

- `list_lapsed_guests` → Toast webhook ingest writing into `guests` + `visits`. Capstone W8.
- `draft_winback_sms` → still text; the *send* needs Twilio + A2P 10DLC registration (2–6 weeks).
- `fetch_pending_reviews` → Google Business Profile API or Yelp Fusion. Capstone W10.

The wedge we just shipped is enough to demo the *shape* of the product — the owner talks, Kairo listens, drafts go to the right tone in the right voice. That's the thing worth proving for the capstone defense.

---

## Appendix: optional Slack transport

Wire this up later if you want a second channel — the Paper Lantern Demo owner (or you) can also @-mention Kairo in Slack and get the same drafts. The Slack code is already in the repo; it just becomes active when the secrets are set.

1. Follow `docs/slack-app-setup.md` to create the Slack app and get `SLACK_SIGNING_SECRET` + `SLACK_BOT_TOKEN`.
2. Add them to Vercel → Environment Variables → redeploy.
3. In the Slack app, set Event Subscriptions → Request URL to `https://<your-kairo-url>.vercel.app/api/slack/events`. It should verify within 5 seconds.
4. For each owner who wants to use Slack, link their Slack user ID to a restaurant per `docs/owner-onboarding.md`.

If `SLACK_SIGNING_SECRET` / `SLACK_BOT_TOKEN` are unset, `/api/slack/events` returns 503 (clean failure, not a crash).
