// reports.js — Reports page: billed / received / outstanding from Saved invoices,
// per currency (amounts in different currencies are never added together),
// a monthly bar chart (single series, one hue) with hover values and a table
// view, and top clients. Estimates are excluded; receipts count as paid.

import { $, esc } from "./dom.js";
import { num, moneyFor } from "./format.js";
import { loadLibrary } from "./library.js";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const ym = d => d.getFullYear() * 12 + d.getMonth();

function rows() {
  return loadLibrary().map(e => {
    const f = (e.snapshot && e.snapshot.fields) || {}, sec = (e.snapshot && e.snapshot.sections) || {};
    const kind = e.docType || (e.snapshot && e.snapshot.docType) || "invoice";
    const ds = e.invoiceDate || f.invoiceDate;
    const date = ds && /^\d{4}-\d{2}-\d{2}$/.test(ds) ? new Date(ds + "T00:00:00") : new Date(e.updatedAt || Date.now());
    const total = num(e.total);
    let paid = e.paid != null ? num(e.paid) : (sec.amountPaid === false ? 0 : num(f.amountPaid));
    if (kind === "receipt") paid = total;
    return { kind, date, total, paid: Math.min(paid, total), currency: e.currency || f.currency || "USD", client: (e.clientName || f.clientName || "").trim() || "No client name" };
  }).filter(r => r.kind !== "estimate");
}

function render() {
  const body = $("reportsBody"); if (!body) return;
  const all = rows();
  const curSel = $("reportCurrency"), counts = {};
  all.forEach(r => counts[r.currency] = (counts[r.currency] || 0) + 1);
  const curs = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
  const prev = curSel.value;
  curSel.innerHTML = curs.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join("");
  curSel.value = curs.includes(prev) ? prev : (curs[0] || "");
  $("reportCurWrap").hidden = curs.length < 2;
  if (!all.length) {
    body.innerHTML = `<div class="history-empty pg-empty"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true" focusable="false"><line x1="4" y1="20" x2="20" y2="20"/><rect x="5" y="11" width="3" height="6" rx="1"/><rect x="10.5" y="7" width="3" height="10" rx="1"/><rect x="16" y="4" width="3" height="13" rx="1"/></svg><h3>No data yet</h3><p class="hint">Reports are built from your <strong>Saved invoices</strong>. Save an invoice (top of the editor) and it will appear here.</p></div>`;
    return;
  }
  const cur = curSel.value, per = $("reportPeriod").value, now = new Date();
  let start;
  if (per === "ytd") start = new Date(now.getFullYear(), 0, 1);
  else if (per === "12") start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  else start = new Date(Math.min(...all.map(r => r.date.getTime())));
  const data = all.filter(r => r.currency === cur && r.date >= new Date(start.getFullYear(), start.getMonth(), 1) && r.date <= new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59));
  const billed = data.reduce((s, r) => s + r.total, 0), received = data.reduce((s, r) => s + r.paid, 0);
  const m = v => moneyFor(v, cur);
  const tiles = [["Invoices", String(data.length)], ["Billed", m(billed)], ["Received", m(received)], ["Outstanding", m(billed - received)]];

  // Months in range
  const first = ym(start), last = ym(now), months = [];
  for (let k = Math.max(first, last - 59); k <= last; k++) months.push({ k, label: MONTHS[k % 12] + (k % 12 === 0 || k === first ? " " + String(Math.floor(k / 12)).slice(2) : ""), year: Math.floor(k / 12), billed: 0, received: 0 });
  data.forEach(r => { const x = months.find(mm => mm.k === ym(r.date)); if (x) { x.billed += r.total; x.received += r.paid; } });
  const max = Math.max(1, ...months.map(x => x.billed));
  const nice = (v => { const p = Math.pow(10, Math.floor(Math.log10(v))); return Math.ceil(v / p) * p; })(max);
  const W = 720, H = 220, padL = 8, padB = 26, padT = 10, plotH = H - padB - padT, n = months.length, slot = (W - padL) / n, bw = Math.max(6, Math.min(28, slot * 0.56));
  const bars = months.map((x, i) => {
    const h = x.billed ? Math.max(2, x.billed / nice * plotH) : 0, cx = padL + slot * i + slot / 2, y = padT + plotH - h;
    const full = MONTHS[x.k % 12] + " " + x.year;
    return `<g class="rp-bar" tabindex="0" aria-label="${esc(full)}: billed ${esc(m(x.billed))}, received ${esc(m(x.received))}">
      <rect class="rp-hit" x="${(cx - slot / 2).toFixed(1)}" y="${padT}" width="${slot.toFixed(1)}" height="${plotH}"/>
      ${h ? `<path class="rp-mark" d="M${(cx - bw / 2).toFixed(1)} ${(padT + plotH).toFixed(1)}V${(y + 4).toFixed(1)}q0 -4 4 -4h${(bw - 8).toFixed(1)}q4 0 4 4V${(padT + plotH).toFixed(1)}Z"/>` : ""}
      <title>${esc(full)} — Billed ${esc(m(x.billed))} · Received ${esc(m(x.received))}</title>
      ${n <= 18 || i % Math.ceil(n / 12) === 0 ? `<text class="rp-x" x="${cx.toFixed(1)}" y="${H - 8}" text-anchor="middle">${esc(x.label)}</text>` : ""}</g>`;
  }).join("");
  const grid = [0, 0.5, 1].map(f => { const y = padT + plotH - f * plotH; return `<line class="rp-grid" x1="${padL}" x2="${W}" y1="${y}" y2="${y}"/>`; }).join("");

  // Top clients
  const byClient = {};
  data.forEach(r => { const c = byClient[r.client] || (byClient[r.client] = { n: 0, billed: 0, paid: 0 }); c.n++; c.billed += r.total; c.paid += r.paid; });
  const top = Object.entries(byClient).sort((a, b) => b[1].billed - a[1].billed).slice(0, 10);

  body.innerHTML = `
    <div class="rp-tiles">${tiles.map(([l, v]) => `<div class="rp-tile"><span>${l}</span><strong>${esc(v)}</strong></div>`).join("")}</div>
    <section class="rp-card" aria-labelledby="rpMonthsH"><div class="rp-card-head"><h3 id="rpMonthsH">Billed per month</h3><span class="hint">${esc(cur)} · hover or focus a bar for details</span></div>
      <div class="rp-chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Amount billed per month in ${esc(cur)}" preserveAspectRatio="none">${grid}${bars}</svg>
      <div class="rp-tip" id="rpTip" hidden></div></div>
      <details class="rp-table-toggle"><summary>Show as table</summary><div class="rp-table-wrap"><table class="rp-table"><thead><tr><th scope="col">Month</th><th scope="col">Billed</th><th scope="col">Received</th><th scope="col">Outstanding</th></tr></thead><tbody>${months.slice().reverse().map(x => `<tr><th scope="row">${MONTHS[x.k % 12]} ${x.year}</th><td>${esc(m(x.billed))}</td><td>${esc(m(x.received))}</td><td>${esc(m(x.billed - x.received))}</td></tr>`).join("")}</tbody></table></div></details>
    </section>
    <section class="rp-card" aria-labelledby="rpClientsH"><div class="rp-card-head"><h3 id="rpClientsH">Top clients</h3></div>
      ${top.length ? `<div class="rp-table-wrap"><table class="rp-table"><thead><tr><th scope="col">Client</th><th scope="col">Invoices</th><th scope="col">Billed</th><th scope="col">Outstanding</th></tr></thead><tbody>${top.map(([c, v]) => `<tr><th scope="row">${esc(c)}</th><td>${v.n}</td><td>${esc(m(v.billed))}</td><td>${esc(m(v.billed - v.paid))}</td></tr>`).join("")}</tbody></table></div>` : '<p class="hint">No invoices in this period.</p>'}
    </section>
    <p class="hint rp-note">Based on invoices in Saved invoices. Enter <strong>Amount paid</strong> on an invoice (and save it) to track what you've received. Estimates are not counted.</p>`;

  // Hover / focus tooltip
  const chart = body.querySelector(".rp-chart"), tip = $("rpTip");
  const show = g => {
    const t = g.querySelector("title").textContent.split(" — "), r = g.getBoundingClientRect(), cr = chart.getBoundingClientRect();
    tip.innerHTML = `<strong>${esc(t[0])}</strong><span>${esc(t[1]).replace(" · ", "<br>")}</span>`;
    tip.hidden = false;
    const x = Math.min(Math.max(r.left + r.width / 2 - cr.left, 70), cr.width - 70);
    tip.style.left = x + "px";
  };
  chart.querySelectorAll(".rp-bar").forEach(g => {
    g.addEventListener("mouseenter", () => show(g)); g.addEventListener("focus", () => show(g));
    g.addEventListener("mouseleave", () => tip.hidden = true); g.addEventListener("blur", () => tip.hidden = true);
  });
}

export function initReports() {
  $("reportPeriod").addEventListener("change", render);
  $("reportCurrency").addEventListener("change", render);
  window.addEventListener("invoicestudio:page", e => { if (e.detail === "reports") render(); });
}
