// docType.js — Invoice / Estimate / Receipt switching (sidebar → Billing).
//
// All templates share one set of label fields, so switching document type
// only swaps a handful of label strings (title, "Bill to", the two date row
// labels, the balance label), the footer noun and the default number prefix.
// Nothing about layout, styling, line items or calculations changes.
//
// A label field's default wording lives in its *placeholder* (the field is
// left empty) — that is how the templates already render "INVOICE", "BILL TO"
// etc., in the placeholder colour the design uses, in Edit, Preview and Print
// alike. Switching type therefore changes the placeholders and keeps the
// fields empty, so each template looks exactly as it does today. A label the
// person has typed themselves is never overwritten.

import { $ } from "./dom.js";
import { state, DOC_TYPES, sectionDefs } from "./state.js";
import { renderToggles } from "./toggles.js";
import { renderPreview } from "./preview.js";
import { save } from "./persistence.js";

const PLACEHOLDER_IDS = Object.keys(DOC_TYPES.invoice.labels);
const isType = t => Object.prototype.hasOwnProperty.call(DOC_TYPES, t);

// Section-toggle names in the Design panel mirror the on-canvas labels.
const TOGGLE_KEYS = { invoiceDate: "labelInvoiceDate", dueDate: "labelDueDate", balance: "labelBalance" };

// Everything that merely *reflects* the current type: nav highlight, mobile
// title, label placeholders, Design-panel toggle names. Safe to call any time
// (including after load()); does not touch label values or save.
export function syncDocTypeUI() {
  const type = isType(state.docType) ? state.docType : "invoice";
  const cfg = DOC_TYPES[type];
  document.querySelectorAll("[data-doctype]").forEach(btn => {
    const on = btn.dataset.doctype === type;
    if (on) btn.setAttribute("aria-current", "page"); else btn.removeAttribute("aria-current");
    btn.classList.toggle("active", on);
  });
  const title = document.querySelector(".mobileview-title");
  if (title) { if (document.body.classList.contains("page-open")) title.dataset.docNoun = cfg.noun; else title.textContent = cfg.noun; }
  PLACEHOLDER_IDS.forEach(id => { const el = $(id); if (el) el.placeholder = cfg.labels[id]; });
  sectionDefs.forEach(def => {
    if (TOGGLE_KEYS[def[0]]) def[1] = cfg.labels[TOGGLE_KEYS[def[0]]];
    if (def[0] === "status") def[1] = cfg.noun + " status";
  });
  renderToggles();
}

// Clear any label field that merely holds some type's default wording (e.g.
// a value copied in from a saved file or Brand Template), so the current
// type's placeholder default shows instead. Custom wording is left alone.
export function normalizeLabels() {
  PLACEHOLDER_IDS.forEach(id => {
    const el = $(id); if (!el) return;
    const cur = el.value.trim();
    if (cur && Object.values(DOC_TYPES).some(t => t.labels[id] === cur)) el.value = "";
  });
}

export function setDocType(type) {
  if (!isType(type) || type === state.docType) { syncDocTypeUI(); return false; }
  const prev = DOC_TYPES[state.docType] || DOC_TYPES.invoice, next = DOC_TYPES[type];
  // Fields holding the previous type's default wording go back to empty;
  // syncDocTypeUI() below points their placeholders at the new type.
  normalizeLabels();
  // Document number: only re-prefix an untouched default-style number
  // (INV-1001 → EST-1001); anything custom is left exactly as typed.
  const num = $("invoiceNumber");
  if (num) {
    const m = new RegExp("^" + prev.prefix + "-(.+)$", "i").exec(num.value.trim());
    if (m) num.value = next.prefix + "-" + m[1];
  }
  state.docType = type;
  syncDocTypeUI();
  renderPreview();
  save();
  return true;
}
