-- ─────────────────────────────────────────────────────────────────
-- Kairo — demo seed for Paper Lantern Demo Izakaya
--
-- Entirely synthetic guests, reviews, visits and contact details; not real customers.
-- Populates guests / visits / reviews / agent_actions with realistic
-- data so the /demo page shows non-trivial context. Idempotent:
-- safe to re-run; existing demo rows are deleted first.
--
-- Run this ONCE in the Supabase SQL editor for the kairo-prod project
-- AFTER the schema migration has been applied.
-- ─────────────────────────────────────────────────────────────────

do $$
declare
  r_id uuid;
begin
  select id into r_id from restaurants where slug = 'paper-lantern-demo';
  if r_id is null then
    raise exception 'Paper Lantern Demo restaurant row not found. Apply the schema migration first.';
  end if;

  -- Wipe prior demo data for this restaurant so re-runs are clean.
  delete from agent_actions where restaurant_id = r_id and (payload->>'demo' = 'true');
  delete from reviews where restaurant_id = r_id;
  delete from visits where restaurant_id = r_id;
  delete from guests where restaurant_id = r_id;

  -- ─── GUESTS ──────────────────────────────────────────────────
  -- 30 guests with explicitly fictional names and example.com contact addresses.
  -- Mix of recently-visited, lapsed (60+ days), and brand-new.
  -- birth_month is set so a handful have birthdays this month and next.
  insert into guests
    (restaurant_id, first_name, last_name, email, phone, birth_month,
     sms_opt_in, email_opt_in, first_visit_at, last_visit_at, visit_count)
  values
    -- ── Recent regulars (visited in last 30 days) ─────────────
    (r_id, 'Avery', 'Demo', 'guest01@example.com', '+12025550101', extract(month from now())::int,  true,  true,  now() - interval '8 months',  now() - interval '6 days',   7),
    (r_id, 'Blair', 'Demo', 'guest02@example.com', '+12025550102', extract(month from now())::int,  true,  true,  now() - interval '10 months', now() - interval '11 days',  9),
    (r_id, 'Cameron', 'Demo', 'guest03@example.com', '+12025550103', extract(month from now())::int,  true,  false, now() - interval '5 months',  now() - interval '4 days',   4),
    (r_id, 'Drew', 'Demo', 'guest04@example.com', '+12025550104', extract(month from now())::int, true,  true,  now() - interval '14 months', now() - interval '2 days',  12),
    (r_id, 'Emery', 'Demo', 'guest05@example.com', '+12025550105', extract(month from now())::int,  true,  true,  now() - interval '7 months',  now() - interval '17 days',  5),
    (r_id, 'Finley', 'Demo', 'guest06@example.com', '+12025550106', extract(month from now())::int,  false, true,  now() - interval '6 months',  now() - interval '9 days',   3),
    (r_id, 'Harper', 'Demo', 'guest07@example.com', '+12025550107', ((extract(month from now())::int + 7 - 1) % 12) + 1, true,  true,  now() - interval '11 months', now() - interval '20 days',  8),
    (r_id, 'Jules', 'Demo', 'guest08@example.com', '+12025550108', ((extract(month from now())::int + 8 - 1) % 12) + 1,  true,  true,  now() - interval '4 months',  now() - interval '1 day',    3),

    -- ── Mid-activity (visited 30-60 days ago) ─────────────────
    (r_id, 'Kai', 'Demo', 'guest09@example.com', '+12025550109', ((extract(month from now())::int + 9 - 1) % 12) + 1,  true,  true,  now() - interval '9 months',  now() - interval '35 days',  4),
    (r_id, 'Lee', 'Demo', 'guest10@example.com', '+12025550110', ((extract(month from now())::int + 10 - 1) % 12) + 1,  false, true,  now() - interval '6 months',  now() - interval '42 days',  2),
    (r_id, 'Marin', 'Demo', 'guest11@example.com', '+12025550111', ((extract(month from now())::int + 11 - 1) % 12) + 1,  true,  true,  now() - interval '8 months',  now() - interval '48 days',  5),
    (r_id, 'Robin', 'Demo', 'guest12@example.com', '+12025550112', ((extract(month from now())::int + 1 - 1) % 12) + 1,  true,  false, now() - interval '12 months', now() - interval '55 days',  6),
    (r_id, 'Casey', 'Demo', 'guest13@example.com', '+12025550113', ((extract(month from now())::int + 2 - 1) % 12) + 1, true,  true,  now() - interval '7 months',  now() - interval '38 days',  3),

    -- ── Lapsed guests (60-180 days since last visit) ──────────
    (r_id, 'Morgan', 'Demo', 'guest14@example.com', '+12025550114', ((extract(month from now())::int + 3 - 1) % 12) + 1,  true,  true,  now() - interval '14 months', now() - interval '65 days',  4),
    (r_id, 'Noel', 'Demo', 'guest15@example.com', '+12025550115', ((extract(month from now())::int + 4 - 1) % 12) + 1,  true,  true,  now() - interval '13 months', now() - interval '72 days',  6),
    (r_id, 'Parker', 'Demo', 'guest16@example.com', '+12025550116', ((extract(month from now())::int + 5 - 1) % 12) + 1,  true,  false, now() - interval '11 months', now() - interval '88 days',  3),
    (r_id, 'Quinn', 'Demo', 'guest17@example.com', '+12025550117', ((extract(month from now())::int + 6 - 1) % 12) + 1,  false, true,  now() - interval '10 months', now() - interval '95 days',  2),
    (r_id, 'Reese', 'Demo', 'guest18@example.com', '+12025550118', ((extract(month from now())::int + 7 - 1) % 12) + 1,  true,  true,  now() - interval '15 months', now() - interval '102 days', 5),
    (r_id, 'Rowan', 'Demo', 'guest19@example.com', '+12025550119', ((extract(month from now())::int + 8 - 1) % 12) + 1,  true,  false, now() - interval '14 months', now() - interval '115 days', 4),
    (r_id, 'Sage', 'Demo', 'guest20@example.com', '+12025550120', ((extract(month from now())::int + 9 - 1) % 12) + 1,  true,  true,  now() - interval '13 months', now() - interval '128 days', 3),
    (r_id, 'Shay', 'Demo', 'guest21@example.com', '+12025550121', ((extract(month from now())::int + 10 - 1) % 12) + 1,  false, true,  now() - interval '12 months', now() - interval '140 days', 2),
    (r_id, 'Taylor', 'Demo', 'guest22@example.com', '+12025550122', ((extract(month from now())::int + 11 - 1) % 12) + 1,  true,  true,  now() - interval '16 months', now() - interval '155 days', 4),
    (r_id, 'Toby', 'Demo', 'guest23@example.com', '+12025550123', ((extract(month from now())::int + 1 - 1) % 12) + 1,  true,  true,  now() - interval '14 months', now() - interval '172 days', 3),

    -- ── New guests (first visit in last 14 days) ──────────────
    (r_id, 'Val', 'Demo', 'guest24@example.com', '+12025550124', ((extract(month from now())::int + 2 - 1) % 12) + 1,  true,  true,  now() - interval '5 days',    now() - interval '5 days',   1),
    (r_id, 'Winter', 'Demo', 'guest25@example.com', '+12025550125', ((extract(month from now())::int + 3 - 1) % 12) + 1,  true,  true,  now() - interval '12 days',   now() - interval '12 days',  1),
    (r_id, 'Wren', 'Demo', 'guest26@example.com', '+12025550126', ((extract(month from now())::int + 4 - 1) % 12) + 1,  false, true,  now() - interval '3 days',    now() - interval '3 days',   1),
    (r_id, 'Sky', 'Demo', 'guest27@example.com', '+12025550127', ((extract(month from now())::int + 5 - 1) % 12) + 1,  true,  false, now() - interval '10 days',   now() - interval '10 days',  1),

    -- ── High-value VIP (visits monthly) ───────────────────────
    (r_id, 'Indigo', 'Demo', 'guest28@example.com', '+12025550128', ((extract(month from now())::int + 6 - 1) % 12) + 1,  true,  true,  now() - interval '18 months', now() - interval '14 days', 16),
    (r_id, 'Ash', 'Demo', 'guest29@example.com', '+12025550129', ((extract(month from now())::int + 7 - 1) % 12) + 1,  true,  true,  now() - interval '20 months', now() - interval '21 days', 22),
    (r_id, 'River', 'Demo', 'guest30@example.com', '+12025550130', ((extract(month from now())::int + 8 - 1) % 12) + 1,  true,  true,  now() - interval '17 months', now() - interval '7 days',  14);

  -- ─── VISITS ──────────────────────────────────────────────────
  -- Deterministic synthetic history: each guest has exactly visit_count rows.
  -- The newest visit agrees with last_visit_at; the first agrees with first_visit_at.
  insert into visits (restaurant_id, guest_id, visited_at, subtotal_cents, party_size, source)
  select
    r_id, g.id,
    case when g.visit_count = 1 then g.last_visit_at
         else g.first_visit_at + (g.last_visit_at - g.first_visit_at) * (v.n::double precision / (g.visit_count - 1)) end,
    4200 + (v.n % 5) * 700,
    case when v.n % 3 = 0 then 4 else 2 end,
    'synthetic_demo'
  from guests g
  cross join lateral generate_series(0, g.visit_count - 1) as v(n)
  where g.restaurant_id = r_id;

  -- Entirely invented review text, authors and platform IDs; never scraped.
  insert into reviews
    (restaurant_id, source, source_review_id, author, rating, body, posted_at, replied_at, reply_body)
  values
    (r_id, 'google', 'demo-g-001', 'Avery Demo', 5, 'The garden roll and citrus spritz made a lovely fictional anniversary dinner.', now() - interval '6 days', now() - interval '5 days', 'Thank you, Avery. We are glad the garden roll made your evening special. - Paper Lantern Demo Izakaya'),
    (r_id, 'google', 'demo-g-002', 'Blair Demo', 5, 'The little sushi counter is comfortable and the team explained each seasonal plate.', now() - interval '12 days', now() - interval '11 days', 'Thank you, Blair. We love sharing the seasonal menu with curious guests. - Paper Lantern Demo Izakaya'),
    (r_id, 'yelp', 'demo-y-001', 'Casey Demo', 2, 'Our demo reservation started late, and nobody explained the delay. The dumplings were good.', now() - interval '2 days', null, null),
    (r_id, 'google', 'demo-g-003', 'Harper Demo', 4, 'Great tofu bowls and warm service. I would prefer a little less chili on the beans.', now() - interval '20 days', now() - interval '19 days', 'Thank you, Harper. We appreciate the note about the chili and will share it with the kitchen. - Paper Lantern Demo Izakaya'),
    (r_id, 'google', 'demo-g-004', 'Drew Demo', 5, 'My favorite fictional tasting menu. The chef remembered that I enjoy sesame chicken skewers.', now() - interval '2 days', null, null),
    (r_id, 'yelp', 'demo-y-002', 'Finley Demo', 3, 'The tofu and skewers were excellent, but some sushi was too cold. I would try the cooked menu again.', now() - interval '9 days', null, null),
    (r_id, 'google', 'demo-g-005', 'Emery Demo', 5, 'A relaxed dinner with thoughtful explanations of the alcohol-free drinks.', now() - interval '17 days', now() - interval '16 days', 'Thank you, Emery. We are glad the alcohol-free menu helped make your evening relaxed. - Paper Lantern Demo Izakaya'),
    (r_id, 'opentable', 'demo-o-001', 'Morgan Demo', 2, 'My fictional return visit felt rushed. I hoped for more time between courses.', now() - interval '65 days', null, null),
    (r_id, 'google', 'demo-g-006', 'Indigo Demo', 5, 'The staff made our group comfortable and the seasonal sashimi was beautifully presented.', now() - interval '14 days', now() - interval '13 days', 'Thank you, Indigo. We appreciate the kind words about the team and the seasonal sashimi. - Paper Lantern Demo Izakaya'),
    (r_id, 'yelp', 'demo-y-003', 'Parker Demo', 1, 'The fictional dining room was too noisy for conversation, and our drink order arrived late.', now() - interval '88 days', null, null),
    (r_id, 'google', 'demo-g-007', 'River Demo', 5, 'Roasted tea pudding was a lovely finish to our made-up Friday dinner.', now() - interval '7 days', null, null),
    (r_id, 'google', 'demo-g-008', 'Wren Demo', 4, 'First demo visit: good vegetable dumplings and a welcoming team. I will try the rice bowls next.', now() - interval '3 days', null, null);

  -- ─── A FEW AGENT ACTIONS FOR THE AUDIT LOG ───────────────────
  -- Pretend the agent has been at work the past few days. These show up in
  -- the right-side audit panel and prove the system is "always on".
  insert into agent_actions (restaurant_id, kind, payload)
  values
    (r_id, 'tool_call:draft_review_reply',
      jsonb_build_object(
        'demo', 'true',
        'source', 'google',
        'rating', 5,
        'review_text', 'The staff made our fictional group comfortable.',
        'draft', 'Thank you, Indigo. We appreciate your kind words about the team. - Paper Lantern Demo Izakaya'
      )),
    (r_id, 'tool_call:draft_instagram_post',
      jsonb_build_object(
        'demo', 'true',
        'topic', 'Friday omakase night',
        'draft', E'CAPTION:\nSeven seats. Two hours. The chef''s hands tell the story.\n\nHASHTAGS:\nomakase demoharbor izakaya sushi demofood tastingmenu\n\nPHOTO BRIEF:\nClose-on-hands shot at the sushi bar, side lit, sliver of guest reaction in frame.'
      )),
    (r_id, 'tool_call:draft_review_reply',
      jsonb_build_object(
        'demo', 'true',
        'source', 'google',
        'rating', 4,
        'review_text', 'I would prefer less chili on the beans.',
        'draft', 'Thank you, Harper. We will share your note about the chili with the kitchen. - Paper Lantern Demo Izakaya'
      ));

  -- All done. Print a quick summary so the SQL editor shows confirmation.
  raise notice 'Seeded % guests, % visits, % reviews, % agent actions for Paper Lantern Demo.',
    (select count(*) from guests where restaurant_id = r_id),
    (select count(*) from visits where restaurant_id = r_id),
    (select count(*) from reviews where restaurant_id = r_id),
    (select count(*) from agent_actions where restaurant_id = r_id);
end $$;
