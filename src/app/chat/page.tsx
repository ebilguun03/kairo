// Kairo — owner-facing chat interface.
//
// The whole page is a client component because the chat experience is
// inherently interactive (input field, optimistic rendering, scroll-to-bottom).
// Server-side rendering wouldn't add much; we'd just be rendering an empty
// shell either way.

"use client";

import { useEffect, useRef, useState } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

const SUGGESTIONS = [
  "Draft a review reply: 5 stars, \"The omakase was unreal — chef walked us through every piece.\"",
  "Draft an Instagram post about Friday omakase night.",
  "Draft a friendly reply to a 2-star review that complains the wait was long.",
  "Write an IG caption announcing a new seasonal cocktail menu.",
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  // Restore the shared password from localStorage so demo viewers only enter
  // it once per device. NOT a real auth system — just gates the API key.
  useEffect(() => {
    const saved = window.localStorage.getItem("kairo-chat-pw");
    if (saved) setPassword(saved);
  }, []);

  // Auto-scroll on new message.
  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;

    const next: Message[] = [...messages, { role: "user", content: trimmed }];
    setMessages(next);
    setInput("");
    setBusy(true);
    setError(null);

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (password) {
        headers["Authorization"] = `Bearer ${password}`;
        window.localStorage.setItem("kairo-chat-pw", password);
      }
      const resp = await fetch("/api/agent/chat", {
        method: "POST",
        headers,
        body: JSON.stringify({ messages: next }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data?.error ?? `HTTP ${resp.status}`);
      }
      setMessages([...next, { role: "assistant", content: data.reply ?? "(no reply)" }]);
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col bg-kairo-paper text-kairo-ink">
      <header className="border-b border-kairo-line">
        <div className="mx-auto max-w-3xl px-4 py-4 flex items-center justify-between">
          <a href="/" className="font-semibold tracking-tight">Kairo</a>
          <span className="text-xs text-kairo-ink/60">synthetic demo · Paper Lantern Demo Izakaya</span>
        </div>
      </header>

      <div ref={scrollerRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
          {messages.length === 0 ? (
            <Empty onPick={send} />
          ) : (
            messages.map((m, i) => <Bubble key={i} role={m.role} content={m.content} />)
          )}
          {busy ? <Thinking /> : null}
          {error ? (
            <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">
              {error}
            </div>
          ) : null}
        </div>
      </div>

      <footer className="border-t border-kairo-line bg-white">
        <div className="mx-auto max-w-3xl px-4 py-4 space-y-3">
          <PasswordField password={password} setPassword={setPassword} />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex gap-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Kairo to draft a reply, post, or campaign…"
              className="flex-1 rounded-md border border-kairo-line bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-kairo/40"
              disabled={busy}
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="rounded-md bg-kairo px-5 py-3 text-sm font-medium text-white hover:bg-kairo/90 disabled:opacity-40"
            >
              Send
            </button>
          </form>
          <p className="text-xs text-kairo-ink/50">
            Kairo only drafts. Nothing is published until you say so.
          </p>
        </div>
      </footer>
    </main>
  );
}

function Empty({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="space-y-6 py-8">
      <div>
        <h1 className="text-2xl font-serif font-semibold">
          Hi — I&rsquo;m Kairo.
        </h1>
        <p className="mt-2 text-kairo-ink/75">
          I help independent restaurants draft replies, posts, and campaigns in
          your house voice. I never publish without your approval. Try one of
          these to start:
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onPick(s)}
            className="text-left rounded-md border border-kairo-line bg-white p-3 text-sm text-kairo-ink/80 hover:border-kairo/60 hover:text-kairo-ink"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function Bubble({ role, content }: Message) {
  const isUser = role === "user";
  return (
    <div className={isUser ? "flex justify-end" : "flex justify-start"}>
      <div
        className={
          isUser
            ? "max-w-[80%] rounded-2xl rounded-br-sm bg-kairo px-4 py-3 text-sm text-white whitespace-pre-wrap"
            : "max-w-[80%] rounded-2xl rounded-bl-sm border border-kairo-line bg-white px-4 py-3 text-sm text-kairo-ink whitespace-pre-wrap"
        }
      >
        {content}
      </div>
    </div>
  );
}

function Thinking() {
  return (
    <div className="flex justify-start">
      <div className="rounded-2xl rounded-bl-sm border border-kairo-line bg-white px-4 py-3 text-sm text-kairo-ink/60">
        <span className="inline-block animate-pulse">Drafting…</span>
      </div>
    </div>
  );
}

function PasswordField({
  password,
  setPassword,
}: {
  password: string;
  setPassword: (s: string) => void;
}) {
  const [show, setShow] = useState(false);
  if (!show && password) return null;
  if (!show) {
    return (
      <button
        type="button"
        onClick={() => setShow(true)}
        className="text-xs text-kairo-ink/50 hover:text-kairo-ink/80"
      >
        Have a demo password? Click to enter.
      </button>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Demo password"
        className="rounded-md border border-kairo-line bg-white px-3 py-2 text-xs"
      />
      <button
        type="button"
        onClick={() => setShow(false)}
        className="text-xs text-kairo-ink/60 hover:text-kairo-ink"
      >
        Done
      </button>
    </div>
  );
}
