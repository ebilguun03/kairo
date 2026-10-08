// Generated-style Database type stub. In a real project, generate this
// from Supabase with: `npx supabase gen types typescript --project-id ...`
//
// This stub keeps the supabase-js generic happy until you generate the real
// types. Add or update entries as the schema evolves.

export type Database = {
  public: {
    Tables: {
      restaurants: {
        Row: {
          id: string;
          slug: string;
          name: string;
          concept: string | null;
          city: string | null;
          state: string | null;
          brand_voice: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["restaurants"]["Row"]> & {
          slug: string;
          name: string;
        };
        Update: Partial<Database["public"]["Tables"]["restaurants"]["Row"]>;
      };
      owners: {
        Row: {
          id: string;
          restaurant_id: string;
          email: string;
          name: string | null;
          slack_user_id: string | null;
          phone: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["owners"]["Row"]> & {
          restaurant_id: string;
          email: string;
        };
        Update: Partial<Database["public"]["Tables"]["owners"]["Row"]>;
      };
      guests: {
        Row: {
          id: string;
          restaurant_id: string;
          first_name: string | null;
          last_name: string | null;
          email: string | null;
          phone: string | null;
          birth_month: number | null;
          sms_opt_in: boolean;
          email_opt_in: boolean;
          first_visit_at: string | null;
          last_visit_at: string | null;
          visit_count: number;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["guests"]["Row"]> & {
          restaurant_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["guests"]["Row"]>;
      };
      visits: {
        Row: {
          id: string;
          restaurant_id: string;
          guest_id: string | null;
          toast_order_id: string | null;
          visited_at: string;
          subtotal_cents: number | null;
          party_size: number | null;
          source: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["visits"]["Row"]> & {
          restaurant_id: string;
          visited_at: string;
        };
        Update: Partial<Database["public"]["Tables"]["visits"]["Row"]>;
      };
      campaigns: {
        Row: {
          id: string;
          restaurant_id: string;
          kind: string;
          status: string;
          payload: Record<string, unknown>;
          scheduled_for: string | null;
          sent_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["campaigns"]["Row"]> & {
          restaurant_id: string;
          kind: string;
        };
        Update: Partial<Database["public"]["Tables"]["campaigns"]["Row"]>;
      };
      messages: {
        Row: {
          id: string;
          restaurant_id: string;
          guest_id: string | null;
          channel: "sms" | "email";
          direction: "outbound" | "inbound";
          status: string;
          body: string;
          campaign_id: string | null;
          sent_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["messages"]["Row"]> & {
          restaurant_id: string;
          channel: "sms" | "email";
          direction: "outbound" | "inbound";
          status: string;
          body: string;
        };
        Update: Partial<Database["public"]["Tables"]["messages"]["Row"]>;
      };
      reviews: {
        Row: {
          id: string;
          restaurant_id: string;
          source: string;
          source_review_id: string;
          author: string | null;
          rating: number | null;
          body: string | null;
          posted_at: string | null;
          replied_at: string | null;
          reply_body: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["reviews"]["Row"]> & {
          restaurant_id: string;
          source: string;
          source_review_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["reviews"]["Row"]>;
      };
      social_posts: {
        Row: {
          id: string;
          restaurant_id: string;
          platform: string;
          status: string;
          caption: string | null;
          media_url: string | null;
          scheduled_for: string | null;
          posted_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["social_posts"]["Row"]> & {
          restaurant_id: string;
          platform: string;
        };
        Update: Partial<Database["public"]["Tables"]["social_posts"]["Row"]>;
      };
      agent_actions: {
        Row: {
          id: string;
          restaurant_id: string | null;
          kind: string;
          payload: Record<string, unknown>;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["agent_actions"]["Row"]> & {
          kind: string;
          payload: Record<string, unknown>;
        };
        Update: Partial<Database["public"]["Tables"]["agent_actions"]["Row"]>;
      };
      menu_sales: {
        Row: {
          id: string;
          restaurant_id: string;
          month: string;
          item: string;
          menu_group: string | null;
          qty_sold: number;
          gross_sales: number;
          net_sales: number;
          avg_price: number | null;
          discount_amt: number;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["menu_sales"]["Row"]> & {
          restaurant_id: string;
          month: string;
          item: string;
          qty_sold: number;
          gross_sales: number;
          net_sales: number;
        };
        Update: Partial<Database["public"]["Tables"]["menu_sales"]["Row"]>;
      };
    };
  };
};
