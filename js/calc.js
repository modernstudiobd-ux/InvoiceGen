// calc.js — line-item and invoice-total math.

import { $ } from "./dom.js";
import { state } from "./state.js";
import { num } from "./format.js";

export const isBlank = v => v == null || String(v).trim() === "";

export function roleCol(role) {
  return state.columns.find(c => c.role === role);
}

export function itemValue(item, col) {
  if (col.role === "amount") {
    let q = roleCol("quantity"), r = roleCol("rate");
    // Price-only lines: a blank quantity — or no quantity column at all —
    // means quantity 1, so the line total is the rate itself. An explicitly
    // typed 0 stays 0.
    if (r) return (q && !isBlank(item[q.key]) ? num(item[q.key]) : 1) * num(item[r.key]);
    return num(item[col.key]);
  }
  return item[col.key] ?? "";
}

export function calc() {
  let ac = roleCol("amount"),
    subtotal = state.items.reduce((s, i) => s + num(itemValue(i, ac || { role: "none", key: "amount" })), 0),
    dr = Math.max(0, Math.min(100, num($("discount").value))),
    disc = subtotal * dr / 100,
    taxable = subtotal - disc,
    tr = Math.max(0, Math.min(100, num($("tax").value))),
    tax = taxable * tr / 100,
    ship = Math.max(0, num($("shipping").value));
  return { subtotal, dr, disc, tr, tax, ship, total: taxable + tax + ship };
}
