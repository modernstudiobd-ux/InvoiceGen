// calculators.js — the Revenue Forecast and Markup Calculator tools shown in
// the Calculators panel (sidebar → Invoicing). Self-contained: they read only
// their own inputs, never touch the invoice, and are not saved with it.
// Money is shown in the invoice's current currency via format.js's money().

import { $ } from "./dom.js";
import { num, money } from "./format.js";

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const pct = v => (Number.isFinite(v) ? (Math.round(v * 100) / 100) + "%" : "—");
const safeMoney = v => (Number.isFinite(v) ? money(v) : "—");

// ---- Revenue forecast: compound monthly growth ---------------------------
export function forecastRows(start, growthPct, months) {
  const rows = []; let rev = start, cum = 0;
  for (let m = 1; m <= months; m++) {
    cum += rev;
    rows.push({ month: m, revenue: rev, cumulative: cum });
    rev = rev * (1 + growthPct / 100);
  }
  return rows;
}

export function renderForecast() {
  const months = clamp(Math.round(num($("fcMonths").value)) || 1, 1, 36);
  const rows = forecastRows(Math.max(0, num($("fcStart").value)), num($("fcGrowth").value), months);
  const last = rows[rows.length - 1];
  $("fcTotal").textContent = safeMoney(last.cumulative);
  $("fcFinal").textContent = safeMoney(last.revenue);
  $("fcRows").innerHTML = rows.map(r => `<tr><td>${r.month}</td><td>${safeMoney(r.revenue)}</td><td>${safeMoney(r.cumulative)}</td></tr>`).join("");
}

// ---- Markup: price = cost × (1 + markup%); margin = profit / price -------
// Two-way: editing Markup % sets the price; editing the price sets Markup %;
// editing Cost keeps the markup and recalculates the price.
export function renderMarkup(source) {
  const cost = Math.max(0, num($("mkCost").value));
  if (source === "price") {
    const price = Math.max(0, num($("mkPrice").value));
    $("mkMarkup").value = cost > 0 ? String(Math.round(((price - cost) / cost) * 10000) / 100) : "";
  } else {
    const price = cost * (1 + num($("mkMarkup").value) / 100);
    $("mkPrice").value = String(Math.round(price * 100) / 100);
  }
  const price = Math.max(0, num($("mkPrice").value));
  const profit = price - cost;
  $("mkProfit").textContent = safeMoney(profit);
  $("mkMargin").textContent = price > 0 ? pct((profit / price) * 100) : "—";
}

export function setCalcTab(tab) {
  const t = tab === "markup" ? "markup" : "forecast";
  document.querySelectorAll("[data-calc-tab]").forEach(b => {
    const on = b.dataset.calcTab === t;
    b.classList.toggle("active", on); b.setAttribute("aria-selected", on ? "true" : "false");
  });
  $("calcForecast").hidden = t !== "forecast";
  $("calcMarkup").hidden = t !== "markup";
  document.querySelectorAll("[data-calc]").forEach(b => {
    if (b.dataset.calc) b.classList.toggle("active", b.dataset.calc === t && $("calculatorsPanel").classList.contains("open"));
  });
  if (t === "forecast") renderForecast(); else renderMarkup();
}

export function initCalculators() {
  ["fcStart", "fcGrowth", "fcMonths"].forEach(id => $(id).addEventListener("input", renderForecast));
  $("mkCost").addEventListener("input", () => renderMarkup("cost"));
  $("mkMarkup").addEventListener("input", () => renderMarkup("markup"));
  $("mkPrice").addEventListener("input", () => renderMarkup("price"));
  document.querySelectorAll("[data-calc-tab]").forEach(b => b.addEventListener("click", () => setCalcTab(b.dataset.calcTab)));
  // Re-render when the invoice currency changes so amounts follow it.
  $("currency").addEventListener("change", () => { if ($("calculatorsPanel").classList.contains("open")) setCalcTab(document.querySelector("[data-calc-tab].active")?.dataset.calcTab); });
  setCalcTab("forecast");
}
