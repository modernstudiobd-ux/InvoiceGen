// brandTemplates.js — "Save as template" for reusing the same invoice setup
// (company info, logo, design, colors, columns, section toggles, labels,
// and boilerplate payment/terms text) across multiple companies or personal
// brands, kept separate from the per-invoice "Saved invoices" History.
//
// A brand template intentionally excludes anything invoice-specific — the
// client, line items, invoice number/status/dates/reference, and the
// discount/tax/shipping/notes values — the same split newInvoice() already
// draws between "company profile and design" (kept) and "this invoice"
// (cleared). Applying a template only overwrites the brand-identity fields,
// so it's safe to use mid-invoice without losing whatever client/items work
// is already on screen.

import { $, esc, uid, safeLogo } from "./dom.js";
import { state, fields, defaultColumns, defaultSections, defaultLabels, LEGACY_LABEL_MAP, getFieldVal, setFieldVal } from "./state.js";
import { normalizeLabels, syncDocTypeUI } from "./docType.js";
import { setAccent, applyAllOptionalColors } from "./accent.js";
import { renderToggles } from "./toggles.js";
import { renderPreview } from "./preview.js";
import { save } from "./persistence.js";
import { toast } from "./toast.js";
import { dateFmt } from "./format.js";
import { closeTemplatesPanel, setMobileView } from "./layout.js";
import { ICON_EDIT, ICON_TRASH } from "./icons.js";

export const BRAND_KEY = "invoiceStudio.brandTemplates.v1";

// Fields carried over as part of a company/brand's identity. Everything in
// `fields` (state.js) NOT listed here is invoice-specific and left alone —
// invoiceNumber, status, invoiceDate, dueDate, reference, all clientX
// fields, discount, tax, shipping, notes.
const BRAND_FIELD_IDS = fields.filter(id => ![
  "invoiceNumber", "status", "invoiceDate", "dueDate", "reference",
  "clientName", "clientContact", "clientTax", "clientAddress", "clientEmail",
  "discount", "tax", "shipping", "notes", "amountPaid", "watermark", "watermarkText", "tax2"
].includes(id));

export function loadBrandTemplates() {
  try { const v = JSON.parse(localStorage.getItem(BRAND_KEY)); return Array.isArray(v) ? v : []; }
  catch { return []; }
}

export function saveBrandTemplates(list) {
  try { localStorage.setItem(BRAND_KEY, JSON.stringify(list)); }
  catch { toast("Could not save the template locally — your browser's storage may be full (try a smaller logo)."); }
}

// Snapshot just the brand-identity slice of the current on-screen invoice.
function serializeBrand() {
  let f = {};
  BRAND_FIELD_IDS.forEach(id => f[id] = getFieldVal(id));
  return {
    fields: f,
    logo: state.logo,
    logoNatural: state.logoNatural,
    signature: state.signature,
    columns: state.columns,
    sections: state.sections
  };
}

export function saveCurrentAsTemplate() {
  const suggested = $("companyName").value.trim() || "Untitled brand";
  const name = prompt("Save as template — name this brand:", suggested);
  if (name == null) return; // cancelled
  const trimmed = name.trim();
  if (!trimmed) return toast("Template name can't be empty.");
  const list = loadBrandTemplates();
  const existing = list.find(t => t.name.toLowerCase() === trimmed.toLowerCase());
  if (existing && !confirm(`A template named "${trimmed}" already exists. Overwrite it with the current design?`)) return;
  const snapshot = serializeBrand();
  if (existing) {
    existing.snapshot = snapshot;
    existing.updatedAt = Date.now();
  } else {
    list.unshift({ id: uid(), name: trimmed, updatedAt: Date.now(), snapshot });
  }
  saveBrandTemplates(list);
  renderBrandTemplates();
  toast(`Saved "${trimmed}" as a template.`);
}

// Applies a saved brand template onto the current on-screen invoice —
// company/logo/design/columns/sections/labels/payment+terms boilerplate —
// without touching the client, items, or this invoice's own number/status/
// dates/reference/discount/tax/shipping/notes.
export function applyBrandTemplate(id) {
  const entry = loadBrandTemplates().find(t => t.id === id);
  if (!entry) return;
  const d = entry.snapshot || {};
  BRAND_FIELD_IDS.forEach(fid => { if (d.fields && fid in d.fields && typeof d.fields[fid] === "string") setFieldVal(fid, d.fields[fid]); });
  // Pre-3.15 templates kept labels in a separate top-level `labels` object.
  const legacyLabels = (d.labels && typeof d.labels === "object") ? d.labels : {};
  Object.entries(LEGACY_LABEL_MAP).forEach(([fid, legacyKey]) => {
    if (!BRAND_FIELD_IDS.includes(fid)) return;
    if (d.fields && typeof d.fields[fid] === "string") return;
    const legacyVal = typeof legacyLabels[legacyKey] === "string" ? legacyLabels[legacyKey] : defaultLabels()[legacyKey];
    $(fid).value = legacyVal || "";
  });
  state.logo = safeLogo(d.logo);
  if ("signature" in d) state.signature = safeLogo(d.signature);
  state.logoNatural = (d.logoNatural && typeof d.logoNatural.w === "number" && typeof d.logoNatural.h === "number") ? d.logoNatural : null;
  let cleanColumns = Array.isArray(d.columns) ? d.columns.filter(c => c && typeof c === "object" && typeof c.key === "string" && typeof c.label === "string").map(c => ({ id: typeof c.id === "string" ? c.id : uid(), key: c.key, label: c.label, type: ["text", "number", "currency", "percentage", "date"].includes(c.type) ? c.type : "text", width: Number.isFinite(Number(c.width)) ? Number(c.width) : 15, align: ["left", "right", "center"].includes(c.align) ? c.align : "left", visible: c.visible !== false, role: ["none", "quantity", "rate", "amount", "tax"].includes(c.role) ? c.role : "none" })) : [];
  state.columns = cleanColumns.length ? cleanColumns : defaultColumns();
  state.sections = { ...defaultSections(), ...(d.sections && typeof d.sections === "object" ? d.sections : {}) };
  setAccent($("accentHex").value);
  applyAllOptionalColors();
  // A template saved from an invoice carries invoice wording; keep default
  // labels matching the document type currently being edited (custom
  // wording is left alone).
  normalizeLabels(); syncDocTypeUI();
  renderPreview(); save();
  toast(`Loaded "${entry.name}" — client, items and invoice number are unchanged.`);
  // Same reasoning as openInvoiceById/duplicateInvoiceById in library.js:
  // applying a template changes the on-screen invoice, so switch mobile to
  // the "Invoice" view to actually show that change instead of leaving
  // someone on the Menu tab where the Templates panel was opened from.
  setMobileView("preview");
  closeTemplatesPanel();
}

export function renameBrandTemplate(id) {
  const list = loadBrandTemplates(), entry = list.find(t => t.id === id);
  if (!entry) return;
  const name = prompt("Rename this template:", entry.name);
  if (name == null) return;
  const trimmed = name.trim();
  if (!trimmed) return toast("Template name can't be empty.");
  entry.name = trimmed;
  entry.updatedAt = Date.now();
  saveBrandTemplates(list);
  renderBrandTemplates();
  toast("Renamed to " + trimmed + ".");
}

export function deleteBrandTemplate(id) {
  const list = loadBrandTemplates(), entry = list.find(t => t.id === id);
  if (!entry) return;
  if (!confirm(`Delete the "${entry.name}" template? This can't be undone.`)) return;
  saveBrandTemplates(list.filter(t => t.id !== id));
  renderBrandTemplates();
  toast("Deleted template.");
}

export function clearBrandTemplates() {
  if (!loadBrandTemplates().length) return toast("No templates to clear.");
  if (!confirm("Delete ALL brand templates? This can't be undone. (Your current on-screen invoice is not affected.)")) return;
  saveBrandTemplates([]);
  renderBrandTemplates();
  toast("Cleared all templates.");
}

export function renderBrandTemplates() {
  const root = $("templatesList"), countEl = $("templatesCount");
  if (!root) return;
  const list = loadBrandTemplates().slice().sort((a, b) => b.updatedAt - a.updatedAt);
  const clr = $("clearTemplatesBtn"); if (clr) clr.hidden = !list.length;
  if (countEl) countEl.textContent = list.length ? list.length + (list.length === 1 ? " template saved" : " templates saved") : "";
  if (!list.length) { root.innerHTML = '<div class="history-empty pg-empty"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M20 13V7a2 2 0 0 0-2-2h-6L3 14l7 7 9-9Z"/><circle cx="13" cy="9" r="1.3"/></svg><h3>No brand templates yet</h3><p class="hint">Set up your company details, logo, colors and design once, then save them here. Next time, apply the template in one click — client, items and invoice number stay as they are.</p></div>'; return; }
  const tplLabel = v => { const o = [...($("template") ? $("template").options : [])].find(x => x.value === v); return o ? o.textContent : ""; };
  root.innerHTML = list.map(e => {
    const f = (e.snapshot && e.snapshot.fields) || {}, logo = safeLogo(e.snapshot && e.snapshot.logo);
    const accent = /^#[0-9a-f]{3,8}$/i.test(f.accentHex || "") ? f.accentHex : "#18181b";
    const company = f.companyName || "", initial = (company.trim()[0] || e.name.trim()[0] || "B").toUpperCase();
    return `<article class="historycard pg-card pg-brand" data-id="${esc(e.id)}" aria-label="${esc(e.name)}">
   <div class="pg-brand-head"><span class="pg-brand-logo" style="--b:${esc(accent)}">${logo ? `<img src="${esc(logo)}" alt="">` : esc(initial)}</span>
     <div class="pg-card-title"><strong>${esc(e.name)}</strong><span class="${company ? "" : "pg-muted"}">${esc(company || "No company name")}</span></div></div>
   <div class="pg-brand-meta"><span class="pg-swatch" style="background:${esc(accent)}" title="Accent color ${esc(accent)}"></span><span>${esc(tplLabel(f.template) || "Design")}</span><span aria-hidden="true">·</span><span>Updated ${esc(dateFmt(e.updatedAt))}</span></div>
   <div class="historyactions pg-actions"><button class="btn small primary" data-act="apply" type="button">Use this template</button><button class="btn small icon" data-act="rename" type="button" title="Rename" aria-label="Rename ${esc(e.name)}">${ICON_EDIT}</button><button class="btn small icon danger" data-act="delete" type="button" title="Delete" aria-label="Delete ${esc(e.name)}">${ICON_TRASH}</button></div>
 </article>`; }).join("");
  root.querySelectorAll(".historycard").forEach(card => {
    const id = card.dataset.id;
    card.querySelector('[data-act="apply"]').onclick = () => applyBrandTemplate(id);
    card.querySelector('[data-act="rename"]').onclick = () => renameBrandTemplate(id);
    card.querySelector('[data-act="delete"]').onclick = () => deleteBrandTemplate(id);
  });
}
