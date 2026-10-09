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
  let ac = roleCol("amount"), tc = roleCol("tax"),
    lineAmt = i => num(itemValue(i, ac || { role: "none", key: "amount" })),
    subtotal = state.items.reduce((s, i) => s + lineAmt(i), 0),
    dr = Math.max(0, Math.min(100, num($("discount").value))),
    disc = subtotal * dr / 100,
    taxable = subtotal - disc,
    tr = Math.max(0, Math.min(100, num($("tax").value))),
    tax = taxable * tr / 100,
    t2el = $("tax2"), t2on = state.sections.tax2 !== false,
    tr2 = t2on && t2el ? Math.max(0, Math.min(100, num(t2el.value))) : 0,
    tax2 = taxable * tr2 / 100,
    // Per-line tax: a column with the "tax" role holds each line's rate (%);
    // the invoice discount reduces each line proportionally before tax.
    itemTax = tc ? state.items.reduce((s, i) => s + lineAmt(i) * (1 - dr / 100) * Math.max(0, num(i[tc.key])) / 100, 0) : 0,
    ship = Math.max(0, num($("shipping").value)),
    total = taxable + tax + tax2 + itemTax + ship,
    pel = $("amountPaid"), paidOn = state.sections.amountPaid !== false,
    paid = paidOn && pel ? Math.max(0, num(pel.value)) : 0,
    balance = total - paid;
  return { subtotal, dr, disc, tr, tax, tr2, tax2, itemTax, hasItemTax: !!tc, ship, total, paid, balance };
}