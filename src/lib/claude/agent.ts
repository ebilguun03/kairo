// The Kairo Owner Agent.
//
// This is the core agent loop the restaurant owner talks to from Slack
// or SMS. It uses Claude with tool use — Claude decides which tool to
// call (draft IG post, reply to reviews, run a campaign, edit website,
// etc.) and we execute it, feeding results back until Claude produces
// a final reply.
//
// Architecture
// ────────────
// 1. Every turn resolves the restaurant context up-front from the Slack user
//    ID. Tools never re-resolve — they receive the context as a closure.
// 2. Tools fall into two buckets:
//    • **Real tools** call into Claude or Supabase to produce a draft. They
//      log every invocation to `agent_actions` so we have an audit trail.
//    • **Stub tools** return placeholder data — they're shaped correctly
//      for Claude to reason about, but real implementations land in later
//      capstone weeks (lifecycle automations, reviews ingest, etc).
// 3. Nothing in this agent ever performs an irreversible action. Drafts only.

import Anthropic from "@anthropic-ai/sdk";
import { DEMO_RESTAURANT, DEMO_SALES_CONTEXT } from "@/lib/demo/sales";
import { env } from "@/lib/env";
import {
  getRestaurantContextBySlug,
  getRestaurantContextForSlackUser,
  logAgentAction,
  type RestaurantContext,
} from "@/lib/supabase/restaurants";
import { getRestaurantSnapshot, type RestaurantSnapshot } from "@/lib/supabase/demo-context";

// Each turn produces a list of these — the UI renders them as the agent's
// visible reasoning. Tool name + a one-line "what happened" string is enough
// for the demo; we deliberately do NOT expose raw payloads to the client.
export type AgentStep = {
  tool: string;
  summary: string;
};

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = (ctx: RestaurantContext | null) => `You are Kairo — an AI assistant for restaurant owners.
You help the owner of an independent restaurant run their marketing and customer
retention. You are warm, concise, and never jargon-y. The owner is busy running
a kitchen; respect their time.

${
  ctx
    ? `You are talking to ${ctx.owner.name ?? "the owner"} of ${ctx.restaurant.name}` +
      (ctx.restaurant.city ? ` in ${ctx.restaurant.city}` : "") +
      `. When tools need a restaurant identifier, that's it.`
    : `The Slack user talking to you isn't linked to a restaurant in Kairo yet.` +
      ` Politely explain that they need to be onboarded — they should reach out` +
      ` to the Kairo team to link their Slack account to their restaurant. Do not` +
      ` call any tools.`
}

${ctx?.restaurant.slug === DEMO_RESTAURANT.slug ? DEMO_SALES_CONTEXT : "No verified sales context is available for this tenant. Do not substitute another restaurant's metrics."}
Use synthetic data only for the fictional demo tenant. Explicitly label financial answers as synthetic demo data.
Toast parsing/live sync, review ingestion, lifecycle automation and SMS sending remain unfinished; do not claim they are connected.

When the owner asks you to take an action, prefer to:
1. Draft the action immediately — owners are busy, they need content fast.
2. Format drafts clearly (CAPTION: / HASHTAGS: / PHOTO BRIEF: for IG posts).
3. Never execute irreversible actions (sending SMS, posting publicly) without confirmation.

If you don't have a tool for what they want, use the sales data above to answer.`;

const TOOLS: Anthropic.Tool[] = [
  {
    name: "query_restaurant_context",
    description:
      "Look up live customer-data context for this restaurant: counts of guests, lapsed guests, pending review replies, this-month birthdays, and a few sample names. ALWAYS call this FIRST when the owner asks a question that depends on customer data or restaurant state (e.g., 'who hasn't visited in a while?', 'how's tonight looking?', 'who has a birthday soon?', 'what should I do this week?'). Returns a compact JSON snapshot you can reason over.",
    input_schema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "draft_instagram_post",
    description:
      "Draft an Instagram post for the restaurant. Returns caption text and a content brief for the photo. Does NOT publish. Use whenever the owner asks for an IG post, caption, or social copy.",
    input_schema: {
      type: "object",
      properties: {
        topic: {
          type: "string",
          description:
            "What the post is about (e.g., 'Friday omakase night', 'new seasonal cocktail').",
        },
        tone_notes: {
          type: "string",
          description:
            "Optional extra voice cues from the owner, e.g. 'extra playful tonight' or 'keep it short'. The restaurant's house brand voice is already baked in.",
        },
      },
      required: ["topic"],
    },
  },
  {
    name: "list_lapsed_guests",
    description:
      "Return guests who haven't visited in N+ days. Use to scope a win-back campaign before drafting the message.",
    input_schema: {
      type: "object",
      properties: {
        days: {
          type: "number",
          description: "Minimum days since last visit. E.g., 60.",
        },
      },
      required: ["days"],
    },
  },
  {
    name: "draft_winback_sms",
    description:
      "Draft an SMS message to send to lapsed guests. Does NOT send — owner must approve.",
    input_schema: {
      type: "object",
      properties: {
        days_since_visit: { type: "number" },
        offer: {
          type: "string",
          description: "Optional offer line, e.g., '15% off your next visit'.",
        },
      },
      required: ["days_since_visit"],
    },
  },
  {
    name: "fetch_pending_reviews",
    description:
      "Fetch reviews from Google/Yelp/OpenTable that the owner has not yet replied to.",
    input_schema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Max reviews to return. Default 10." },
      },
    },
  },
  {
    name: "draft_review_reply",
    description:
      "Draft a reply to a single review in the owner's voice. Does NOT publish. Use whenever the owner shares a review (positive or negative) and wants a response drafted.",
    input_schema: {
      type: "object",
      properties: {
        review_text: {
          type: "string",
          description: "The full text of the review the owner wants to respond to.",
        },
        rating: {
          type: "number",
          description: "Star rating, 1-5.",
        },
        source: {
          type: "string",
          description: "Where the review was posted — 'google', 'yelp', 'opentable'. Defaults to 'google'.",
        },
      },
      required: ["review_text", "rating"],
    },
  },
];

// ─────────────────────────────────────────────────────────────────
// Tool implementations
//
// `realToolImpls` actually do work via Claude/Supabase. The remaining
// stubs are scaffolded shapes that will be filled in later capstone
// weeks; they return clearly-marked placeholder data so the agent can
// still reason about workflows during demos.
// ─────────────────────────────────────────────────────────────────

type ToolImpl = (input: any) => Promise<unknown>;

function buildToolImpls(ctx: RestaurantContext | null): Record<string, ToolImpl> {
  // Shared model + Claude call for the drafting tools below.
  const draftWithClaude = async (args: {
    systemPrompt: string;
    userMessage: string;
    maxTokens?: number;
  }): Promise<string> => {
    const resp = await anthropic.messages.create({
      model: env.ANTHROPIC_MODEL,
      max_tokens: args.maxTokens ?? 600,
      system: args.systemPrompt,
      messages: [{ role: "user", content: args.userMessage }],
    });
    return resp.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
  };

  const brandVoice =
    ctx?.restaurant.brand_voice ??
    "Warm, concise, professional. No emojis. Avoid jargon and superlatives.";
  const restaurantName = ctx?.restaurant.name ?? "the restaurant";
  const restaurantConcept = ctx?.restaurant.concept ?? "";

  return {
    // ── REAL TOOL ─────────────────────────────────────────────────
    // The data layer made visible. Pulls from Supabase the moment the
    // owner asks anything that requires knowing their own customers.
    async query_restaurant_context() {
      if (!ctx?.restaurant) return { error: "no restaurant in context" };
      const snap = await getRestaurantSnapshot(ctx.restaurant.slug);
      if (!snap) return { error: "snapshot unavailable" };
      // Return a compact, agent-friendly subset of the full snapshot.
      return {
        brand_voice: snap.restaurant.brand_voice,
        guest_counts: {
          total: snap.guests.total,
          sms_opt_in: snap.guests.sms_opt_in,
          visited_last_30d: snap.guests.visited_last_30d,
          lapsed_60_180d: snap.guests.lapsed_60_180d,
          new_last_14d: snap.guests.new_last_14d,
          birthdays_this_month: snap.guests.birthdays_this_month,
        },
        sample_lapsed_guests: snap.guests.sample_lapsed,
        upcoming_birthdays: snap.guests.sample_birthdays,
        pending_review_count: snap.reviews.pending_reply,
        sample_pending_reviews: snap.reviews.sample_pending,
      };
    },

    // ── REAL TOOL ─────────────────────────────────────────────────
    async draft_instagram_post(input) {
      const topic = String(input.topic ?? "").trim();
      const toneNotes = String(input.tone_notes ?? "").trim();
      if (!topic) {
        return { error: "topic is required" };
      }

      const system = `You write Instagram captions for ${restaurantName}.
${restaurantConcept ? `Concept: ${restaurantConcept}\n` : ""}
House voice: ${brandVoice}

Output format — return EXACTLY this, nothing else:
CAPTION:
<the caption, 2-4 short lines, no hashtags>

HASHTAGS:
<5-8 short, lowercase, restaurant-relevant hashtags on one line>

PHOTO BRIEF:
<one sentence describing the ideal photo: subject, framing, lighting, mood>`;

      const userMessage =
        `Draft an Instagram post about: ${topic}` +
        (toneNotes ? `\n\nExtra voice notes for this one: ${toneNotes}` : "");

      const draft = await draftWithClaude({ systemPrompt: system, userMessage });

      await logAgentAction({
        restaurantId: ctx?.restaurant.id ?? null,
        kind: "tool_call:draft_instagram_post",
        payload: { topic, tone_notes: toneNotes, draft },
      });

      return { draft, status: "drafted_not_published" };
    },

    // ── REAL TOOL ─────────────────────────────────────────────────
    async draft_review_reply(input) {
      const reviewText = String(input.review_text ?? "").trim();
      const rating = Number(input.rating);
      const source = String(input.source ?? "google").toLowerCase();
      if (!reviewText) return { error: "review_text is required" };
      if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
        return { error: "rating must be a number 1-5" };
      }

      const system = `You draft public review replies for ${restaurantName}.
${restaurantConcept ? `Concept: ${restaurantConcept}\n` : ""}
House voice: ${brandVoice}

Rules:
• Address the reviewer warmly without being saccharine.
• 2-4 short sentences. No emojis. No "we strive to" cliches.
• If the review is positive (4-5 stars), thank them for a specific thing they mentioned.
• If it's mixed (2-3 stars), acknowledge their experience honestly and invite them back to discuss.
• If it's negative (1 star), do not be defensive. Acknowledge, take responsibility for what's ours to take, and offer a private channel (email or phone) to make it right. Never argue facts in public.
• Sign off with the restaurant name only — no first names.

Return ONLY the reply text. No labels, no quotes, no preamble.`;

      const userMessage = `Source: ${source}
Rating: ${rating} star${rating === 1 ? "" : "s"}
Review text:
"""
${reviewText}
"""`;

      const draft = await draftWithClaude({ systemPrompt: system, userMessage });

      await logAgentAction({
        restaurantId: ctx?.restaurant.id ?? null,
        kind: "tool_call:draft_review_reply",
        payload: { source, rating, review_text: reviewText, draft },
      });

      return { draft, status: "drafted_not_published" };
    },

    // ── STUB ──────────────────────────────────────────────────────
    async list_lapsed_guests(input) {
      return {
        count: 0,
        sample: [],
        note: `[stub — backed by guests table once Toast ingest lands] Filter would be: last_visit_at < now() - interval '${input.days} days'.`,
      };
    },

    // ── STUB ──────────────────────────────────────────────────────
    async draft_winback_sms(input) {
      const offer = input.offer ?? "we'd love to see you again";
      return {
        sms: `[stub] Hi {first_name} — it's been a minute! ${offer}. Reply STOP to opt out.`,
        compliance_note:
          "TCPA + A2P 10DLC: include opt-in proof and STOP language; never send before 10dlc registration.",
      };
    },

    // ── STUB ──────────────────────────────────────────────────────
    async fetch_pending_reviews() {
      return {
        reviews: [],
        note: "[stub — wire to Google Business Profile API + Yelp Fusion]. For now, paste a review text directly into chat and ask Kairo to draft a reply.",
      };
    },
  };
}

// ─────────────────────────────────────────────────────────────────
// Core agent loop — transport-agnostic.
//
// Returns BOTH the final reply text and the list of agent steps (tool calls
// the agent made along the way). Callers that don't care about steps can
// ignore them; the /demo surface renders them as visible reasoning.
// ─────────────────────────────────────────────────────────────────
async function runAgentLoop(
  messages: Anthropic.MessageParam[],
  ctx: RestaurantContext | null
): Promise<{ reply: string; steps: AgentStep[] }> {
  const toolImpls = buildToolImpls(ctx);
  const steps: AgentStep[] = [];

  for (let turn = 0; turn < 6; turn++) {
    const response = await anthropic.messages.create({
      model: env.ANTHROPIC_MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT(ctx),
      tools: TOOLS,
      messages,
    });

    if (response.stop_reason === "end_turn" || response.stop_reason === "stop_sequence") {
      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      return { reply: text || "(no reply)", steps };
    }

    if (response.stop_reason === "tool_use") {
      const toolUses = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
      );

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      let shortCircuitReply: string | null = null;

      for (const use of toolUses) {
        const impl = toolImpls[use.name];
        const result = impl
          ? await impl(use.input).catch((e) => ({ error: String(e) }))
          : { error: `unknown tool: ${use.name}` };
        steps.push({
          tool: use.name,
          summary: summarizeStep(use.name, use.input, result),
        });
        toolResults.push({
          type: "tool_result",
          tool_use_id: use.id,
          content: JSON.stringify(result),
        });

        // For draft tools that produce a single clean text output, return the
        // draft directly so the agent doesn't wrap it in markdown commentary.
        if (
          (use.name === "draft_review_reply" || use.name === "draft_winback_sms" || use.name === "draft_instagram_post") &&
          typeof result === "object" && result !== null
        ) {
          const r = result as Record<string, unknown>;
          const directDraft = r.draft ?? r.sms ?? r.caption;
          if (typeof directDraft === "string" && directDraft.trim()) {
            shortCircuitReply = directDraft.trim();
          }
        }
      }

      if (shortCircuitReply) {
        return { reply: shortCircuitReply, steps };
      }

      messages.push({ role: "assistant", content: response.content });
      messages.push({ role: "user", content: toolResults });
      continue;
    }

    // Any other stop reason: bail.
    break;
  }

  return {
    reply: "I hit my safety limit on this turn — try rephrasing in smaller steps.",
    steps,
  };
}

// Produces the one-line "what happened" string for the audience. Kept here
// next to the loop so adding a new tool is a single place to update.
function summarizeStep(tool: string, input: unknown, result: unknown): string {
  const r = (result ?? {}) as Record<string, unknown>;
  switch (tool) {
    case "query_restaurant_context": {
      const counts = (r.guest_counts ?? {}) as Record<string, number>;
      const parts: string[] = [];
      if (typeof counts.lapsed_60_180d === "number") parts.push(`${counts.lapsed_60_180d} lapsed guests`);
      if (typeof counts.birthdays_this_month === "number") parts.push(`${counts.birthdays_this_month} birthdays this month`);
      if (typeof r.pending_review_count === "number") parts.push(`${r.pending_review_count} pending reviews`);
      return parts.length ? `Read the demo restaurant's customer context: ${parts.join(", ")}.` : "Read the demo restaurant's customer context.";
    }
    case "draft_instagram_post": {
      const topic = ((input as Record<string, unknown> | undefined)?.topic as string) ?? "post";
      return `Drafted an Instagram post about "${topic}" in the demo restaurant's brand voice.`;
    }
    case "draft_review_reply": {
      const rating = ((input as Record<string, unknown> | undefined)?.rating as number) ?? 0;
      return `Drafted a ${rating}★ review reply in the demo restaurant's brand voice.`;
    }
    case "list_lapsed_guests": {
      const days = ((input as Record<string, unknown> | undefined)?.days as number) ?? 60;
      const count = (r.count as number) ?? 0;
      return `Found ${count} guests who haven't visited in ${days}+ days.`;
    }
    case "draft_winback_sms":
      return "Drafted a win-back SMS for lapsed guests (TCPA-compliant template).";
    case "fetch_pending_reviews":
      return "Checked for review-reply queue (stub — paste a review to draft a reply).";
    default:
      return `Called ${tool}.`;
  }
}

/**
 * Slack transport entry point. One message in, one reply out.
 * Resolves the restaurant context via the Slack user → owner join.
 */
export async function runOwnerAgent(args: {
  userMessage: string;
  slackUserId: string;
}): Promise<string> {
  const ctx = await getRestaurantContextForSlackUser(args.slackUserId);
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: args.userMessage },
  ];
  const { reply } = await runAgentLoop(messages, ctx);
  return reply;
}

/**
 * Web-chat transport entry point. The client owns the conversation history
 * and re-sends it on every turn; we treat the server as stateless.
 *
 * `restaurantSlug` selects which restaurant the agent is acting on behalf of.
 * For the capstone pilot this is hard-pinned to the demo restaurant via the
 * KAIRO_DEMO_RESTAURANT_SLUG env var.
 *
 * Returns the reply text AND the list of agent steps. /chat ignores steps;
 * /demo renders them as visible reasoning.
 */
// Fallback context used when Supabase is not configured (e.g. demo without DB).
const DEMO_CTX: RestaurantContext = {
  restaurant: {
    id: "demo",
    slug: DEMO_RESTAURANT.slug,
    name: "Paper Lantern Demo Izakaya",
    concept: "Japanese izakaya & sushi bar",
    city: DEMO_RESTAURANT.city,
    state: DEMO_RESTAURANT.state,
    brand_voice: "Warm, concise, authentic Japanese hospitality",
    created_at: new Date().toISOString(),
  },
  owner: {
    id: "demo-owner",
    restaurant_id: "demo",
    email: DEMO_RESTAURANT.email,
    name: DEMO_RESTAURANT.owner,
    slack_user_id: null,
    phone: null,
    created_at: new Date().toISOString(),
  },
};

export async function runOwnerAgentChat(args: {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  restaurantSlug: string;
}): Promise<{ reply: string; steps: AgentStep[] }> {
  const ctx = (await getRestaurantContextBySlug(args.restaurantSlug)) ?? DEMO_CTX;
  const messages: Anthropic.MessageParam[] = args.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));
  return runAgentLoop(messages, ctx);
}
