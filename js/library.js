// library.js — the multi-invoice "Saved invoices" (History) list: save/open/
// duplicate/delete named snapshots, kept separate from the undo/redo stack.

import { $, esc, uid } from "./dom.js";
import { state, serialize } from "./state.js";
import { moneyFor, today, plusDays, dateFmt } from "./format.js";
import { calc } from "./calc.js";
import { toast } from "./toast.js";
import { load } from "./invoiceData.js";
import { renderPreview } from "./preview.js";

import { save } from "./persistence.js";
import { setMobileView, closeHistoryPanel } from "./layout.js";

export const LIBRARY_KEY = "invoiceStudio.library.v1", CURRENT_ID_KEY = "invoiceStudio.currentId.v1";

export function loadLibrary() {
  try { const v = JSON.parse(localStorage.getItem(LIBRARY_KEY)); return Array.isArray(v) ? v : []; }
  catch { return []; }
}

// Returns true only if the write actually reached localStorage. Callers must
// check it: a full browser store (every saved invoice embeds its logo, and
// logos up to 3 MB are accepted) makes setItem throw, and the old version
// swallowed that and let callers announce "Saved" for an invoice that was
// never stored.
export function saveLibrary(lib) {
  try { localStorage.setItem(LIBRARY_KEY, JSON.stringify(lib)); return true; }
  catch {
    toast("Not saved — browser storage is full. Use a smaller logo or delete saved invoices you no longer need.");
    return false;
  }
}

export function getCurrentId() {
  return localStorage.getItem(CURRENT_ID_KEY) || "";
}

export function setCurrentId(id) {
  try { localStorage.setItem(CURRENT_ID_KEY, id); } catch {}
}

export function nextInvoiceNumber() {
  const pool = loadLibrary().map(e => e.invoiceNumber).concat([$("invoiceNumber") ? $("invoiceNumber").value : ""]);
  let best = null;
  pool.forEach(v => { const m = /^(.*?)(\d+)\s*$/.exec(String(v || "").trim()); if (m) { const n = parseInt(m[2], 10); if (!isNaN(n) && (!best || n > best.n)) best = { prefix: m[1], n, digits: m[2].length }; } });
  return best ? best.prefix + String(best.n + 1).padStart(best.digits, "0") : "INV-1001";
}

// Saves (or updates) the current invoice's record in the library, keyed by
// the current invoice id so re-saving an opened invoice updates that same
// record instead of adding another. Returns true only if it was really
// stored; on failure the library is left exactly as it was and the reason
// has already been shown (see saveLibrary).
export function saveToHistory() {
  try {
    const snap = serialize();
    let id = getCurrentId();
    if (!id) { id = uid(); setCurrentId(id); }
    const lib = loadLibrary();
    const meta = { id, invoiceNumber: $("invoiceNumber").value || "Untitled", clientName: $("clientName").value || "", status: $("status").value, currency: $("currency").value, total: calc().total, updatedAt: Date.now(), snapshot: snap };
    const idx = lib.findIndex(x => x.id === id);
    if (idx >= 0) lib[idx] = meta; else lib.unshift(meta);
    if (!saveLibrary(lib)) return false;
    renderHistory();
    return true;
  } catch (err) {
    console.warn("saveToHistory failed:", err);
    toast("Could not save this invoice.");
    return false;
  }
}

export function renderHistory() {
  const root = $("historyList"), countEl = $("historyCount");
  if (!root) return;
  const all = loadLibrary().slice().sort((a, b) => b.updatedAt - a.updatedAt);
  const curId = getCurrentId();
  // Search (client name / invoice number) + status chip — display filtering only.
  const q = ($("historySearch") ? $("historySearch").value : "").trim().toLowerCase();
  const st = (document.querySelector("#historyChips .chip.active") || {}).dataset?.status || "";
  const filtering = !!(q || st);
  const lib = all.filter(e => (!q || `${e.invoiceNumber || ""} ${e.clientName || ""}`.toLowerCase().includes(q)) && (!st || (e.status || "Draft") === st));
  if (countEl) countEl.textContent = all.length ? (filtering ? `${lib.length} of ${all.length} shown` : all.length + (all.length === 1 ? " invoice saved" : " invoices saved")) : "";
  if (!all.length) { root.innerHTML = '<div class="history-empty"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg><p class="hint">No saved invoices yet.</p><button class="btn small primary" type="button" data-first-save>Save this invoice</button></div>'; const fb = root.querySelector("[data-first-save]"); if (fb) fb.onclick = () => { const sb = $("saveInvoiceBtn"); if (sb) sb.click(); }; return; }
  if (!lib.length) { root.innerHTML = '<p class="hint">No saved invoices match your search.</p>'; return; }
  root.innerHTML = lib.map(e => `<div class="historycard${e.id === curId ? " current" : ""}" data-id="${esc(e.id)}">
   <div class="historytop"><div><strong>${esc(e.invoiceNumber || "Untitled")}</strong>${e.id === curId ? '<span class="tinybadge">Current</span>' : ""}</div><span class="historyamount">${esc(moneyFor(e.total, e.currency))}</span></div>
   <div class="historymeta"><span>${esc(e.clientName || "No client")} · ${esc(e.status || "Draft")}</span><span>${esc(dateFmt(e.updatedAt))}</span></div>
   <div class="historyactions"><button class="btn small" data-act="open" type="button">Open</button><button class="btn small" data-act="rename" type="button">Rename</button><button class="btn small" data-act="duplicate" type="button">Duplicate</button><button class="btn small danger" data-act="delete" type="button">Delete</button></div>
 </div>`).join("");
  root.querySelectorAll(".historycard").forEach(card => {
    const id = card.dataset.id;
    card.querySelector('[data-act="open"]').onclick = () => openInvoiceById(id);
    card.querySelector('[data-act="rename"]').onclick = () => renameInvoiceById(id);
    card.querySelector('[data-act="duplicate"]').onclick = () => duplicateInvoiceById(id);
    card.querySelector('[data-act="delete"]').onclick = () => deleteInvoiceById(id);
  });
}

export function openInvoiceById(id) {
  const entry = loadLibrary().find(x => x.id === id);
  if (!entry) return;
  try { load(entry.snapshot); }
  catch (err) { console.warn("Could not open saved invoice:", err); return toast("This saved invoice couldn't be opened — its data is damaged."); }
  setCurrentId(id);
  renderHistory();
  // Show the actual invoice that was just opened, not the nav sidebar —
  // "edit" here means the mobile *sidebar/menu* view (see setMobileView in
  // js/layout.js), which is a different "edit" than the canvas's own Edit/
  // Preview switch. Calling it after loading an invoice used to land the
  // person back on the menu they opened History from, with no visible
  // change on screen until they manually switched to the "Invoice" tab —
  // exactly the kind of extra, unnecessary navigation step this should
  // never require.
  setMobileView("preview");
  closeHistoryPanel();
  toast("Opened " + (entry.invoiceNumber || "invoice") + ".");
}

export function deleteInvoiceById(id) {
  const lib = loadLibrary(), entry = lib.find(x => x.id === id);
  if (!entry) return;
  if (!confirm(`Delete "${entry.invoiceNumber || "this invoice"}" from Saved Invoices? This can't be undone.`)) return;
  saveLibrary(lib.filter(x => x.id !== id));
  renderHistory();
  toast("Deleted from history.");
}

export function renameInvoiceById(id) {
  const lib = loadLibrary(), entry = lib.find(x => x.id === id);
  if (!entry) return;
  const name = prompt("Rename this saved invoice:", entry.invoiceNumber || "Untitled");
  if (name == null) return; // cancelled
  const trimmed = name.trim();
  if (!trimmed) return toast("Invoice name can't be empty.");
  entry.invoiceNumber = trimmed;
  entry.updatedAt = Date.now();
  if (entry.snapshot && entry.snapshot.fields) entry.snapshot.fields.invoiceNumber = trimmed;
  saveLibrary(lib);
  // If this is the invoice currently open on screen, reflect the new name immediately too.
  if (id === getCurrentId()) { $("invoiceNumber").value = trimmed; renderPreview(); save(); }
  renderHistory();
  toast("Renamed to " + trimmed + ".");
}

export function clearLibrary() {
  if (!loadLibrary().length) return toast("No saved invoices to clear.");
  if (!confirm("Delete ALL saved invoices? This can't be undone. (Your current on-screen draft is not affected.)")) return;
  saveLibrary([]);
  renderHistory();
  toast("Cleared all saved invoices.");
}

export function duplicateCurrentInvoice() {
  setCurrentId(uid());
  $("invoiceNumber").value = nextInvoiceNumber();
  $("invoiceDate").value = today();
  $("dueDate").value = plusDays(today(), 14);
  renderPreview(); save();
  if (saveToHistory()) toast("Duplicated as " + $("invoiceNumber").value + ".");
}

export function duplicateInvoiceById(id) {
  const entry = loadLibrary().find(x => x.id === id);
  if (!entry) return;
  load(entry.snapshot);
  duplicateCurrentInvoice();
  // Same reasoning as openInvoiceById above: show the result, not the menu
  // it was triggered from.
  setMobileView("preview");
  closeHistoryPanel();
}

export function newInvoice() {
  if (!confirm("Start a new document? This clears the client and items from your current draft (company info and design stay). Save first if you want to keep this draft in Saved Invoices.")) return;
  setCurrentId(uid());
  $("invoiceNumber").value = nextInvoiceNumber();
  $("status").value = "Draft";
  $("invoiceDate").value = today();
  $("dueDate").value = plusDays(today(), 14);
  $("reference").value = "";
  ["clientName", "clientContact", "clientTax", "clientAddress", "clientEmail"].forEach(id => $(id).value = "");
  $("discount").value = "0"; $("tax").value = "0"; $("shipping").value = "0";
  $("notes").value = "";
  state.items = [];
  renderPreview(); save();
  renderHistory();
  toast("New document started — " + $("invoiceNumber").value);
}

// "Reset Fields" (top action bar): clears ONLY what was entered on this
// document — company and client details, reference, dates, status, number,
// discount/tax/shipping, notes, payment details, terms and the line items —
// back to the app's starting values. It deliberately leaves everything else alone:
// app settings (paper-size/date-format/theme preferences), template, colors,
// logo, currency, field labels, columns, section toggles, the document type,
// Saved Invoices and Brand Templates. (The full wipe is "Full reset" in
// Settings → Danger zone; see fullReset() in js/main.js.) Goes through the
// normal save() path, so it is also undoable with Undo.
// Fields restored to the app's own starting values — read straight from the
// HTML defaults (defaultValue / the originally-selected option), so this can
// never drift from what a brand-new document starts with. The number and the
// two dates are seeded dynamically at startup, so they're handled below.
const CONTENT_FIELDS = ["status", "reference", "companyName", "companyReg", "companyVat", "companyAddress", "companyPhone", "companyEmail", "companyWebsite",
  "clientName", "clientContact", "clientTax", "clientAddress", "clientEmail", "discount", "tax", "shipping", "notes", "paymentDetails", "terms"];
function restoreHtmlDefault(el) {
  if (el.tagName === "SELECT") { const o = [...el.options].find(x => x.defaultSelected) || el.options[0]; if (o) el.value = o.value; }
  else el.value = el.defaultValue;
}
export function resetAllFields() {
  if (!confirm("Reset all fields? This clears everything you entered on this document — company and client details, line items, notes, dates and totals.\n\nYour settings, template, colors, logo and Saved Invoices are NOT changed. You can Undo this.")) return;
  setCurrentId(uid());   // a blank document must not overwrite the saved invoice that was open
  CONTENT_FIELDS.forEach(id => restoreHtmlDefault($(id)));
  $("invoiceNumber").value = nextInvoiceNumber();
  $("invoiceDate").value = today();
  $("dueDate").value = plusDays(today(), 14);
  state.items = [];
  renderPreview(); save();
  renderHistory();
  toast("All fields reset.");
}
