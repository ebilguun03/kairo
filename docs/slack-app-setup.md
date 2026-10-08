# Slack app setup

End-to-end, this takes about 20 minutes the first time.

## 1. Create the app

1. Visit https://api.slack.com/apps → **Create New App** → **From scratch**.
2. App Name: `Kairo (dev)`. Workspace: your personal workspace.

## 2. Bot token scopes

**OAuth & Permissions → Scopes → Bot Token Scopes**, add:

- `app_mentions:read` — receive @mentions of the bot
- `chat:write` — send messages
- `im:history` — read DMs sent to the bot
- `im:read` — see DM channels
- `im:write` — open DMs with users
- `users:read` — resolve user IDs to names

## 3. Install to workspace

**Install App → Install to Workspace**. Approve.

Copy the **Bot User OAuth Token** (`xoxb-...`) into `.env.local` as `SLACK_BOT_TOKEN`.

## 4. Signing secret

**Basic Information → App Credentials → Signing Secret → Show**.
Copy into `.env.local` as `SLACK_SIGNING_SECRET`.

## 5. Event subscriptions

**Event Subscriptions → toggle ON**.

- **Request URL:** `https://YOUR.ngrok-free.app/api/slack/events`
  Slack verifies this URL by sending a challenge. Make sure `npm run dev` and `ngrok` are both running first. The route handles the challenge automatically.
- **Subscribe to bot events:**
  - `app_mention`
  - `message.im`

Save changes. Reinstall the app if Slack prompts you (scope changes require reinstall).

## 6. App home

**App Home → Show Tabs**. Enable the **Messages Tab** so users can DM the bot.

## 7. Test

In Slack:

```
/invite @Kairo (dev)
@Kairo (dev) draft an Instagram post about Friday omakase
```

You should see Kairo respond within a few seconds with a draft caption (currently a stub — implement real post drafting in `src/lib/claude/agent.ts`).

## 8. Production app

When you're ready to deploy to Vercel and demo to the Ozora owner, create a SECOND Slack app called `Kairo` (no `(dev)` suffix), point it at your Vercel URL, and have the owner install it in his workspace. Keep the dev app for your own iteration.
