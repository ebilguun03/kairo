// Helpers for the /demo surface. These read directly from the seeded
// Supabase tables (guests, visits, reviews, agent_actions) and produce
// the small structured snapshots that show up in the left-side context
// panel and feed the agent's query_restaurant_context tool.
//
// All queries are scoped by restaurant_id. Service-role client only.

import { supabaseService } from "@/lib/supabase/server";
import type { Database } from "@/lib/types";

type Guest = Database["public"]["Tables"]["guests"]["Row"];
type Review = Database["public"]["Tables"]["reviews"]["Row"];
type AgentAction = Database["public"]["Tables"]["agent_actions"]["Row"];

export type RestaurantSnapshot = {
  restaurant: {
    id: string;
    name: string;
    concept: string | null;
    brand_voice: string | null;
  };
  guests: {
    total: number;
    sms_opt_in: number;
    visited_last_30d: number;
    lapsed_60_180d: number;
    new_last_14d: number;
    birthdays_this_month: number;
    sample_lapsed: Array<Pick<Guest, "first_name" | "last_name" | "last_visit_at" | "visit_count">>;
    sample_birthdays: Array<Pick<Guest, "first_name" | "last_name" | "birth_month">>;
  };
  reviews: {
    total: number;
    pending_reply: number;
    sample_pending: Array<Pick<Review, "source" | "rating" | "author" | "body" | "posted_at">>;
  };
  recent_actions: Array<Pick<AgentAction, "id" | "kind" | "payload" | "created_at">>;
};

export async function getRestaurantSnapshot(slug: string): Promise<RestaurantSnapshot | null> {
  const supabase = supabaseService();

  // Restaurant row
  const restRes = await supabase
    .from("restaurants")
    .select("id, name, concept, brand_voice")
    .eq("slug", slug)
    .maybeSingle();
  const restaurant = restRes.data as { id: string; name: string; concept: string | null; brand_voice: string | null } | null;
  if (!restaurant) return null;
  const rid = restaurant.id;

  // Pull all guests once; do the slicing in-memory. Cheap at 30 rows; would
  // become two-or-three count(*) queries at 30,000.
  const guestsRes = await supabase
    .from("guests")
    .select("*")
    .eq("restaurant_id", rid);
  const guests = (guestsRes.data as Guest[] | null) ?? [];

  const now = Date.now();
  const days = (d: number) => 1000 * 60 * 60 * 24 * d;
  const lastVisitMs = (g: Guest) => (g.last_visit_at ? new Date(g.last_visit_at).getTime() : 0);
  const visitedLast30 = guests.filter((g) => now - lastVisitMs(g) <= days(30));
  const lapsed = guests.filter((g) => {
    const dt = now - lastVisitMs(g);
    return dt > days(60) && dt < days(180);
  });
  const newGuests = guests.filter((g) => {
    const first = g.first_visit_at ? new Date(g.first_visit_at).getTime() : 0;
    return now - first <= days(14);
  });
  const thisMonth = new Date().getMonth() + 1;
  const birthdays = guests.filter((g) => g.birth_month === thisMonth);
  const smsOpt = guests.filter((g) => g.sms_opt_in === true);

  // Reviews
  const reviewsRes = await supabase
    .from("reviews")
    .select("*")
    .eq("restaurant_id", rid)
    .order("posted_at", { ascending: false });
  const reviews = (reviewsRes.data as Review[] | null) ?? [];
  const pendingReviews = reviews.filter((r) => !r.reply_body);

  // Recent agent actions
  const actionsRes = await supabase
    .from("agent_actions")
    .select("id, kind, payload, created_at")
    .eq("restaurant_id", rid)
    .order("created_at", { ascending: false })
    .limit(8);
  const actions = (actionsRes.data as AgentAction[] | null) ?? [];

  return {
    restaurant,
    guests: {
      total: guests.length,
      sms_opt_in: smsOpt.length,
      visited_last_30d: visitedLast30.length,
      lapsed_60_180d: lapsed.length,
      new_last_14d: newGuests.length,
      birthdays_this_month: birthdays.length,
      sample_lapsed: lapsed
        .sort((a, b) => lastVisitMs(b) - lastVisitMs(a))
        .slice(0, 5)
        .map((g) => ({
          first_name: g.first_name,
          last_name: g.last_name,
          last_visit_at: g.last_visit_at,
          visit_count: g.visit_count,
        })),
      sample_birthdays: birthdays.slice(0, 5).map((g) => ({
        first_name: g.first_name,
        last_name: g.last_name,
        birth_month: g.birth_month,
      })),
    },
    reviews: {
      total: reviews.length,
      pending_reply: pendingReviews.length,
      sample_pending: pendingReviews.slice(0, 4).map((r) => ({
        source: r.source,
        rating: r.rating,
        author: r.author,
        body: r.body,
        posted_at: r.posted_at,
      })),
    },
    recent_actions: actions.map((a) => ({
      id: a.id,
      kind: a.kind,
      payload: a.payload,
      created_at: a.created_at,
    })),
  };
}
