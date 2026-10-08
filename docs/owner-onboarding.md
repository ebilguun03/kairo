# Linking a Slack user to a Kairo restaurant

The Owner Agent resolves every Slack message to a restaurant via the `owners`
table (`owners.slack_user_id`). Until that row exists for a given Slack user,
the agent will politely refuse to do anything beyond a friendly "ask the Kairo
team to link your account" reply.

## One-time setup (per owner)

1. **Find the Slack user ID** for the owner.
   - In Slack: open the owner's DM → click their name → "Copy member ID". It looks like `U07ABC123`.
   - Or: from the Slack admin → People → click the user → URL contains `/team/U07ABC123`.

2. **Insert an owners row.** Open the Supabase SQL editor in your project and run:

   ```sql
   insert into owners (restaurant_id, email, name, slack_user_id, phone)
   select
     r.id,
     'owner@example.com',         -- the owner's email
     'Paper Lantern Demo Owner',                    -- display name
     'U07ABC123',                      -- the Slack user ID from step 1
     null                              -- optional phone
   from restaurants r
   where r.slug = 'paper-lantern-demo'
   on conflict (email) do update set
     slack_user_id = excluded.slack_user_id,
     name = excluded.name,
     phone = excluded.phone;
   ```

   The `on conflict` clause means it's safe to re-run — it'll update the existing
   row instead of erroring.

3. **Test it.** Have the owner DM the Kairo Slack bot (or @-mention it in a
   channel where it's a member). They should get a reply that addresses them by
   name and references their restaurant. If they get the "you're not linked yet"
   message, double-check the Slack user ID matches the row.

## During development

For your own Slack ID (so you can dogfood the agent yourself):

```sql
-- Replace U07YOURID with your own Slack user ID
insert into owners (restaurant_id, email, name, slack_user_id)
select r.id, 'you@example.com', 'Your Name', 'U07YOURID'
from restaurants r
where r.slug = 'paper-lantern-demo'
on conflict (email) do update set slack_user_id = excluded.slack_user_id;
```

You and the owner can both be linked to the same restaurant — useful for pairing
during early demos.

## What the agent does with the context

Once linked, every tool call has access to:

- `restaurant.id` — for any Supabase write (campaigns, messages, agent_actions)
- `restaurant.name` — used in IG captions, review replies
- `restaurant.concept` — sets the menu/cuisine context for drafts
- `restaurant.brand_voice` — the style guide Claude uses when drafting

The Paper Lantern Demo row is seeded by `supabase/migrations/0001_initial_schema.sql` with a
brand_voice tuned for an izakaya. You can edit it directly in Supabase:

```sql
update restaurants
set brand_voice = 'Warm and intentional. Knowledgeable without being precious. Short sentences. No emojis. Lean on sensory detail.'
where slug = 'paper-lantern-demo';
```
