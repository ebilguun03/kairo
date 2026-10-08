// Restaurant-context lookups for the Owner Agent.
//
// Every Slack message into Kairo comes from a Slack user ID. We resolve that
// to a `restaurant` row by way of the `owners` table, so tools always know
// which tenant's data they're acting on.

import { supabaseService } from "@/lib/supabase/server";
import type { Database } from "@/lib/types";

type Restaurant = Database["public"]["Tables"]["restaurants"]["Row"];
type Owner = Database["public"]["Tables"]["owners"]["Row"];

export type RestaurantContext = {
  restaurant: Restaurant;
  owner: Owner;
};

/**
 * Look up the restaurant + owner record for a given Slack user.
 *
 * Returns null if no `owners` row has this slack_user_id — that's how we
 * detect a Slack user who hasn't been onboarded into Kairo yet.
 */
export async function getRestaurantContextForSlackUser(
  slackUserId: string
): Promise<RestaurantContext | null> {
  if (!slackUserId) return null;
  const supabase = supabaseService();

  const ownerRes = await supabase
    .from("owners")
    .select("*")
    .eq("slack_user_id", slackUserId)
    .maybeSingle();
  const owner = ownerRes.data as Owner | null;

  if (ownerRes.error) {
    console.error("[restaurants] owner lookup failed:", ownerRes.error);
    return null;
  }
  if (!owner) return null;

  const restRes = await supabase
    .from("restaurants")
    .select("*")
    .eq("id", owner.restaurant_id)
    .maybeSingle();
  const restaurant = restRes.data as Restaurant | null;

  if (restRes.error) {
    console.error("[restaurants] restaurant lookup failed:", restRes.error);
    return null;
  }
  if (!restaurant) return null;

  return { restaurant, owner };
}

/**
 * Look up a restaurant by its slug, with a synthetic owner record.
 *
 * Used by the web-chat transport where there's no per-user identity — every
 * chat message is attributed to the demo restaurant directly. The "owner"
 * is a placeholder so downstream code that expects `ctx.owner.name` still works.
 */
export async function getRestaurantContextBySlug(
  slug: string
): Promise<RestaurantContext | null> {
  if (!slug) return null;
  const supabase = supabaseService();

  const restRes = await supabase
    .from("restaurants")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  const restaurant = restRes.data as Restaurant | null;

  if (restRes.error) {
    console.error("[restaurants] slug lookup failed:", restRes.error);
    return null;
  }
  if (!restaurant) return null;

  // Try to find a real owner row to attach. Fall back to a synthetic record
  // so the agent has *something* to address.
  const ownerRes = await supabase
    .from("owners")
    .select("*")
    .eq("restaurant_id", restaurant.id)
    .limit(1)
    .maybeSingle();
  const owner = ownerRes.data as Owner | null;

  return {
    restaurant,
    owner:
      owner ??
      ({
        id: "web-chat",
        restaurant_id: restaurant.id,
        email: "web-chat@example.com",
        name: "owner",
        slack_user_id: null,
        phone: null,
        created_at: new Date().toISOString(),
      } as Owner),
  };
}

/**
 * Persist an agent action to the audit log. Fire-and-forget — we never want
 * a logging failure to break a user-visible flow.
 */
export async function logAgentAction(args: {
  restaurantId: string | null;
  kind: string;
  payload: Record<string, unknown>;
}) {
  try {
    const supabase = supabaseService();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await supabase.from("agent_actions").insert({
      restaurant_id: args.restaurantId,
      kind: args.kind,
      payload: args.payload,
    } as any);
  } catch (err) {
    console.error("[restaurants] logAgentAction failed:", err);
  }
}
