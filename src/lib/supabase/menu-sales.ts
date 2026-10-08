// Menu-sales data layer for Kairo.
//
// Uses an untyped Supabase client to avoid type-compatibility issues between
// the hand-rolled Database stub and newer supabase-js generic constraints.
// All queries are scoped to a restaurant_id.

import { createClient } from "@supabase/supabase-js";

function getClient() {
  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "";
  const key  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

// ── Types ────────────────────────────────────────────────────────────────────

export type TopItem = {
  item: string;
  menu_group: string | null;
  qty_sold: number;
  gross_sales: number;
  avg_price: number | null;
};

export type CategoryBreakdown = {
  menu_group: string;
  total_qty: number;
  total_gross: number;
};

export type TrendItem = {
  item: string;
  menu_group: string | null;
  months: Record<string, number>;
  direction: "up" | "down" | "flat";
  pct_change: number;
};

export type MenuInsights = {
  latest_month: string;
  top_by_qty: TopItem[];
  top_by_revenue: TopItem[];
  category_breakdown: CategoryBreakdown[];
  months_available: string[];
};

export type SalesTrends = {
  monthly_totals: Array<{ month: string; total_qty: number; total_gross: number }>;
  trending_up: TrendItem[];
  trending_down: TrendItem[];
  consistent_top: TopItem[];
};

// ── Helpers ──────────────────────────────────────────────────────────────────

type Row = {
  item: string;
  menu_group: string | null;
  month: string;
  qty_sold: number;
  gross_sales: number;
  net_sales: number;
  avg_price: number | null;
  discount_amt: number;
};

function sortedMonths(rows: Row[]): string[] {
  return [...new Set(rows.map((r) => r.month))].sort();
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function getMenuInsights(
  restaurantId: string,
  month?: string
): Promise<MenuInsights | null> {
  try {
    const supabase = getClient();
    const { data, error } = await supabase
      .from("menu_sales")
      .select("item, menu_group, month, qty_sold, gross_sales, net_sales, avg_price, discount_amt")
      .eq("restaurant_id", restaurantId)
      .order("month", { ascending: false });

    if (error || !data || data.length === 0) return null;

    const rows = data as Row[];
    const months = sortedMonths(rows);
    const targetMonth = month ?? months[months.length - 1];
    const monthRows = rows.filter((r) => r.month === targetMonth);

    const byQty = [...monthRows]
      .sort((a, b) => b.qty_sold - a.qty_sold)
      .slice(0, 10)
      .map((r) => ({ item: r.item, menu_group: r.menu_group, qty_sold: r.qty_sold, gross_sales: r.gross_sales, avg_price: r.avg_price }));

    const byRevenue = [...monthRows]
      .sort((a, b) => b.gross_sales - a.gross_sales)
      .slice(0, 10)
      .map((r) => ({ item: r.item, menu_group: r.menu_group, qty_sold: r.qty_sold, gross_sales: r.gross_sales, avg_price: r.avg_price }));

    const groupMap: Record<string, { qty: number; gross: number }> = {};
    for (const r of monthRows) {
      const g = r.menu_group ?? "Uncategorized";
      if (!groupMap[g]) groupMap[g] = { qty: 0, gross: 0 };
      groupMap[g].qty   += r.qty_sold;
      groupMap[g].gross += r.gross_sales;
    }
    const categoryBreakdown: CategoryBreakdown[] = Object.entries(groupMap)
      .map(([menu_group, v]) => ({ menu_group, total_qty: v.qty, total_gross: v.gross }))
      .sort((a, b) => b.total_gross - a.total_gross);

    return { latest_month: targetMonth, top_by_qty: byQty, top_by_revenue: byRevenue, category_breakdown: categoryBreakdown, months_available: months };
  } catch {
    return null;
  }
}

export async function getSalesTrends(restaurantId: string): Promise<SalesTrends | null> {
  try {
    const supabase = getClient();
    const { data, error } = await supabase
      .from("menu_sales")
      .select("item, menu_group, month, qty_sold, gross_sales")
      .eq("restaurant_id", restaurantId)
      .order("month", { ascending: true });

    if (error || !data || data.length === 0) return null;

    const rows = data as Row[];
    const months = sortedMonths(rows);

    const monthlyTotals = months.map((m) => {
      const mRows = rows.filter((r) => r.month === m);
      return {
        month:       m,
        total_qty:   mRows.reduce((s, r) => s + r.qty_sold, 0),
        total_gross: Math.round(mRows.reduce((s, r) => s + r.gross_sales, 0) * 100) / 100,
      };
    });

    const itemMap: Record<string, TrendItem> = {};
    for (const r of rows) {
      if (!itemMap[r.item]) itemMap[r.item] = { item: r.item, menu_group: r.menu_group, months: {}, direction: "flat", pct_change: 0 };
      itemMap[r.item].months[r.month] = r.qty_sold;
    }

    const earliest = months[0];
    const latest   = months[months.length - 1];
    const allMonthItems = Object.values(itemMap).filter((t) => Object.keys(t.months).length === months.length);

    for (const t of allMonthItems) {
      const first = t.months[earliest] ?? 0;
      const last  = t.months[latest]   ?? 0;
      t.pct_change = first === 0 ? 0 : Math.round(((last - first) / first) * 100);
      t.direction  = t.pct_change > 5 ? "up" : t.pct_change < -5 ? "down" : "flat";
    }

    const trendingUp   = allMonthItems.filter((t) => t.direction === "up").sort((a, b) => b.pct_change - a.pct_change).slice(0, 8);
    const trendingDown = allMonthItems.filter((t) => t.direction === "down").sort((a, b) => a.pct_change - b.pct_change).slice(0, 5);

    const consistentTop = allMonthItems
      .map((t) => {
        const avgQty = Object.values(t.months).reduce((s, v) => s + v, 0) / months.length;
        const latestRow = rows.find((r) => r.item === t.item && r.month === latest);
        return { item: t.item, menu_group: t.menu_group, qty_sold: Math.round(avgQty), gross_sales: latestRow?.gross_sales ?? 0, avg_price: latestRow?.avg_price ?? null };
      })
      .sort((a, b) => b.qty_sold - a.qty_sold)
      .slice(0, 10);

    return { monthly_totals: monthlyTotals, trending_up: trendingUp, trending_down: trendingDown, consistent_top: consistentTop };
  } catch {
    return null;
  }
}
