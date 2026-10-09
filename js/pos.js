// pos.js — POS / thermal receipt printing (58 mm or 80 mm roll paper).
// Builds a compact, black-only receipt from the current document and prints
// it with a page exactly as tall as the receipt, so thermal printers cut in
// the right place. Shown for Receipts (and available from the dialog for any
// document type via the same button when switched to Receipt).

import { $, esc, safeLogo } from "./dom.js";
import { state, applyPaperSize } from "./state.js";
import { money, dateFmt } from "./format.js";
import { calc, itemValue, roleCol } from "./calc.js";
import { tr } from "./i18n.js";
import { normalizeUrl } from "./features.js";
import qrcode from "./vendor/qrcode.js";

const PREF = "invoiceStudio.pos.v1";
const safe = fn => { try { return fn(); } catch { return null; } };
let prefs = Object.assign({ w: 80, logo: true, qr: false, client: true }, safe(() => JSON.parse(localStorage.getItem(PREF))) || {});
const savePrefs = () => safe(() => localStorage.setItem(PREF, JSON.stringify(prefs)));
const v = id => (($(id) && $(id).value) || "").trim();

function qrImg(text) {
  const q = qrcode(0, "M"); q.addData(text); q.make();
  const n = q.getModuleCount(); let d = "";
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c + 1} ${r + 1}h1v1h-1z`;
  return `<svg viewBox="0 0 ${n + 2} ${n + 2}" shape-rendering="crispEdges"><path d="${d}" fill="#000"/></svg>`;
}

export function buildReceipt() {
  const L = ($("docLanguage") && $("docLanguage").value) || "en", doc = state.docType || "invoice";
  const t = calc(), line = '<div class="pr-rule"></div>';
  const desc = state.columns.find(c => c.key === "description") || state.columns.find(c => c.visible && c.role === "none" && c.type === "text");
  const q = roleCol("quantity"), r = roleCol("rate"), a = roleCol("amount");
  const items = state.items.filter(i => desc ? String(i[desc.key] ?? "").trim() || (a && Number(itemValue(i, a))) : true).map(i => {
    const name = desc ? String(i[desc.key] ?? "").trim() : "";
    const qty = q ? (String(i[q.key] ?? "").trim() || "1") : "1";
    const amt = a ? money(itemValue(i, a)) : "";
    const rate = r ? money(i[r.key]) : "";
    return `<div class="pr-item"><div class="pr-name">${esc(name || "—")}</div><div class="pr-row"><span>${esc(qty)} × ${esc(rate)}</span><b>${esc(amt)}</b></div></div>`;
  }).join("");
  const row = (label, value, cls = "") => `<div class="pr-row ${cls}"><span>${esc(label)}</span><b>${esc(value)}</b></div>`;
  const taxLab = v("labelTax") || tr(L, "tax"), tax2Lab = v("labelTax2") || "Tax 2";
  const now = new Date(), time = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const company = v("companyName"), addr = v("companyAddress").split("\n").map(esc).join("<br>");
  const contact = [v("companyPhone"), v("companyEmail"), v("companyWebsite")].filter(Boolean).map(esc).join("<br>");
  const vat = [v("companyVat"), v("companyReg")].filter(Boolean).map(esc).join(" · ");
  const client = [v("clientName"), v("clientContact")].filter(Boolean).join(" · ");
  const link = normalizeUrl(v("payLink"));
  const logo = prefs.logo && state.logo ? `<img class="pr-logo" src="${esc(safeLogo(state.logo))}" alt="">` : "";
  return `<div class="pr pr-${prefs.w}">
    ${logo}
    ${company ? `<div class="pr-co">${esc(company)}</div>` : ""}
    ${addr ? `<div class="pr-c">${addr}</div>` : ""}${contact ? `<div class="pr-c">${contact}</div>` : ""}${vat ? `<div class="pr-c">${vat}</div>` : ""}
    ${line}
    <div class="pr-title">${esc(v("labelTitle") || tr(L, "title", doc))}</div>
    ${row("#", v("invoiceNumber"))}
    ${row(v("labelInvoiceDate") || tr(L, "date", doc), (v("invoiceDate") ? dateFmt(v("invoiceDate")) : dateFmt(now)) + " " + time)}
    ${prefs.client && client ? row(v("labelBillTo") || tr(L, "bill", doc), client) : ""}
    ${line}${items || '<div class="pr-c">—</div>'}${line}
    ${row(tr(L, "subtotal"), money(t.subtotal))}
    ${t.disc ? row(`${tr(L, "discount")} ${t.dr}%`, "−" + money(t.disc)) : ""}
    ${t.tax ? row(`${taxLab} ${t.tr}%`, money(t.tax)) : ""}
    ${t.tax2 ? row(`${tax2Lab} ${t.tr2}%`, money(t.tax2)) : ""}
    ${t.itemTax ? row(tr(L, "itemTax"), money(t.itemTax)) : ""}
    ${t.ship ? row(tr(L, "shipping"), money(t.ship)) : ""}
    ${row(tr(L, "total"), money(t.total), "pr-total")}
    ${t.paid ? row(v("labelPaid") || tr(L, "paid"), money(t.paid)) + row(tr(L, "balanceRow"), money(t.balance), "pr-strong") : ""}
    ${line}
    ${prefs.qr && link ? `<div class="pr-qr">${qrImg(link)}<div class="pr-c">${esc(tr(L, "scan"))}</div></div>` : ""}
    ${v("notes") ? `<div class="pr-c pr-note">${esc(v("notes"))}</div>` : ""}
    <div class="pr-c pr-thanks">${esc(v("footerText") || "Thank you!")}</div>
  </div>`;
}

function syncDialog() {
  $("posWidthSeg").querySelectorAll("[data-w]").forEach(b => b.setAttribute("aria-checked", String(Number(b.dataset.w) === prefs.w)));
  $("posLogo").checked = prefs.logo; $("posQr").checked = prefs.qr; $("posClient").checked = prefs.client;
  $("posQr").closest("label").hidden = !normalizeUrl(v("payLink"));
  $("posPreview").innerHTML = buildReceipt();
}

export function printPos() {
  const host = $("posReceipt");
  host.innerHTML = buildReceipt();
  document.body.classList.add("pos-print");
  // Page = exactly the receipt's height, so the printer cuts right after it.
  host.style.cssText = `display:block;position:fixed;left:-10000px;top:0;width:${prefs.w}mm`;
  const hMm = Math.ceil(host.getBoundingClientRect().height * 25.4 / 96) + 4;
  host.style.cssText = `width:${prefs.w}mm`;
  $("pageSizeCSS").textContent = `@page{size:${prefs.w}mm ${hMm}mm;margin:0}`;
  let done = false;
  const restore = () => { if (done) return; done = true; document.body.classList.remove("pos-print"); host.innerHTML = ""; host.style.cssText = ""; applyPaperSize(); window.removeEventListener("afterprint", restore); };
  window.addEventListener("afterprint", restore);
  const imgs = [...host.querySelectorAll("img")].map(i => i.complete ? null : new Promise(r => { i.onload = i.onerror = r; })).filter(Boolean);
  Promise.race([Promise.all(imgs), new Promise(r => setTimeout(r, 1500))]).then(() => requestAnimationFrame(() => setTimeout(() => {
    window.print();
    setTimeout(restore, 30000);
    window.addEventListener("focus", () => setTimeout(restore, 300), { once: true });
  }, 60)));
}

export function syncPosButton() { const b = $("posBtn"); if (b) b.hidden = (state.docType || "invoice") !== "receipt"; }

export function initPos() {
  const d = $("posDialog");
  $("posBtn").addEventListener("click", () => { syncDialog(); d.showModal(); $("posPrintBtn").focus(); });
  $("posWidthSeg").addEventListener("click", e => { const b = e.target.closest("[data-w]"); if (!b) return; prefs.w = Number(b.dataset.w); savePrefs(); syncDialog(); });
  [["posLogo", "logo"], ["posQr", "qr"], ["posClient", "client"]].forEach(([id, k]) => $(id).addEventListener("change", () => { prefs[k] = $(id).checked; savePrefs(); syncDialog(); }));
  $("posPrintBtn").addEventListener("click", () => { d.close(); printPos(); });
  d.addEventListener("click", e => { if (e.target === d || e.target.closest("[data-close]")) d.close(); });
  document.querySelectorAll("[data-doctype]").forEach(b => b.addEventListener("click", () => setTimeout(syncPosButton, 0)));
  window.addEventListener("invoicestudio:loaded", syncPosButton);
  syncPosButton();
}
