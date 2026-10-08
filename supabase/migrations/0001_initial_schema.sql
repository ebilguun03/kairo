-- ──────────────────────────────────────────────────────────────────
-- Kairo — initial schema
-- Apply this in the Supabase SQL editor (Project → SQL → New query)
-- or via the Supabase CLI: `supabase db push`
-- ──────────────────────────────────────────────────────────────────

-- Required extensions
create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

-- ─── restaurants ──────────────────────────────────────────────────
create table if not exists restaurants (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  concept text,
  city text,
  state text,
  brand_voice text,
  toast_restaurant_guid text,
  google_place_id text,
  yelp_business_id text,
  created_at timestamptz not null default now()
);

-- ─── owners ───────────────────────────────────────────────────────
create table if not exists owners (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  email text not null unique,
  name text,
  slack_user_id text,
  phone text,
  created_at timestamptz not null default now()
);
create index if not exists owners_restaurant_idx on owners(restaurant_id);
create index if not exists owners_slack_user_idx on owners(slack_user_id);

-- ─── guests ───────────────────────────────────────────────────────
create table if not exists guests (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  first_name text,
  last_name text,
  email text,
  phone text,
  birth_month int check (birth_month between 1 and 12),
  sms_opt_in boolean not null default false,
  email_opt_in boolean not null default false,
  first_visit_at timestamptz,
  last_visit_at timestamptz,
  visit_count int not null default 0,
  created_at timestamptz not null default now(),
  unique (restaurant_id, phone),
  unique (restaurant_id, email)
);
create index if not exists guests_last_visit_idx on guests(restaurant_id, last_visit_at);

-- ─── visits & orders ──────────────────────────────────────────────
create table if not exists visits (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  guest_id uuid references guests(id) on delete set null,
  toast_order_id text,
  visited_at timestamptz not null,
  subtotal_cents int,
  party_size int,
  source text, -- 'walk_in' | 'reservation' | 'online_order' | ...
  raw jsonb
);
create index if not exists visits_guest_idx on visits(guest_id);
create index if not exists visits_restaurant_time_idx on visits(restaurant_id, visited_at desc);
create unique index if not exists visits_toast_order_uniq
  on visits(restaurant_id, toast_order_id) where toast_order_id is not null;

-- ─── campaigns ────────────────────────────────────────────────────
-- A campaign is a planned/triggered batch of messages.
create table if not exists campaigns (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  kind text not null, -- 'follow_up_24h' | 'birthday' | 'lapsed_30' | 'lapsed_60' | 'broadcast' ...
  status text not null default 'draft', -- 'draft' | 'approved' | 'sending' | 'sent' | 'cancelled'
  payload jsonb not null default '{}'::jsonb,
  scheduled_for timestamptz,
  sent_at timestamptz,
  created_by uuid references owners(id),
  created_at timestamptz not null default now()
);
create index if not exists campaigns_restaurant_idx on campaigns(restaurant_id, created_at desc);

-- ─── messages ─────────────────────────────────────────────────────
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  guest_id uuid references guests(id) on delete set null,
  campaign_id uuid references campaigns(id) on delete set null,
  channel text not null check (channel in ('sms', 'email')),
  direction text not null check (direction in ('outbound', 'inbound')),
  status text not null, -- 'queued' | 'sent' | 'delivered' | 'failed' | 'replied'
  body text not null,
  provider_message_id text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists messages_guest_idx on messages(guest_id);
create index if not exists messages_campaign_idx on messages(campaign_id);

-- ─── reviews ──────────────────────────────────────────────────────
create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  source text not null, -- 'google' | 'yelp' | 'opentable'
  source_review_id text not null,
  author text,
  rating int,
  body text,
  posted_at timestamptz,
  replied_at timestamptz,
  reply_body text,
  created_at timestamptz not null default now(),
  unique (source, source_review_id)
);
create index if not exists reviews_restaurant_idx on reviews(restaurant_id, posted_at desc);

-- ─── social_posts ─────────────────────────────────────────────────
create table if not exists social_posts (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  platform text not null, -- 'instagram' | 'tiktok' | 'facebook' | 'x'
  status text not null default 'draft', -- 'draft' | 'approved' | 'scheduled' | 'posted' | 'failed'
  caption text,
  media_url text,
  scheduled_for timestamptz,
  posted_at timestamptz,
  external_post_id text,
  created_at timestamptz not null default now()
);
create index if not exists social_posts_restaurant_idx on social_posts(restaurant_id, created_at desc);

-- ─── integrations (encrypted credentials per restaurant) ──────────
create table if not exists integrations (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  provider text not null, -- 'toast' | 'google' | 'yelp' | 'instagram' | ...
  credentials jsonb not null, -- store opaque blobs; consider pgsodium for at-rest encryption
  status text not null default 'active',
  created_at timestamptz not null default now(),
  unique (restaurant_id, provider)
);

-- ─── agent_actions (full audit log) ───────────────────────────────
-- Every meaningful action the agent takes — for debugging, audit, and
-- (importantly) for the "show the owner what I did this week" digest.
create table if not exists agent_actions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid references restaurants(id) on delete set null,
  kind text not null, -- 'tool_call' | 'campaign_sent' | 'review_replied' | 'toast_webhook' | ...
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists agent_actions_restaurant_idx on agent_actions(restaurant_id, created_at desc);

-- ─── Row-Level Security ───────────────────────────────────────────
-- Multi-tenant isolation: every table is scoped by restaurant_id.
-- Real policies depend on how owners are authenticated (Supabase Auth + a
-- mapping table). For now, RLS is enabled but policies are TODO so the
-- service-role key works during development. Add policies before any
-- second-tenant data lands in the system.

alter table restaurants enable row level security;
alter table owners enable row level security;
alter table guests enable row level security;
alter table visits enable row level security;
alter table campaigns enable row level security;
alter table messages enable row level security;
alter table reviews enable row level security;
alter table social_posts enable row level security;
alter table integrations enable row level security;
alter table agent_actions enable row level security;

-- Seed: fictional demo tenant only; no real partner or customer data.
insert into restaurants (slug, name, concept, city, state, brand_voice)
values (
  'paper-lantern-demo',
  'Paper Lantern Demo Izakaya',
  'Fictional Japanese neighborhood izakaya in Demo Harbor. Seasonal plates, sushi bar, private dining and tasting menu.',
  'Demo Harbor',
  'WA',
  'Warm and intentional. Knowledgeable about Japanese cuisine without being precious. Short sentences. No emojis. Lean on sensory detail.'
)
on conflict (slug) do nothing;
