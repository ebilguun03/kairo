"use client";

// Kairo — visual-first dashboard.
// Manager-first UX: proactive action cards, visual content previews (IG post,
// SMS phone mock, review reply), sentiment-coded review cards. Chat is secondary.

import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { DEMO_SUMMARIES, DEMO_LATEST, DEMO_PREVIOUS, growth, money } from "@/lib/demo/sales";
import {
  ArrowUpRight, BarChart2, Bell, BookOpen, Brain, Cake,
  Calendar, Check, ChevronDown, ChevronRight, Clock, Command,
  Copy, FileText, Home, Instagram, Lock,
  Maximize2, MessageCircle, MessageSquare, Minimize2, Plug, Plus, Search, Send,
  Settings, Sparkles, Star, TrendingDown, TrendingUp,
  UserMinus, Users, X, Zap,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

type Step    = { tool: string; summary: string };
type Message = { role: "user" | "assistant"; content: string; steps?: Step[] };
type Month   = "2026-01" | "2026-02" | "2026-03";

type KPI = { icon: any; label: string; value: string; delta: string; up: boolean; compare: string };

type Snapshot = {
  restaurant: { id: string; name: string; concept: string | null; brand_voice: string | null };
  guests: {
    total: number; sms_opt_in: number; visited_last_30d: number;
    lapsed_60_180d: number; new_last_14d: number; birthdays_this_month: number;
    sample_lapsed: Array<{ first_name: string | null; last_name: string | null; last_visit_at: string | null; visit_count: number }>;
    sample_birthdays: Array<{ first_name: string | null; last_name: string | null; birth_month: number | null }>;
  };
  reviews: {
    total: number; pending_reply: number;
    sample_pending: Array<{ source: string; rating: number | null; author: string | null; body: string | null; posted_at: string | null }>;
  };
  recent_actions: Array<{ id: string; kind: string; payload: Record<string, unknown>; created_at: string }>;
};

// Synthetic monthly metrics derived from the same fixtures as the SQL and Claude.
const MONTH_DATA = Object.fromEntries(DEMO_SUMMARIES.map((s, i) => {
  const previous = DEMO_SUMMARIES[i - 1];
  const compare = previous ? "vs " + previous.label + " (synthetic)" : s.label + " (synthetic)";
  return [s.month, {
    label: s.label + " - synthetic demo",
    stats: [
      { label: "Gross Sales", value: money(s.gross), delta: growth(s.gross, previous?.gross), up: !previous || s.gross >= previous.gross },
      { label: "Items Sold", value: s.quantity.toLocaleString("en-US"), delta: growth(s.quantity, previous?.quantity), up: !previous || s.quantity >= previous.quantity },
      { label: "Avg. Check", value: money(Number(s.avgCheck.toFixed(2))), delta: growth(s.avgCheck, previous?.avgCheck), up: !previous || s.avgCheck >= previous.avgCheck },
      { label: "Top Category", value: s.topCategory.name, delta: money(s.topCategory.gross), up: true },
    ],
    kpis: [
      { icon: Users, label: "Returning visits", value: String(s.returningVisits), delta: growth(s.returningVisits, previous?.returningVisits), up: true, compare },
      { icon: Star, label: "Average rating", value: s.averageRating.toFixed(1), delta: previous ? (s.averageRating - previous.averageRating).toFixed(1) : "baseline", up: true, compare },
      { icon: BarChart2, label: "Total revenue", value: money(s.gross), delta: growth(s.gross, previous?.gross), up: true, compare },
    ],
  }];
})) as Record<Month, { label: string; stats: Array<{ label: string; value: string; delta: string; up: boolean }>; kpis: KPI[] }>;

// ─── Scenario cards (always visible, no password needed) ─────────────────────

const ACTION_CARDS = [
  {
    icon: MessageSquare,
    iconBg: "bg-blue-50",
    iconColor: "text-blue-600",
    badge: "Critical",
    badgeColor: "bg-red-50 text-red-600",
    title: "Reply to review",
    desc: "A 2-star Yelp review needs a response",
    action: "Draft reply",
    actionColor: "text-blue-600",
    prompt: 'Draft a public reply to this 2-star Yelp review from Casey Demo: "Our demo reservation started late, and nobody explained the delay. The dumplings were good." Rating: 2 stars, source: yelp.',
  },
  {
    icon: UserMinus,
    iconBg: "bg-orange-50",
    iconColor: "text-orange-600",
    badge: "10 demo guests",
    badgeColor: "bg-orange-50 text-orange-600",
    title: "Win back guests",
    desc: "10 demo guests have not visited in 60+ days",
    action: "Create campaign",
    actionColor: "text-orange-600",
    prompt: "Draft a short, warm win-back SMS for guests who haven't visited Paper Lantern Demo Izakaya in 60+ days. Use the restaurant's brand voice — warm, no emojis, no clichés. Format the message clearly.",
  },
  {
    icon: TrendingDown,
    iconBg: "bg-amber-50",
    iconColor: "text-amber-600",
    badge: "Tonight",
    badgeColor: "bg-amber-50 text-amber-600",
    title: "Fill a slow night",
    desc: "Tonight is below usual reservation volume",
    action: "Plan offer",
    actionColor: "text-amber-600",
    prompt: "Tonight we're running below our usual reservation volume. Propose two concrete things I could do in the next two hours to fill seats — with specific messaging drafts and any numbers that would help.",
  },
  {
    icon: Cake,
    iconBg: "bg-violet-100",
    iconColor: "text-violet-600",
    badge: "6 demo birthdays",
    badgeColor: "bg-violet-50 text-violet-600",
    title: "Birthday outreach",
    desc: "6 demo guests have birthdays this month",
    action: "Draft SMS",
    actionColor: "text-violet-600",
    prompt: "Draft a birthday SMS for guests who have birthdays this month at Paper Lantern Demo Izakaya. Keep it warm, short, and on-brand — no emojis, no clichés.",
  },
];

// ─── Nav ─────────────────────────────────────────────────────────────────────

type NavSection = "home"|"conversations"|"customers"|"marketing"|"content"|"reviews"|"reports"|"integrations"|"settings";

const NAV_ITEMS: Array<{ icon: any; label: string; id: NavSection; sub?: boolean }> = [
  { icon: Home,          label: "Home",          id: "home"          },
  { icon: MessageCircle, label: "Conversations", id: "conversations" },
  { icon: Users,         label: "Customers",     id: "customers"     },
  { icon: BarChart2,     label: "Marketing",     id: "marketing",    sub: true },
  { icon: BookOpen,      label: "Content Studio",id: "content"       },
  { icon: Star,          label: "Reviews",       id: "reviews"       },
  { icon: FileText,      label: "Reports",       id: "reports"       },
  { icon: Plug,          label: "Integrations",  id: "integrations"  },
  { icon: Settings,      label: "Settings",      id: "settings"      },
];

const SEARCH_SUGGESTIONS = [
  { label: "Who should I reach out to this week?",       icon: Users         },
  { label: "What are my top selling items this month?",  icon: TrendingUp    },
  { label: "Draft a win-back SMS for lapsed guests",     icon: MessageCircle },
  { label: "Write an Instagram post about yakitori",     icon: Instagram     },
  { label: "How did February compare to January?",       icon: BarChart2     },
  { label: "Draft a reply to a negative review",         icon: MessageSquare },
  { label: "What should I promote this weekend?",        icon: Sparkles      },
];

const NOTIFICATIONS = [
  { icon: UserMinus,  color: "text-orange-500", bg: "bg-orange-50", title: "10 demo lapsed guests",  desc: "Haven't visited in 60–180 days",  time: "now"    },
  { icon: Star,       color: "text-yellow-500", bg: "bg-yellow-50", title: "New 2-star review", desc: "Casey Demo left a review on Yelp",  time: "2h ago" },
  { icon: Cake,       color: "text-violet-500", bg: "bg-violet-50", title: "6 demo birthdays",       desc: "Guests with birthdays this month", time: "1d ago" },
  { icon: TrendingUp, color: "text-emerald-500",bg: "bg-emerald-50",title: "Synthetic March growth",    desc: money(DEMO_LATEST.gross) + " gross (" + growth(DEMO_LATEST.gross, DEMO_PREVIOUS.gross) + ")",         time: "2d ago" },
];

function KairoSidebarMark() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 via-orange-600 to-orange-700 shadow-[0_10px_24px_rgba(194,65,12,0.38)] ring-1 ring-orange-300/20 flex-shrink-0">
        <span className="font-serif text-[2rem] italic font-semibold leading-none text-white select-none translate-y-[-1px]">
          K
        </span>
      </div>
      <div className="min-w-0">
        <div className="text-[1.05rem] font-semibold tracking-[0.34em] text-orange-300/95">
          KAIRO
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function lastTool(msg: Message): string | null {
  return msg.steps?.length ? msg.steps[msg.steps.length - 1].tool : null;
}

function parseIGPost(text: string) {
  const caption    = text.match(/CAPTION:\s*\n([\s\S]*?)(?=\n\s*\nHASHTAGS:|$)/i)?.[1]?.trim() ?? null;
  const hashStr    = text.match(/HASHTAGS:\s*\n([\s\S]*?)(?=\n\s*\nPHOTO BRIEF:|$)/i)?.[1]?.trim() ?? "";
  const photoBrief = text.match(/PHOTO BRIEF:\s*\n([\s\S]*?)$/i)?.[1]?.trim() ?? "";
  if (!caption) return null;
  return { caption, hashtags: hashStr.split(/\s+/).filter((t) => t.startsWith("#")), photoBrief };
}

function sentimentLabel(rating: number | null): { label: string; color: string; bg: string; dot: string } {
  if (!rating || rating <= 2) return { label: "Critical",  color: "text-red-600",    bg: "bg-red-50",     dot: "bg-red-500"     };
  if (rating === 3)            return { label: "Mixed",     color: "text-amber-600",  bg: "bg-amber-50",   dot: "bg-amber-500"   };
  return                              { label: "Positive",  color: "text-emerald-600",bg: "bg-emerald-50", dot: "bg-emerald-500" };
}

function timeAgo(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "now"; if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function activityMeta(kind: string) {
  if (kind.includes("instagram")||kind.includes("post"))     return { icon: BookOpen,      bg:"bg-pink-50",    color:"text-pink-600",    name:"Instagram post"    };
  if (kind.includes("review_reply")||kind.includes("review"))return { icon: MessageSquare, bg:"bg-blue-50",    color:"text-blue-600",    name:"Review reply"      };
  if (kind.includes("sms")||kind.includes("winback"))        return { icon: UserMinus,     bg:"bg-orange-50",  color:"text-orange-600",  name:"Win-back campaign" };
  if (kind.includes("birthday"))                             return { icon: Cake,          bg:"bg-violet-100", color:"text-violet-600",  name:"Birthday outreach" };
  if (kind.includes("slow")||kind.includes("offer"))         return { icon: TrendingDown,  bg:"bg-amber-50",   color:"text-amber-600",   name:"Slow night offer"  };
  if (kind.includes("menu")||kind.includes("query"))         return { icon: BarChart2,     bg:"bg-emerald-50", color:"text-emerald-600", name:"Sales insights"    };
  return                                                            { icon: Sparkles,       bg:"bg-neutral-100",color:"text-neutral-500", name:kind               };
}

// ─── Copy-to-clipboard hook ───────────────────────────────────────────────────

function useCopy() {
  const [copied, setCopied] = useState(false);
  function copy(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return { copied, copy };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export default function DemoPage() {
  const [messages, setMessages]           = useState<Message[]>([]);
  const [input, setInput]                 = useState("");
  const [password, setPassword]           = useState("");
  const [serviceStatus, setServiceStatus] = useState({ servicesConfigured: false, passwordRequired: true });
  const canUseServices = serviceStatus.servicesConfigured && (!serviceStatus.passwordRequired || !!password);
  const [busy, setBusy]                   = useState(false);
  const [error, setError]                 = useState<string | null>(null);
  const [snapshot, setSnapshot]           = useState<Snapshot | null>(null);
  const [newAuditIds, setNewAuditIds]     = useState<Set<string>>(new Set());
  const [activeNav, setActiveNav]         = useState<NavSection>("home");
  const [mobileTab, setMobileTab]         = useState<NavSection>("home");
  const [selectedMonth, setMonth]         = useState<Month>("2026-03");
  const [showDatePicker, setDatePicker]   = useState(false);
  const [showSearch, setSearch]           = useState(false);
  const [searchQuery, setSearchQuery]     = useState("");
  const [showNotifs, setNotifs]           = useState(false);
  const [expandActivity, setExpandActivity] = useState(false);
  const [chatExpanded, setChatExpanded]   = useState(false);
  const prevSnapshotRef                   = useRef<Snapshot | null>(null);
  const scrollerRef                       = useRef<HTMLDivElement>(null);
  const expandedScrollerRef               = useRef<HTMLDivElement>(null);
  const searchInputRef                    = useRef<HTMLInputElement>(null);
  const expandedInputRef                  = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/demo/status")
      .then((r) => r.ok ? r.json() : null)
      .then((status) => { if (active && status) setServiceStatus(status); })
      .catch(() => { /* Keep service actions unavailable if configuration cannot be checked. */ });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const saved = window.localStorage.getItem("kairo-chat-pw");
    if (saved) setPassword(saved);
  }, []);

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" });
    expandedScrollerRef.current?.scrollTo({ top: expandedScrollerRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setSearch(true); }
      if (e.key === "Escape") { setSearch(false); setDatePicker(false); setNotifs(false); setChatExpanded(false); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Focus the expanded chat input when the overlay opens
  useEffect(() => { if (chatExpanded) setTimeout(() => expandedInputRef.current?.focus(), 80); }, [chatExpanded]);

  useEffect(() => { if (showSearch) setTimeout(() => searchInputRef.current?.focus(), 50); }, [showSearch]);

  const loadSnapshot = useCallback(async () => {
    if (!canUseServices) return;
    try {
      const r = await fetch("/api/demo/context", { headers: { Authorization: `Bearer ${password}` } });
      if (r.ok) setSnapshot(await r.json());
    } catch { /* silent */ }
  }, [password, canUseServices]);

  useEffect(() => {
    if (canUseServices) loadSnapshot();
    else setSnapshot(null);
  }, [canUseServices, loadSnapshot]);

  useEffect(() => {
    if (!snapshot) return;
    const prev = prevSnapshotRef.current;
    prevSnapshotRef.current = snapshot;
    if (!prev) return;
    const prevIds = new Set(prev.recent_actions.map((a) => a.id));
    const newOnes = snapshot.recent_actions.filter((a) => !prevIds.has(a.id));
    if (!newOnes.length) return;
    setNewAuditIds(new Set(newOnes.map((a) => a.id)));
    setTimeout(() => setNewAuditIds(new Set()), 2500);
  }, [snapshot]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy || !canUseServices) return;
    setSearch(false); setSearchQuery("");
    setActiveNav("home"); setMobileTab("home");
    setChatExpanded(true); // open the big chat so responses are fully visible
    const next: Message[] = [...messages, { role: "user", content: trimmed }];
    setMessages(next); setInput(""); setBusy(true); setError(null);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (password) { headers["Authorization"] = `Bearer ${password}`; window.localStorage.setItem("kairo-chat-pw", password); }
      const resp = await fetch("/api/agent/chat", {
        method: "POST", headers,
        body: JSON.stringify({ messages: next.map((m) => ({ role: m.role, content: m.content })) }),
      });
      let data: Record<string, unknown>;
      try { data = await resp.json(); }
      catch { throw new Error(`Connection error — if this is your first run, restart the dev server from the kairo project directory with: npm run dev`); }
      if (!resp.ok) throw new Error((data?.error as string) ?? `HTTP ${resp.status}`);
      setMessages([...next, { role: "assistant", content: data.reply as string ?? "(no reply)", steps: (data.steps as Step[]) ?? [] }]);
      loadSnapshot();
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally { setBusy(false); }
  }

  const monthData = MONTH_DATA[selectedMonth];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const filtered = SEARCH_SUGGESTIONS.filter((s) => !searchQuery || s.label.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="flex h-screen bg-neutral-50 overflow-hidden font-sans">

      {/* Backdrop */}
      {(showDatePicker || showNotifs) && <div className="fixed inset-0 z-20" onClick={() => { setDatePicker(false); setNotifs(false); }} />}

      {/* ── Expanded chat overlay ───────────────────────────────────── */}
      {chatExpanded && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8">
          <div className="absolute inset-0 bg-neutral-900/40 backdrop-blur-sm" onClick={() => setChatExpanded(false)} />
          <div className="relative flex flex-col w-full max-w-3xl h-full max-h-[88vh] bg-white rounded-2xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-100 flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-orange-400 to-amber-500 text-white text-xs font-bold flex items-center justify-center shadow-sm">K</div>
                <div>
                  <div className="text-sm font-semibold text-neutral-800">Kairo</div>
                  <div className="text-[10px] text-neutral-400">{busy ? "Thinking…" : "Paper Lantern Demo Izakaya"}</div>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {messages.length > 0 && (
                  <button onClick={() => { setMessages([]); setError(null); }}
                    className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-800 bg-neutral-100 hover:bg-neutral-200 rounded-lg px-2.5 py-1.5 transition-colors">
                    <Plus size={12} /> New chat
                  </button>
                )}
                <button onClick={() => setChatExpanded(false)} title="Minimize"
                  className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-800 bg-neutral-100 hover:bg-neutral-200 rounded-lg px-2.5 py-1.5 transition-colors">
                  <Minimize2 size={12} /> Minimize
                </button>
                <button onClick={() => setChatExpanded(false)} title="Close"
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors">
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div ref={expandedScrollerRef} className="flex-1 overflow-y-auto px-5 sm:px-8 py-5 space-y-5">
              {messages.length === 0 ? <EmptyConversation canAsk={canUseServices} /> : messages.map((m, i) => <SmartBubble key={i} message={m} />)}
              {busy && <Thinking />}
              {error && (
                <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 flex items-start gap-3">
                  <span className="text-lg flex-shrink-0">⚠️</span>
                  <div>
                    <div className="text-sm font-semibold text-neutral-800">Something went wrong</div>
                    <div className="text-xs text-neutral-500 mt-0.5">{error}</div>
                  </div>
                </div>
              )}
            </div>

            {/* Quick chips */}
            {messages.length === 0 && (
              <div className="px-5 sm:px-8 pb-3 flex flex-wrap gap-1.5 flex-shrink-0">
                {["Who should I reach out to this week?","Show me top items this month","How did February compare to January?"].map((chip) => (
                  <button key={chip} onClick={() => send(chip)} disabled={busy || !canUseServices}
                    className="text-xs bg-neutral-50 border border-neutral-200 text-neutral-500 rounded-lg px-3 py-1.5 hover:bg-neutral-100 hover:text-neutral-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                    {chip}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            <div className="px-4 sm:px-6 pb-4 pt-1 flex-shrink-0 border-t border-neutral-50">
              <form onSubmit={(e) => { e.preventDefault(); send(input); }}
                className="flex items-center gap-2 bg-neutral-50 border border-neutral-200 rounded-2xl px-4 py-2.5 focus-within:border-orange-300 focus-within:bg-white transition-colors">
                <input ref={expandedInputRef} value={input} onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask Kairo anything about Paper Lantern Demo…"
                  className="flex-1 bg-transparent text-sm text-neutral-800 placeholder:text-neutral-400 focus:outline-none"
                  disabled={busy || !canUseServices} />
                <button type="submit" disabled={busy || !input.trim() || !canUseServices}
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-orange-500 text-white hover:bg-orange-600 disabled:cursor-not-allowed transition-colors shadow-sm shadow-orange-200">
                  <Send size={14} />
                </button>
              </form>
              <p className="text-center text-[10px] text-neutral-400 mt-2">Kairo can make mistakes. Please review before posting.</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Search modal ────────────────────────────────────────────── */}
      {showSearch && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSearch(false)} />
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-neutral-100">
              <Search size={16} className="text-neutral-400 flex-shrink-0" />
              <input ref={searchInputRef} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && searchQuery.trim()) send(searchQuery); }}
                placeholder="Ask Kairo anything…"
                className="flex-1 text-sm text-neutral-800 placeholder:text-neutral-400 focus:outline-none" />
              <button onClick={() => setSearch(false)}><X size={16} className="text-neutral-400 hover:text-neutral-600" /></button>
            </div>
            <div className="py-2 max-h-72 overflow-y-auto">
              {filtered.map((s) => { const Icon = s.icon; return (
                <button key={s.label} onClick={() => send(s.label)} disabled={busy || !canUseServices}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-neutral-700 hover:bg-orange-50 hover:text-orange-700 transition-colors text-left">
                  <Icon size={15} className="text-neutral-400 flex-shrink-0" />{s.label}
                </button>
              ); })}
            </div>
            <div className="px-4 py-2 border-t border-neutral-100 text-[11px] text-neutral-400 flex gap-4">
              <span><kbd className="font-mono">↵</kbd> to send</span>
              <span><kbd className="font-mono">Esc</kbd> to close</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Sidebar ─────────────────────────────────────────────────── */}
      <aside className="hidden lg:flex flex-col w-56 flex-shrink-0 bg-[#0f0f0f] text-white overflow-y-auto">
        <div className="px-5 py-4 border-b border-white/5">
          <KairoSidebarMark />
        </div>
        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon; const active = activeNav === item.id;
            return (
              <button key={item.id} onClick={() => setActiveNav(item.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-colors text-left ${active ? "bg-white/10 text-white font-medium" : "text-neutral-500 hover:text-neutral-200 hover:bg-white/5"}`}>
                <Icon size={15} className={active ? "text-white" : "text-neutral-500"} />
                <span className="flex-1">{item.label}</span>
                {item.sub && <ChevronDown size={12} className="text-neutral-600" />}
              </button>
            );
          })}
        </nav>
        <div className="mx-3 mb-3 rounded-lg border border-white/8 bg-white/4 p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-medium text-neutral-300">Pro Plan</span>
            <span className="text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 px-1.5 py-0.5 rounded-full">Active</span>
          </div>
          <p className="text-[10px] text-neutral-600 mb-2">Renews Apr 20, 2026</p>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-neutral-600">Usage this month</span>
            <span className="text-[10px] text-neutral-400 font-medium">60%</span>
          </div>
          <div className="h-1 rounded-full bg-white/8 overflow-hidden">
            <div className="h-full w-[60%] rounded-full bg-white/30" />
          </div>
        </div>
        <div className="mx-3 mb-4 rounded-lg border border-white/8 bg-white/4 overflow-hidden">
          <div className="h-14 bg-neutral-800 relative">
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400&q=60')] bg-cover bg-center opacity-30" />
          </div>
          <div className="px-3 py-2">
            <div className="text-[12px] font-medium text-neutral-200">Paper Lantern Demo Izakaya</div>
            <div className="text-[10px] text-neutral-600 mt-0.5">Demo Harbor</div>
          </div>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Top bar */}
        <header className="flex-shrink-0 bg-white border-b border-neutral-100 px-4 sm:px-6 py-3 flex items-center gap-3">
          <button className="flex items-center gap-2 min-w-0">
            <div>
              <div className="text-sm font-semibold text-neutral-900 leading-tight">Paper Lantern Demo Izakaya</div>
              <div className="text-[11px] text-neutral-400 leading-tight">Demo Harbor</div>
            </div>
            <ChevronDown size={15} className="text-neutral-400 flex-shrink-0" />
          </button>
          <button onClick={() => setSearch(true)}
            className="flex-1 max-w-sm ml-2 flex items-center gap-2 bg-neutral-100 hover:bg-neutral-200 rounded-xl px-3 py-2 transition-colors">
            <Search size={14} className="text-neutral-400 flex-shrink-0" />
            <span className="text-sm text-neutral-400 flex-1 text-left">Ask anything</span>
            <div className="hidden sm:flex items-center gap-0.5 text-neutral-400">
              <Command size={12} /><span className="text-[11px]">K</span>
            </div>
          </button>
          <div className="flex-1" />
          {/* Password entry is only relevant when services are configured. */}
          {serviceStatus.servicesConfigured && serviceStatus.passwordRequired && <input
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (e.target.value) window.localStorage.setItem("kairo-chat-pw", e.target.value);
              else window.localStorage.removeItem("kairo-chat-pw");
            }}
            placeholder={password ? "••••••••" : "Demo password"}
            className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-orange-400/30 w-32"
          />}
          {/* Notifications */}
          <div className="relative">
            <button onClick={() => { setNotifs(!showNotifs); setDatePicker(false); }}
              className="relative flex h-9 w-9 items-center justify-center rounded-xl hover:bg-neutral-100 transition-colors">
              <Bell size={18} className="text-neutral-500" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-orange-500" />
            </button>
            {showNotifs && (
              <div className="absolute right-0 top-11 w-80 bg-white rounded-2xl shadow-xl border border-neutral-200 z-30 overflow-hidden">
                <div className="px-4 py-3 border-b border-neutral-100 flex items-center justify-between">
                  <span className="text-sm font-semibold text-neutral-800">Notifications</span>
                  <button onClick={() => setNotifs(false)} className="text-xs text-orange-500 hover:text-orange-600">Mark all read</button>
                </div>
                {NOTIFICATIONS.map((n) => { const Icon = n.icon; return (
                  <div key={n.title} className="flex items-start gap-3 px-4 py-3 hover:bg-neutral-50 cursor-pointer border-b border-neutral-50">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${n.bg} flex-shrink-0 mt-0.5`}>
                      <Icon size={14} className={n.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-neutral-800">{n.title}</div>
                      <div className="text-[11px] text-neutral-500 mt-0.5">{n.desc}</div>
                    </div>
                    <span className="text-[10px] text-neutral-400 flex-shrink-0 mt-0.5">{n.time}</span>
                  </div>
                ); })}
                <div className="px-4 py-2.5">
                  <button className="text-xs text-orange-500 font-medium">View all notifications</button>
                </div>
              </div>
            )}
          </div>
          {/* Connection status */}
          <div className="flex items-center gap-1.5 text-xs font-medium">
            {snapshot ? (
              <span className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1.5 rounded-xl">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Database loaded
              </span>
            ) : (
              <span className="flex items-center gap-1.5 bg-neutral-100 text-neutral-500 border border-neutral-200 px-2.5 py-1.5 rounded-xl">
                <span className="h-1.5 w-1.5 rounded-full bg-neutral-400" />
                {serviceStatus.servicesConfigured ? "Services configured" : "Demo mode"}
              </span>
            )}
          </div>
          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-orange-400 to-amber-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">B</div>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-y-auto pb-16 lg:pb-0">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6">
            {activeNav !== "home" && activeNav !== "conversations" ? (
              <SectionPlaceholder canAsk={canUseServices && !busy} section={activeNav} onBack={() => setActiveNav("home")} onAsk={send} />
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-6">

                {/* ── Left column ──────────────────────────────────── */}
                <div className="min-w-0 space-y-4">

                  {/* Greeting + date picker */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <h1 className="text-xl font-semibold text-neutral-900">{greeting}, Kairo 👋</h1>
                      <p className="text-sm text-neutral-400 mt-0.5">How can I help grow Paper Lantern Demo today?</p>
                    </div>
                    <div className="relative self-start">
                      <button onClick={() => { setDatePicker(!showDatePicker); setNotifs(false); }}
                        className="flex items-center gap-2 bg-white border border-neutral-200 rounded-lg px-3 py-1.5 text-sm text-neutral-600 hover:border-neutral-300 transition-colors">
                        <Calendar size={13} className="text-neutral-400" />
                        {monthData.label}
                        <ChevronDown size={13} className="text-neutral-400" />
                      </button>
                      {showDatePicker && (
                        <div className="absolute right-0 top-10 bg-white rounded-xl shadow-xl border border-neutral-200 z-30 py-1.5 w-52">
                          {(Object.entries(MONTH_DATA) as [Month, typeof MONTH_DATA[Month]][]).map(([key, val]) => (
                            <button key={key} onClick={() => { setMonth(key); setDatePicker(false); }}
                              className={`w-full text-left px-4 py-2 text-sm transition-colors ${selectedMonth === key ? "text-orange-600 font-semibold bg-orange-50" : "text-neutral-700 hover:bg-neutral-50"}`}>
                              {val.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ── Password banner ──────────────────────────── */}
                  {serviceStatus.servicesConfigured && serviceStatus.passwordRequired && !password && <PasswordBanner onSet={setPassword} />}
                  <p className="text-xs text-neutral-500">
                    Synthetic demo data - Paper Lantern Demo Izakaya, Demo Harbor.
                    {!serviceStatus.servicesConfigured && " AI drafting and database context require service setup."}
                  </p>

                  {/* ── 4 Action cards ───────────────────────────── */}
                  <div>
                    <p className="text-xs font-medium text-neutral-400 uppercase tracking-wide mb-2.5">Today&rsquo;s priorities</p>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
                      {ACTION_CARDS.map((card) => {
                        const Icon = card.icon;
                        return (
                          <button key={card.title} onClick={() => send(card.prompt)} disabled={busy || !canUseServices}
                            className="group text-left bg-white border border-neutral-200 rounded-xl p-3.5 hover:border-neutral-300 hover:shadow-sm transition-all disabled:cursor-not-allowed">
                            <div className="flex items-start justify-between mb-2.5">
                              <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${card.iconBg}`}>
                                <Icon size={15} className={card.iconColor} />
                              </div>
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${card.badgeColor}`}>{card.badge}</span>
                            </div>
                            <div className="text-sm font-semibold text-neutral-900 leading-tight mb-0.5">{card.title}</div>
                            <div className="text-[11px] text-neutral-400 leading-snug mb-3">{card.desc}</div>
                            <div className={`flex items-center gap-1 text-[11px] font-semibold ${card.actionColor} opacity-80 group-hover:opacity-100 transition-opacity`}>
                              {canUseServices ? card.action : "Requires service setup"} <ChevronRight size={10} />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* ── Conversation with visual responses ───────── */}
                  <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-sm">
                    <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-100">
                      <div className="flex items-center gap-2">
                        <Sparkles size={14} className="text-neutral-400" />
                        <span className="text-sm font-semibold text-neutral-700">Conversation</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {messages.length > 0 && (
                          <button onClick={() => { setMessages([]); setError(null); }}
                            className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-800 bg-neutral-100 hover:bg-neutral-200 rounded-lg px-2.5 py-1.5 transition-colors">
                            <Plus size={12} /> New chat
                          </button>
                        )}
                        <button onClick={() => setChatExpanded(true)} title="Expand chat"
                          className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-800 bg-neutral-100 hover:bg-neutral-200 rounded-lg px-2.5 py-1.5 transition-colors">
                          <Maximize2 size={12} /> Expand
                        </button>
                      </div>
                    </div>

                    <div ref={scrollerRef} className="overflow-y-auto px-5 py-4 space-y-5" style={{ maxHeight: 260, minHeight: 180 }}>
                      {messages.length === 0 ? <EmptyConversation canAsk={canUseServices} /> : messages.map((m, i) => <SmartBubble key={i} message={m} />)}
                      {busy && <Thinking />}
                      {error && (
                        <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 flex items-start gap-3">
                          <span className="text-lg flex-shrink-0">⚠️</span>
                          <div>
                            <div className="text-sm font-semibold text-neutral-800">Something went wrong</div>
                            <div className="text-xs text-neutral-500 mt-0.5">{error}</div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Quick chips */}
                    {messages.length === 0 && (
                      <div className="px-5 pb-3 flex flex-wrap gap-1.5">
                        {["Who should I reach out to this week?","Show me top items this month","How did February compare to January?"].map((chip) => (
                          <button key={chip} onClick={() => send(chip)} disabled={busy || !canUseServices}
                            className="text-xs bg-neutral-50 border border-neutral-200 text-neutral-500 rounded-lg px-3 py-1.5 hover:bg-neutral-100 hover:text-neutral-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                            {chip}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Input */}
                    <div className="px-4 pb-4">
                      <form onSubmit={(e) => { e.preventDefault(); send(input); }}
                        className="flex items-center gap-2 bg-neutral-50 border border-neutral-200 rounded-2xl px-4 py-2.5 focus-within:border-orange-300 focus-within:bg-white transition-colors">
                        <input value={input} onChange={(e) => setInput(e.target.value)}
                          placeholder="Ask Kairo anything about Paper Lantern Demo…"
                          className="flex-1 bg-transparent text-sm text-neutral-800 placeholder:text-neutral-400 focus:outline-none"
                          disabled={busy || !canUseServices} />
                        <button type="submit" disabled={busy || !input.trim() || !canUseServices}
                          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm shadow-orange-200">
                          <Send size={14} />
                        </button>
                      </form>
                      <p className="text-center text-[10px] text-neutral-400 mt-2">Kairo can make mistakes. Please review before posting.</p>
                    </div>
                  </div>

                </div>

                {/* ── Right column ──────────────────────────────────── */}
                <div className="space-y-4">
                  <ReviewSentimentPanel snap={snapshot} onAsk={send} canAsk={canUseServices && !busy} />
                  <TopInsightsPanel kpis={monthData.kpis} onViewReport={() => setActiveNav("reports")} />
                  <RecentActivityPanel snap={snapshot} newIds={newAuditIds} expanded={expandActivity} onToggle={() => setExpandActivity(!expandActivity)} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 bg-white border-t border-neutral-200 flex items-center justify-around px-2 py-2 z-30">
        {[
          { icon: Home, label: "Home", id: "home" },
          { icon: MessageCircle, label: "Chat", id: "conversations" },
          { icon: Users, label: "Guests", id: "customers" },
          { icon: BarChart2, label: "Reports", id: "reports" },
          { icon: Settings, label: "Settings", id: "settings" },
        ].map((tab) => {
          const Icon = tab.icon; const active = mobileTab === tab.id;
          return (
            <button key={tab.id} onClick={() => { setMobileTab(tab.id as NavSection); setActiveNav(tab.id as NavSection); }}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-colors ${active ? "text-orange-500" : "text-neutral-400"}`}>
              <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PASSWORD BANNER
// ═══════════════════════════════════════════════════════════════════════════════

function PasswordBanner({ onSet }: { onSet: (pw: string) => void }) {
  const [val, setVal] = useState("");
  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-100 flex-shrink-0">
        <Lock size={16} className="text-neutral-500" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-neutral-800">Connect to the synthetic demo</div>
        <div className="text-xs text-neutral-400 mt-0.5">Enter the demo password to unlock AI actions and synthetic database fixtures.</div>
      </div>
      <form
        onSubmit={(e) => { e.preventDefault(); if (val.trim()) { onSet(val.trim()); window.localStorage.setItem("kairo-chat-pw", val.trim()); } }}
        className="flex items-center gap-2 w-full sm:w-auto"
      >
        <input
          type="password"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          placeholder="Demo password"
          autoFocus
          className="flex-1 sm:w-40 rounded-xl border border-orange-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400/40"
        />
        <button type="submit" disabled={!val.trim()}
          className="flex-shrink-0 bg-neutral-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-neutral-800 disabled:opacity-40 transition-colors">
          Connect
        </button>
      </form>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROACTIVE ACTION CARDS — data-driven, no chat required
// ═══════════════════════════════════════════════════════════════════════════════

// Fallback cards that work without live snapshot data
const PROACTIVE_FALLBACK = [
  {
    icon: UserMinus, color: "text-orange-500", bg: "bg-orange-50", border: "border-orange-100",
    badge: "High priority", badgeColor: "bg-orange-100 text-orange-600",
    title: "Win back lapsed guests",
    desc: "Guests who haven't visited in 60+ days. Send a personalized message.",
    action: "Draft win-back campaign",
    prompt: "Draft a short, warm win-back SMS for guests who haven't visited Paper Lantern Demo Izakaya in 60+ days. Use the restaurant's brand voice. Format the message clearly.",
  },
  {
    icon: MessageSquare, color: "text-blue-500", bg: "bg-blue-50", border: "border-blue-100",
    badge: "Needs attention", badgeColor: "bg-blue-100 text-blue-600",
    title: "Reply to pending reviews",
    desc: "Unanswered reviews hurt your ranking. Draft a reply in seconds.",
    action: "Draft reply",
    prompt: 'Draft a public reply to this 2-star Yelp review from Casey Demo: "Our demo reservation started late, and nobody explained the delay. The dumplings were good." Rating: 2 stars, source: yelp.',
  },
  {
    icon: Cake, color: "text-violet-500", bg: "bg-violet-50", border: "border-violet-100",
    badge: "This month", badgeColor: "bg-violet-100 text-violet-600",
    title: "Birthday outreach for this month",
    desc: "A personal birthday message drives repeat visits.",
    action: "Draft birthday SMS",
    prompt: "Draft a birthday SMS for a guest named Robin Demo who has a birthday this month. Keep it warm, short, and on-brand for Paper Lantern Demo Izakaya.",
  },
  {
    icon: Instagram, color: "text-pink-500", bg: "bg-pink-50", border: "border-pink-100",
    badge: "Content", badgeColor: "bg-pink-100 text-pink-600",
    title: "Sesame Chicken Skewers — top-volume synthetic item",
    desc: "Feature your best seller in an Instagram post.",
    action: "Draft IG post",
    prompt: "Draft an Instagram post about our Sesame Chicken Skewers — it's our top-volume synthetic item. Include caption, hashtags, and a photo brief.",
  },
];

function ProactiveActions({ snap, onAsk, disabled }: { snap: Snapshot | null; onAsk: (s: string) => void; disabled: boolean }) {
  // Build cards from live data when available, otherwise use fallback
  const cards = snap ? [
    {
      icon: UserMinus, color: "text-orange-500", bg: "bg-orange-50", border: "border-orange-100",
      badge: snap.guests.lapsed_60_180d > 0 ? `${snap.guests.lapsed_60_180d} guests` : "Win back",
      badgeColor: "bg-orange-100 text-orange-600",
      title: snap.guests.lapsed_60_180d > 0 ? `${snap.guests.lapsed_60_180d} guests haven't visited in 60+ days` : "Win back lapsed guests",
      desc: "Send a personalized win-back message to bring them back.",
      action: "Draft win-back campaign",
      prompt: `Draft a short, warm win-back SMS for ${snap.guests.lapsed_60_180d || "our"} guests who haven't visited Paper Lantern Demo Izakaya in 60-180 days. Use the restaurant's brand voice.`,
    },
    {
      icon: MessageSquare, color: "text-blue-500", bg: "bg-blue-50", border: "border-blue-100",
      badge: snap.reviews.pending_reply > 0 ? `${snap.reviews.pending_reply} open` : "Reviews",
      badgeColor: "bg-blue-100 text-blue-600",
      title: snap.reviews.pending_reply > 0 ? `${snap.reviews.pending_reply} reviews waiting for a reply` : "Reply to pending reviews",
      desc: "Unanswered reviews hurt your ranking. Draft a reply in seconds.",
      action: "Draft reply",
      prompt: snap.reviews.sample_pending[0]
        ? `Draft a public reply to this ${snap.reviews.sample_pending[0].rating}★ ${snap.reviews.sample_pending[0].source} review from ${snap.reviews.sample_pending[0].author}: "${snap.reviews.sample_pending[0].body}"`
        : 'Draft a reply to this 2-star Yelp review: "Our demo reservation started late, and nobody explained the delay." Rating: 2 stars.',
    },
    {
      icon: Cake, color: "text-violet-500", bg: "bg-violet-50", border: "border-violet-100",
      badge: snap.guests.birthdays_this_month > 0 ? `${snap.guests.birthdays_this_month} birthdays` : "Birthdays",
      badgeColor: "bg-violet-100 text-violet-600",
      title: snap.guests.birthdays_this_month > 0 ? `${snap.guests.birthdays_this_month} guests have birthdays this month` : "Birthday outreach",
      desc: "A personal birthday message drives repeat visits.",
      action: "Draft birthday SMS",
      prompt: snap.guests.sample_birthdays[0]
        ? `Draft a birthday SMS for ${snap.guests.sample_birthdays[0].first_name ?? "our guest"} who has a birthday this month. Warm, short, on-brand for Paper Lantern Demo Izakaya.`
        : "Draft a birthday outreach SMS for guests with birthdays this month at Paper Lantern Demo Izakaya.",
    },
    {
      icon: Instagram, color: "text-pink-500", bg: "bg-pink-50", border: "border-pink-100",
      badge: "Content", badgeColor: "bg-pink-100 text-pink-600",
      title: "Sesame Chicken Skewers — top-volume synthetic item",
      desc: "Feature your best seller in an Instagram post.",
      action: "Draft IG post",
      prompt: "Draft an Instagram post about our Sesame Chicken Skewers — top-volume synthetic item. Include caption, hashtags, and a photo brief.",
    },
  ] : PROACTIVE_FALLBACK;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Zap size={14} className="text-orange-500" />
        <span className="text-sm font-semibold text-neutral-700">Today&rsquo;s actions</span>
        <span className="text-xs text-neutral-400 ml-auto">Tap any card to generate</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {(cards as any[]).map((card: any, i: number) => {
          const Icon = card.icon;
          return (
            <button key={i} onClick={() => card.prompt && onAsk(card.prompt)}
              disabled={disabled || !card.prompt}
              className={`group text-left bg-white border ${card.border} rounded-2xl p-4 hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed`}>
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${card.bg}`}>
                  <Icon size={18} className={card.color} />
                </div>
                <span className={`text-[10px] font-semibold px-2 py-1 rounded-full ${card.badgeColor}`}>{card.badge}</span>
              </div>
              <div className="text-sm font-semibold text-neutral-900 leading-tight mb-1">{card.title}</div>
              <div className="text-xs text-neutral-500 leading-snug mb-3">{card.desc}</div>
              <div className={`flex items-center gap-1.5 text-xs font-semibold ${card.color} group-hover:gap-2.5 transition-all`}>
                {card.action} <ChevronRight size={13} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SMART BUBBLE — renders visual cards for specific tool outputs
// ═══════════════════════════════════════════════════════════════════════════════

function SmartBubble({ message }: { message: Message }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end gap-2.5">
        <div className="max-w-[78%] rounded-2xl rounded-tr-sm bg-gradient-to-br from-orange-500 to-amber-500 px-4 py-2.5 text-sm text-white leading-relaxed shadow-sm shadow-orange-100">
          {message.content}
        </div>
        <div className="h-8 w-8 rounded-full bg-neutral-800 text-white text-xs font-bold flex-shrink-0 flex items-center justify-center">B</div>
      </div>
    );
  }

  const tool = lastTool(message);
  const igParsed = tool === "draft_instagram_post" ? parseIGPost(message.content) : null;

  return (
    <div className="flex justify-start gap-2.5">
      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-orange-400 to-amber-500 text-white text-xs font-bold flex-shrink-0 flex items-center justify-center shadow-sm mt-0.5">K</div>
      <div className="flex-1 min-w-0 space-y-2.5">
        {/* Step pills */}
        {message.steps && message.steps.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {message.steps.map((s, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-[11px]">
                <span className="h-1.5 w-1.5 rounded-full bg-orange-500 flex-shrink-0" />
                <span className="font-mono font-semibold text-orange-600">{s.tool}</span>
                <span className="text-neutral-500 max-w-[14rem] truncate">{s.summary}</span>
              </span>
            ))}
          </div>
        )}

        {/* IG post card */}
        {igParsed ? (
          <IGPostCard parsed={igParsed} />
        ) : tool === "draft_review_reply" ? (
          <ReviewReplyCard content={message.content} />
        ) : tool === "draft_winback_sms" ? (
          <SMSPreviewCard content={message.content} />
        ) : (
          /* Default: markdown */
          <div className="max-w-[92%] rounded-2xl rounded-tl-sm border border-neutral-200 bg-white px-4 py-3.5 text-sm text-neutral-800 leading-relaxed shadow-sm">
            <AgentMarkdown content={message.content} />
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// VISUAL CONTENT CARDS
// ═══════════════════════════════════════════════════════════════════════════════

function IGPostCard({ parsed }: { parsed: { caption: string; hashtags: string[]; photoBrief: string } }) {
  const { copied, copy } = useCopy();
  const full = [parsed.caption, parsed.hashtags.join(" ")].filter(Boolean).join("\n\n");

  return (
    <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden shadow-sm max-w-sm">
      {/* IG header */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-neutral-100">
        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center text-white text-xs font-bold">P</div>
        <div>
          <div className="text-xs font-semibold text-neutral-900">paper_lantern_demo</div>
          <div className="text-[10px] text-neutral-400">Demo Harbor (fictional)</div>
        </div>
        <Instagram size={16} className="ml-auto text-neutral-400" />
      </div>

      {/* Photo brief placeholder */}
      <div className="bg-gradient-to-br from-neutral-800 to-neutral-900 h-44 flex flex-col items-center justify-center gap-2 px-6 text-center">
        <span className="text-3xl">📸</span>
        {parsed.photoBrief && (
          <>
            <p className="text-[10px] text-white/50 uppercase tracking-widest">Photo brief</p>
            <p className="text-xs text-white/80 italic leading-relaxed">{parsed.photoBrief}</p>
          </>
        )}
      </div>

      {/* Caption */}
      <div className="px-4 py-3">
        <p className="text-xs text-neutral-800 leading-relaxed whitespace-pre-wrap">{parsed.caption}</p>
        {parsed.hashtags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {parsed.hashtags.map((tag) => (
              <span key={tag} className="text-[11px] text-blue-500 font-medium">{tag}</span>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-4 pb-4 flex gap-2">
        <button onClick={() => copy(full)}
          className="flex-1 flex items-center justify-center gap-1.5 bg-orange-500 text-white text-xs font-semibold rounded-xl py-2.5 hover:bg-orange-600 transition-colors">
          {copied ? <><Check size={13} /> Copied!</> : <><Copy size={13} /> Copy caption</>}
        </button>
        <button className="flex-1 border border-neutral-200 text-neutral-600 text-xs font-semibold rounded-xl py-2.5 hover:bg-neutral-50 transition-colors">
          Regenerate
        </button>
      </div>
    </div>
  );
}

function SMSPreviewCard({ content }: { content: string }) {
  const { copied, copy } = useCopy();
  // Extract the SMS message — look for a line that reads like a message
  const lines = content.split("\n").filter(Boolean);
  const smsLine = lines.find((l) => l.startsWith("Hi ") || l.includes("{first_name}") || l.includes("it's been")) ?? lines[0] ?? content;

  return (
    <div className="max-w-[260px]">
      {/* Phone frame */}
      <div className="bg-[#1c1c1e] rounded-[2rem] p-2.5 shadow-2xl">
        <div className="bg-[#2c2c2e] rounded-[1.5rem] overflow-hidden">
          {/* Status bar */}
          <div className="flex items-center justify-between px-5 pt-3 pb-1">
            <span className="text-white text-[11px] font-semibold">9:41</span>
            <div className="flex gap-1.5 items-center">
              <div className="h-1.5 w-4 rounded-full bg-white/60" />
              <div className="h-1.5 w-1.5 rounded-full bg-white/60" />
            </div>
          </div>
          {/* App header */}
          <div className="text-center py-2 border-b border-white/10">
            <div className="text-white text-xs font-semibold">Messages</div>
            <div className="text-white/50 text-[10px] mt-0.5">Paper Lantern Demo Izakaya</div>
          </div>
          {/* Message bubble */}
          <div className="px-3 py-4 min-h-[110px] flex items-end">
            <div className="bg-orange-500 rounded-2xl rounded-bl-sm px-3.5 py-2.5 max-w-[90%]">
              <p className="text-white text-[11px] leading-relaxed">{smsLine}</p>
            </div>
          </div>
          {/* Input bar */}
          <div className="flex items-center gap-2 px-3 pb-4">
            <div className="flex-1 bg-white/10 rounded-full px-3 py-1.5">
              <span className="text-white/30 text-[11px]">iMessage</span>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-3 flex gap-2">
        <button onClick={() => copy(smsLine)}
          className="flex-1 flex items-center justify-center gap-1.5 bg-orange-500 text-white text-xs font-semibold rounded-xl py-2 hover:bg-orange-600 transition-colors">
          {copied ? <><Check size={12} /> Copied!</> : <><Copy size={12} /> Copy SMS</>}
        </button>
        <button className="flex-1 border border-neutral-200 text-neutral-600 text-xs font-semibold rounded-xl py-2 hover:bg-neutral-50 transition-colors">
          Regenerate
        </button>
      </div>
    </div>
  );
}

function ReviewReplyCard({ content }: { content: string }) {
  const { copied, copy } = useCopy();
  // Clean up the reply — remove any preamble the agent added
  const reply = content.replace(/^(here's|draft reply|reply:|public reply:)[^\n]*\n*/gi, "").trim();

  return (
    <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden shadow-sm max-w-md">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-neutral-100 bg-neutral-50">
        <MessageSquare size={13} className="text-blue-500" />
        <span className="text-xs font-semibold text-neutral-700">Draft Reply</span>
        <span className="ml-auto text-[10px] bg-blue-50 text-blue-600 font-semibold px-2 py-0.5 rounded-full">Ready to post</span>
      </div>

      <div className="px-4 py-4">
        {/* Reply preview */}
        <div className="bg-neutral-50 rounded-xl p-3 border border-neutral-100">
          <p className="text-sm text-neutral-800 leading-relaxed italic">&ldquo;{reply}&rdquo;</p>
        </div>

        {/* Sentiment tags */}
        <div className="flex flex-wrap gap-2 mt-3">
          <span className="text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-medium">✓ Acknowledges concern</span>
          <span className="text-[11px] bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full font-medium">✓ On-brand voice</span>
          <span className="text-[11px] bg-violet-50 text-violet-700 border border-violet-200 px-2 py-0.5 rounded-full font-medium">✓ Invites back</span>
        </div>
      </div>

      <div className="px-4 pb-4 flex gap-2">
        <button onClick={() => copy(reply)}
          className="flex-1 flex items-center justify-center gap-1.5 bg-orange-500 text-white text-xs font-semibold rounded-xl py-2.5 hover:bg-orange-600 transition-colors">
          {copied ? <><Check size={13} /> Copied!</> : <><Copy size={13} /> Copy & post</>}
        </button>
        <button className="flex-1 border border-neutral-200 text-neutral-600 text-xs font-semibold rounded-xl py-2.5 hover:bg-neutral-50 transition-colors">
          Edit
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// REVIEW SENTIMENT PANEL
// ═══════════════════════════════════════════════════════════════════════════════

function ReviewSentimentPanel({ snap, onAsk, canAsk }: { snap: Snapshot | null; onAsk: (s: string) => void; canAsk: boolean }) {
  // Entirely synthetic review fixtures, never scraped from real review platforms.
  const reviews = snap?.reviews.sample_pending.length
    ? snap.reviews.sample_pending
    : [
        { source: "yelp",   rating: 2, author: "Casey Demo", body: "Our demo reservation started late, and nobody explained the delay. The dumplings were good.", posted_at: null },
        { source: "google", rating: 5, author: "Drew Demo", body: "My favorite fictional tasting menu. The chef remembered that I enjoy sesame chicken skewers.",                  posted_at: null },
        { source: "google", rating: 3, author: "Finley Demo", body: "The tofu and skewers were excellent, but some sushi was too cold. I would try the cooked menu again.",          posted_at: null },
      ];

  if (!reviews.length) return null;

  return (
    <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <MessageSquare size={14} className="text-neutral-400" />
          <span className="text-sm font-semibold text-neutral-800">Pending Reviews</span>
          {snap?.reviews.pending_reply ? (
            <span className="text-[11px] bg-red-50 text-red-600 font-semibold px-1.5 py-0.5 rounded-full">{snap.reviews.pending_reply} open</span>
          ) : null}
        </div>
        <button className="text-xs text-orange-500 hover:text-orange-600 font-medium">View all</button>
      </div>
      <div className="space-y-3">
        {reviews.slice(0, 3).map((r, i) => {
          const s = sentimentLabel(r.rating);
          return (
            <div key={i} className={`rounded-xl border p-3 ${s.bg} border-transparent`}>
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-1.5">
                  <span className={`inline-flex h-2 w-2 rounded-full ${s.dot} flex-shrink-0`} />
                  <span className={`text-[11px] font-bold ${s.color}`}>{s.label}</span>
                  <span className="text-[11px] text-neutral-400">· {r.source}</span>
                </div>
                <div className="flex">
                  {Array.from({ length: 5 }).map((_, si) => (
                    <Star key={si} size={10} className={si < (r.rating ?? 0) ? "text-amber-400 fill-amber-400" : "text-neutral-300"} />
                  ))}
                </div>
              </div>
              <p className="text-[11px] text-neutral-700 leading-snug line-clamp-2 mb-2">&ldquo;{r.body}&rdquo;</p>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-neutral-400">— {r.author}</span>
                <button
                  onClick={() => onAsk(`Draft a public reply to this ${r.rating}-star ${r.source} review from ${r.author}: "${r.body}". Rating: ${r.rating} stars, source: ${r.source}.`)}
                  disabled={!canAsk}
                  className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${s.color} bg-white border border-current/20 hover:opacity-80`}>
                  Draft reply →
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// OTHER PANELS
// ═══════════════════════════════════════════════════════════════════════════════

function PerformanceOverview({ monthData, onViewReport }: { monthData: typeof MONTH_DATA[Month]; onViewReport: () => void }) {
  return (
    <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-semibold text-neutral-800">Performance Overview</span>
        <button onClick={onViewReport} className="text-xs text-orange-500 hover:text-orange-600 font-medium">View full report</button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {monthData.stats.map((s) => (
          <div key={s.label}>
            <div className="text-xs text-neutral-500 mb-1">{s.label}</div>
            <div className="text-xl font-bold text-neutral-900">{s.value}</div>
            <div className={`flex items-center gap-1 mt-0.5 text-xs font-semibold ${s.up ? "text-emerald-600" : "text-red-500"}`}>
              {s.up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}{s.delta}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TopInsightsPanel({ kpis, onViewReport }: { kpis: KPI[]; onViewReport: () => void }) {
  return (
    <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-semibold text-neutral-800">Top Insights</span>
        <button onClick={onViewReport} className="text-xs text-orange-500 hover:text-orange-600 font-medium flex items-center gap-1">
          View report <ArrowUpRight size={11} />
        </button>
      </div>
      <div className="space-y-3">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-neutral-100 flex-shrink-0">
                <Icon size={15} className="text-neutral-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-neutral-800 leading-tight">{kpi.label}</div>
                <div className="text-[11px] text-neutral-400 mt-0.5 leading-snug">{kpi.compare}</div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-sm font-bold text-neutral-900">{kpi.value}</div>
                <div className={`text-[11px] font-semibold ${kpi.up ? "text-emerald-600" : "text-red-500"}`}>
                  {kpi.up && kpi.delta !== "baseline" ? "+" : ""}{kpi.delta}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const PLACEHOLDER_ACTIVITY = [
  { label: "Review reply",      sub: "Draft created", time: "2h ago",  icon: MessageSquare, bg: "bg-blue-50",    color: "text-blue-600"   },
  { label: "Win-back campaign", sub: "Draft created", time: "4h ago",  icon: UserMinus,     bg: "bg-orange-50",  color: "text-orange-600" },
  { label: "Birthday outreach", sub: "Draft created", time: "1d ago",  icon: Cake,          bg: "bg-violet-100", color: "text-violet-600" },
  { label: "Slow night offer",  sub: "Draft created", time: "2d ago",  icon: TrendingDown,  bg: "bg-amber-50",   color: "text-amber-600"  },
];

function RecentActivityPanel({ snap, newIds, expanded, onToggle }: { snap: Snapshot | null; newIds: Set<string>; expanded: boolean; onToggle: () => void }) {
  const actions = snap?.recent_actions ?? [];
  const hasReal = actions.length > 0;
  const items = hasReal ? actions.slice(0, expanded ? 20 : 4) : PLACEHOLDER_ACTIVITY.slice(0, expanded ? 10 : 4);

  return (
    <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-semibold text-neutral-800">Recent Activity</span>
        <button onClick={onToggle} className="text-xs text-orange-500 hover:text-orange-600 font-medium">{expanded ? "Show less" : "View all"}</button>
      </div>
      <div className="space-y-1">
        {hasReal ? (actions.slice(0, expanded ? 20 : 4).map((a) => {
          const { icon: Icon, bg, color, name } = activityMeta(a.kind.replace(/^tool_call:/, ""));
          const isNew = newIds.has(a.id);
          return (
            <div key={a.id} className={`flex items-start gap-3 rounded-xl p-2 -mx-2 transition-all ${isNew ? "bg-orange-50 ring-1 ring-orange-200" : "hover:bg-neutral-50"}`}>
              <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${bg} flex-shrink-0`}><Icon size={14} className={color} /></div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-neutral-800">{name}</div>
                <div className="text-[11px] text-neutral-500 mt-0.5">Draft created</div>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-neutral-400 flex-shrink-0">
                {isNew ? <Zap size={10} className="text-orange-500 animate-pulse" /> : <Clock size={10} />}
                {isNew ? "now" : timeAgo(a.created_at)}
              </div>
            </div>
          );
        })) : (PLACEHOLDER_ACTIVITY.slice(0, expanded ? 10 : 4).map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="flex items-start gap-3 rounded-xl p-2 -mx-2 hover:bg-neutral-50">
              <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${item.bg} flex-shrink-0`}><Icon size={14} className={item.color} /></div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-neutral-800">{item.label}</div>
                <div className="text-[11px] text-neutral-500 mt-0.5">{item.sub}</div>
              </div>
              <div className="text-[11px] text-neutral-400 flex-shrink-0 flex items-center gap-1"><Clock size={10} />{item.time}</div>
            </div>
          );
        }))}
      </div>
    </div>
  );
}

function SectionPlaceholder({ section, onBack, onAsk, canAsk }: { section: NavSection; onBack: () => void; onAsk: (s: string) => void; canAsk: boolean }) {
  const meta: Record<NavSection, { title: string; desc: string; prompt: string; icon: any }> = {
    home:          { title:"Home",          desc:"",                                                                                   prompt:"",                                                                                               icon:Home          },
    conversations: { title:"Conversations", desc:"",                                                                                   prompt:"",                                                                                               icon:MessageCircle },
    customers:     { title:"Customers",     desc:"View and manage your guest list, lapsed guests, and birthday opportunities.",        prompt:"Give me a breakdown of our customer health — lapsed guests, recent visitors, birthdays this month.", icon:Users         },
    marketing:     { title:"Marketing",     desc:"Create and schedule win-back campaigns, SMS outreach, and seasonal promotions.",     prompt:"What marketing campaigns should I run this month based on our current guest data?",                icon:BarChart2     },
    content:       { title:"Content Studio",desc:"Draft Instagram posts, social captions, and brand-voice content for Paper Lantern Demo.",        prompt:"Draft three Instagram post ideas for this week based on what's selling best.",                     icon:BookOpen      },
    reviews:       { title:"Reviews",       desc:"View pending reviews from Google and Yelp, and draft replies in Paper Lantern Demo's voice.",    prompt:"Draft a reply to our most recent review.",                                                        icon:Star          },
    reports:       { title:"Reports",       desc:"Deep-dive into sales trends, product mix, and month-over-month performance.",       prompt:"Give me a full performance report comparing January, February, and March 2026.",                  icon:FileText      },
    integrations:  { title:"Integrations",  desc:"Toast webhook scaffold stores signed events; live parsing/sync is unfinished. Google Business and Yelp ingest are also unfinished.",  prompt:"What data is Kairo currently pulling from Toast POS?",                                           icon:Plug          },
    settings:      { title:"Settings",      desc:"Manage your restaurant profile, brand voice, and Kairo preferences.",              prompt:"What is Paper Lantern Demo's current brand voice setting?",                                                   icon:Settings      },
  };
  const m = meta[section]; const Icon = m.icon;
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-50 mb-4"><Icon size={28} className="text-orange-500" /></div>
      <h2 className="text-xl font-bold text-neutral-900 mb-2">{m.title}</h2>
      <p className="text-sm text-neutral-500 max-w-sm leading-relaxed mb-6">{m.desc}</p>
      {m.prompt && (
        <button onClick={() => { onBack(); onAsk(m.prompt); }} disabled={!canAsk}
          className="flex items-center gap-2 bg-orange-500 text-white rounded-xl px-5 py-2.5 text-sm font-semibold hover:bg-orange-600 transition-colors mb-3 disabled:opacity-50 disabled:cursor-not-allowed">
          <Sparkles size={14} /> {canAsk ? `Ask Kairo about ${m.title.toLowerCase()}` : "Requires service setup"}
        </button>
      )}
      <button onClick={onBack} className="text-sm text-neutral-500 hover:text-neutral-700">← Back to Home</button>
    </div>
  );
}

// ─── Conversation sub-components ─────────────────────────────────────────────

function EmptyConversation({ canAsk }: { canAsk: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="relative mb-4">
        <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center shadow-lg shadow-orange-200">
          <Sparkles size={26} className="text-white" />
        </div>
        {canAsk && <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-4 w-4 rounded-full bg-emerald-500 border-2 border-white" />
        </span>}
      </div>
      <p className="text-sm font-bold text-neutral-800">I&rsquo;m Kairo, your growth partner.</p>
      <p className="mt-1.5 text-xs text-neutral-500 max-w-xs leading-relaxed">
        {canAsk ? "Tap an action card above, or ask me anything about Paper Lantern Demo." : "Explore the synthetic dashboard. AI drafting requires configured services and, if enabled, the demo password."}
      </p>
    </div>
  );
}

function Thinking() {
  return (
    <div className="flex justify-start gap-2.5">
      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-orange-400 to-amber-500 text-white text-xs font-bold flex-shrink-0 flex items-center justify-center">K</div>
      <div className="flex items-center gap-2.5 rounded-2xl rounded-tl-sm border border-neutral-200 bg-white px-4 py-3 shadow-sm">
        <Brain size={14} className="text-orange-500 animate-pulse" />
        <span className="text-sm text-neutral-500">Working on it…</span>
        <div className="flex gap-1">
          {[0,1,2].map((i) => <div key={i} className="h-1.5 w-1.5 rounded-full bg-orange-400/50 animate-bounce" style={{ animationDelay:`${i*150}ms` }} />)}
        </div>
      </div>
    </div>
  );
}

function AgentMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown components={{
      h1: ({children})=><h3 className="mt-3 first:mt-0 text-base font-bold text-neutral-900">{children}</h3>,
      h2: ({children})=><h3 className="mt-3 first:mt-0 text-sm font-bold text-neutral-900">{children}</h3>,
      h3: ({children})=><h4 className="mt-2 first:mt-0 text-sm font-semibold text-neutral-900">{children}</h4>,
      p:  ({children})=><p className="my-1.5 first:mt-0 last:mb-0 leading-relaxed">{children}</p>,
      ul: ({children})=><ul className="my-1.5 ml-4 list-disc space-y-0.5">{children}</ul>,
      ol: ({children})=><ol className="my-1.5 ml-4 list-decimal space-y-0.5">{children}</ol>,
      li: ({children})=><li className="leading-relaxed">{children}</li>,
      strong: ({children})=><strong className="font-semibold text-neutral-900">{children}</strong>,
      blockquote: ({children})=><blockquote className="my-2 border-l-2 border-orange-300 pl-3 text-neutral-600 italic">{children}</blockquote>,
      code: ({children})=><code className="rounded-md bg-neutral-100 px-1.5 py-0.5 text-xs font-mono text-neutral-700">{children}</code>,
      hr: ()=><hr className="my-3 border-neutral-200" />,
      a: ({href,children})=><a href={href} className="text-orange-500 underline-offset-2 hover:underline" target="_blank" rel="noreferrer">{children}</a>,
    }}>
      {content}
    </ReactMarkdown>
  );
}
