// Single typed accessor for environment variables.
// Fails loudly at startup if anything required is missing.

import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),

  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  ANTHROPIC_API_KEY: z.string().min(1),
  ANTHROPIC_MODEL: z.string().default("claude-sonnet-4-6"),

  // Slack is optional: when unset, the /api/slack/events route returns 503.
  // This lets us deploy the chat-first wedge without configuring a Slack app yet.
  SLACK_SIGNING_SECRET: z.string().optional(),
  SLACK_BOT_TOKEN: z.string().optional(),
  SLACK_APP_ID: z.string().optional(),

  // Web chat — single-tenant for the capstone pilot.
  KAIRO_DEMO_RESTAURANT_SLUG: z.string().default("paper-lantern-demo"),
  // Shared password for the public /chat URL. If unset, the chat page is open.
  KAIRO_CHAT_PASSWORD: z.string().optional(),

  TOAST_CLIENT_ID: z.string().optional(),
  TOAST_CLIENT_SECRET: z.string().optional(),
  TOAST_WEBHOOK_SECRET: z.string().default(""),

  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_FROM_NUMBER: z.string().optional(),

  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().optional(),

  NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
  NEXT_PUBLIC_POSTHOG_HOST: z.string().optional(),
});

// Allow build-time and edge runtime to access without crashing — only validate
// when actually called (not at import time).
let cached: z.infer<typeof envSchema> | null = null;

export const env = new Proxy({} as z.infer<typeof envSchema>, {
  get(_target, key: string) {
    if (!cached) {
      const parsed = envSchema.safeParse(process.env);
      if (!parsed.success) {
        const issues = parsed.error.errors
          .map((e) => `  - ${e.path.join(".")}: ${e.message}`)
          .join("\n");
        throw new Error(
          `Invalid environment configuration:\n${issues}\n\nCheck .env.local against .env.example.`
        );
      }
      cached = parsed.data;
    }
    return cached[key as keyof typeof cached];
  },
});
