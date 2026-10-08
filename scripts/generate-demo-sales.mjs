// Synthetic fixtures only. Print SQL; never connect to a database or read credentials.
import { readFileSync } from "node:fs";
const data = JSON.parse(readFileSync(new URL("../src/lib/demo/sales.json", import.meta.url), "utf8"));
const quote = (value) => "'" + value.replaceAll("'", "''") + "'";
const lines = [
  "-- Synthetic demo product mix for Paper Lantern Demo Izakaya. No real POS data.",
  "-- Generated from src/lib/demo/sales.json; regenerate with node scripts/generate-demo-sales.mjs.",
  "-- Gross = quantity * price; discounts = 2% of gross; net = gross - discounts.",
  "DO $$", "DECLARE rid uuid;", "BEGIN",
  "  SELECT id INTO rid FROM restaurants WHERE slug = 'paper-lantern-demo';",
  "  IF rid IS NULL THEN",
  "    RAISE EXCEPTION 'Apply 0001_initial_schema.sql first to create the fictional demo tenant.';",
  "  END IF;", "",
];
for (const [index, month] of data.months.entries()) {
  for (const item of data.items) {
    const qty = item.quantities[index];
    const gross = qty * item.price;
    const discount = gross * 0.02;
    lines.push(
      "  INSERT INTO menu_sales (restaurant_id, month, item, menu_group, qty_sold, gross_sales, net_sales, avg_price, discount_amt) VALUES (rid, " +
      [quote(month), quote(item.name), quote(item.category), qty, gross.toFixed(2), (gross - discount).toFixed(2), item.price.toFixed(2), discount.toFixed(2)].join(", ") +
      ") ON CONFLICT (restaurant_id, month, item) DO UPDATE SET menu_group=EXCLUDED.menu_group, qty_sold=EXCLUDED.qty_sold, gross_sales=EXCLUDED.gross_sales, net_sales=EXCLUDED.net_sales, avg_price=EXCLUDED.avg_price, discount_amt=EXCLUDED.discount_amt;"
    );
  }
}
lines.push("END $$;");
process.stdout.write(lines.join("\n") + "\n");
