// Verify synthetic fixtures without credentials, network access or database writes.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import vm from "node:vm";
const require = createRequire(import.meta.url);
const ts = require("typescript");
const read = (file) => readFileSync(new URL("../" + file, import.meta.url), "utf8");
const data = JSON.parse(read("src/lib/demo/sales.json"));
assert.equal(data.synthetic, true);
assert.equal(data.restaurant.slug, "paper-lantern-demo");
assert.equal(data.items.length, 24);
assert.equal(new Set(data.items.map((item) => item.name)).size, data.items.length);
assert.equal(new Set(data.items.map((item) => item.category)).size, 8);
for (const [index] of data.months.entries()) {
  assert(data.monthlyContext[index].returningVisits <= data.monthlyContext[index].checks);
  for (const star of data.monthlyContext[index].reviewStars) assert(star >= 1 && star <= 5);
  for (const item of data.items) {
    assert(Number.isInteger(item.quantities[index]) && item.quantities[index] > 0);
    assert(item.price > 0);
  }
}
const sql = read("supabase/migrations/0003_menu_sales_seed.sql");
const generated = execFileSync(process.execPath, [new URL("generate-demo-sales.mjs", import.meta.url).pathname], { encoding: "utf8" });
assert.equal(sql, generated, "SQL seed must exactly match the fixture generator");
assert.equal((sql.match(/INSERT INTO menu_sales/g) || []).length, 72);
const salesSource = read("src/lib/demo/sales.ts");
const sandbox = { exports: {}, require: () => data };
vm.runInNewContext(ts.transpileModule(salesSource, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, sandbox);
const sales = sandbox.exports;
const dashboard = read("src/app/demo/page.tsx");
const block = dashboard.slice(dashboard.indexOf("const MONTH_DATA ="), dashboard.indexOf("// ─── Scenario cards"));
const ui = { ...sales, exports: {}, Users: "Users", Star: "Star", BarChart2: "BarChart2" };
vm.runInNewContext(ts.transpileModule(block + "\nexports.MONTH_DATA = MONTH_DATA;", { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, ui);
const agent = read("src/lib/claude/agent.ts");
assert(agent.includes("DEMO_SALES_CONTEXT"));
assert(agent.includes("ctx?.restaurant.slug === DEMO_RESTAURANT.slug"));
for (const [index, summary] of sales.DEMO_SUMMARIES.entries()) {
  const gross = data.items.reduce((sum, item) => sum + item.price * item.quantities[index], 0);
  const qty = data.items.reduce((sum, item) => sum + item.quantities[index], 0);
  assert.equal(summary.gross, gross);
  assert.equal(summary.quantity, qty);
  assert.equal(ui.exports.MONTH_DATA[summary.month].stats[0].value, sales.money(gross));
  assert.equal(ui.exports.MONTH_DATA[summary.month].stats[1].value, qty.toLocaleString("en-US"));
  assert(sales.DEMO_SALES_CONTEXT.includes(sales.money(gross)));
  for (const item of data.items) {
    const rows = sql.split("\n").filter((line) => line.includes("'" + summary.month + "'") && line.includes("'" + item.name + "'"));
    assert.equal(rows.length, 1);
    const gross = item.quantities[index] * item.price;
    const net = gross * 0.98;
    assert(rows[0].includes(gross.toFixed(2) + ", " + net.toFixed(2)));
  }
  console.log(summary.month + ": " + sales.money(gross) + " gross, " + qty + " items, growth " + sales.growth(gross, sales.DEMO_SUMMARIES[index - 1]?.gross));
}
const guests = read("supabase/seed_demo.sql");
assert.equal((guests.match(/guest\d{2}@example\.com/g) || []).length, 30);
assert.equal((guests.match(/\+120255501\d{2}/g) || []).length, 30);
assert.equal((guests.match(/, extract\(month from now\(\)\)::int,/g) || []).length, 6);
assert(guests.includes("generate_series(0, g.visit_count - 1)"));
assert(!guests.toLowerCase().includes("ozora"));
console.log("PASS: SQL, Claude and dashboard sales agree; fictional contacts and visit-history invariants verified.");
