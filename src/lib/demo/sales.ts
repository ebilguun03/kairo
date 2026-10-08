import data from "./sales.json";

// Shared synthetic fixtures: the dashboard, Claude prompt and SQL seed agree.
export const DEMO_RESTAURANT = data.restaurant;
export type DemoMonth = "2026-01" | "2026-02" | "2026-03";
export const DEMO_MONTHS = data.months as DemoMonth[];
export const money = (value: number) => "$" + value.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
export const growth = (value: number, previous?: number) => previous ? ((value / previous - 1) * 100).toFixed(1) + "%" : "baseline";

export const DEMO_SUMMARIES = DEMO_MONTHS.map((month, index) => {
  const items = data.items.map((item) => ({ ...item, qty: item.quantities[index], gross: item.quantities[index] * item.price }));
  const gross = items.reduce((total, item) => total + item.gross, 0);
  const quantity = items.reduce((total, item) => total + item.qty, 0);
  const categories = [...new Set(items.map((item) => item.category))].map((name) => ({
    name, gross: items.filter((item) => item.category === name).reduce((sum, item) => sum + item.gross, 0),
    qty: items.filter((item) => item.category === name).reduce((sum, item) => sum + item.qty, 0),
  }));
  const context = data.monthlyContext[index];
  return {
    month, label: new Date(month + "-01T12:00:00Z").toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" }),
    gross, quantity, net: gross * 0.98, discounts: gross * 0.02,
    avgCheck: gross / context.checks, returningVisits: context.returningVisits,
    averageRating: context.reviewStars.reduce((sum, stars) => sum + stars, 0) / context.reviewStars.length,
    topCategory: [...categories].sort((a, b) => b.gross - a.gross)[0],
    topVolumeCategory: [...categories].sort((a, b) => b.qty - a.qty)[0],
    topItem: [...items].sort((a, b) => b.qty - a.qty)[0], items, categories,
  };
});
export const DEMO_LATEST = DEMO_SUMMARIES[DEMO_SUMMARIES.length - 1];
export const DEMO_PREVIOUS = DEMO_SUMMARIES[DEMO_SUMMARIES.length - 2];
export const DEMO_SALES_CONTEXT = [
  "SYNTHETIC DEMO DATA for " + DEMO_RESTAURANT.name + " (Jan-Mar 2026). Not real Ozora or Toast records; no live POS sync is configured by these fixtures.",
  ...DEMO_SUMMARIES.map((s, i) => s.label + ": gross sales " + money(s.gross) + ", net " + money(s.net) + ", items sold " + s.quantity + ", growth " + growth(s.gross, DEMO_SUMMARIES[i - 1]?.gross) + "."),
  "Latest top revenue category: " + DEMO_LATEST.topCategory.name + " (" + money(DEMO_LATEST.topCategory.gross) + ", " + (DEMO_LATEST.topCategory.gross / DEMO_LATEST.gross * 100).toFixed(1) + "% of gross).",
  "Latest top volume category: " + DEMO_LATEST.topVolumeCategory.name + " (" + DEMO_LATEST.topVolumeCategory.qty + " items).",
  "Latest best-selling item by quantity: " + DEMO_LATEST.topItem.name + " (" + DEMO_LATEST.topItem.qty + " sold).",
  "Item detail: " + DEMO_LATEST.items.map((item) => item.name + ": " + item.qty + " sold, " + money(item.gross) + " gross").join("; "),
  "Monthly check counts, returning visits and rating samples are synthetic illustration fixtures, separate from the 30-guest CRM sample.",
].join("\n");
