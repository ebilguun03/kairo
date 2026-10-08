// Marketing landing page for Kairo.
// This is a temporary scaffold — replace copy and design once the brand is locked.
//
// Architecture note: this page describes the capstone platform and pilot relationship.
// Per-restaurant tenant sites (e.g., the public Ozora site) will live under
// /sites/[slug] and pull content from the Supabase `restaurants` table.

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col">
      <header className="border-b border-kairo-line">
        <div className="mx-auto max-w-5xl px-6 py-5 flex items-center justify-between">
          <span className="font-semibold tracking-tight text-lg">Kairo</span>
          <nav className="text-sm text-kairo-ink/70 flex gap-6">
            <a href="#how">How it works</a>
            <a href="#pilot">Pilot</a>
            <a href="mailto:hello@example.com">Contact</a>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-6 py-24">
        <p className="uppercase text-xs tracking-widest text-kairo font-medium">
          Customer growth · for independent restaurants
        </p>
        <h1 className="mt-4 text-5xl md:text-6xl font-serif font-semibold leading-tight">
          Your restaurant&rsquo;s growth, in one conversation.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-kairo-ink/75">
          Kairo runs your customer database, marketing, social, reviews, and website
          from one chat interface. Currently piloting with Ozora Izakaya at Soma
          Towers, Bellevue.
        </p>
        <div className="mt-10 flex flex-wrap gap-4">
          <a
            href="/demo"
            className="rounded-md bg-kairo px-5 py-3 text-white font-medium hover:bg-kairo/90"
          >
            See the demo →
          </a>
          <a
            href="/chat"
            className="rounded-md border border-kairo-line px-5 py-3 font-medium hover:bg-white"
          >
            Just chat with Kairo
          </a>
          <a
            href="mailto:hello@example.com?subject=Kairo pilot"
            className="rounded-md border border-kairo-line px-5 py-3 font-medium hover:bg-white"
          >
            Become a design partner
          </a>
          <a
            href="#how"
            className="rounded-md border border-kairo-line px-5 py-3 font-medium hover:bg-white"
          >
            How it works
          </a>
        </div>
      </section>

      <section id="how" className="border-t border-kairo-line bg-white">
        <div className="mx-auto max-w-5xl px-6 py-20 grid md:grid-cols-3 gap-10">
          <Feature
            title="One conversational interface"
            body="The owner talks to Kairo in Slack or SMS. 'Drum up traffic for Friday' — Kairo posts on Instagram, sends an SMS to lapsed guests, and updates the website specials. One tap to approve."
          />
          <Feature
            title="Closed-loop guest data"
            body="Toast orders flow into Kairo. Kairo follows up the next day, asks for a review, and triggers birthday and lapsed-guest campaigns automatically."
          />
          <Feature
            title="Restaurant-native, not horizontal"
            body="Built specifically for independent restaurants — menus, hours, photos, reviews, reservations all live in one place and stay synchronized across Google, Yelp, Toast, and your site."
          />
        </div>
      </section>

      <section id="pilot" className="border-t border-kairo-line">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <h2 className="text-3xl font-serif font-semibold">Currently piloting at</h2>
          <div className="mt-6 rounded-lg border border-kairo-line bg-white p-8">
            <p className="font-medium text-xl">Ozora Izakaya</p>
            <p className="text-kairo-ink/70 mt-1">
              Japanese izakaya & sushi bar — Soma Towers, Bellevue WA — opening 2026
            </p>
            <a
              href="https://ozoraizakaya.com/menu"
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-block text-kairo underline-offset-4 hover:underline"
            >
              View Ozora&rsquo;s menu →
            </a>
          </div>
        </div>
      </section>

      <footer className="mt-auto border-t border-kairo-line">
        <div className="mx-auto max-w-5xl px-6 py-10 flex justify-between text-sm text-kairo-ink/60">
          <span>© 2026 Kairo</span>
          <a href="/privacy">Privacy</a>
        </div>
      </footer>
    </main>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-2 text-kairo-ink/75">{body}</p>
    </div>
  );
}
