// formEditor.js — "Form" editing mode: a clean, form-style editor (company,
// client, details, line items, totals, notes) next to a live preview of the
// invoice. It owns NO data of its own: every field mirrors an existing
// invoice input by id (typing here sets that input and fires its normal
// "input" event), and line items edit state.items directly the same way the
// canvas table does. So saving, undo/redo, totals, Preview, Print and PDF
// all behave exactly as before.

import { $, esc } from "./dom.js";
import { state, sectionDefs } from "./state.js";
import { itemValue } from "./calc.js";
import { num, fmtCell, CURRENCY_SYMBOLS } from "./format.js";
import { initColumnsDialog, openColumnsDialog, syncColumnsDialog } from "./columnDialog.js";
import { openPicker, saveCurrentClient } from "./catalog.js";

let api = null;          // { addItem, renderPreview, save, refreshItemRowAndTotals }
let built = false;
let itemsSig = "";
const binds = [];        // { src, el, section, wrap, labelFrom }

/* [id, label, kind, section, extra] — kind: text | email | tel | url | date | area | select | num */
const GROUPS = [
  ["Details", [
    ["invoiceNumber", "Number", "text", null], ["status", "Status", "select", "status"],
    ["invoiceDate", "Issue date", "date", "invoiceDate", "", "labelInvoiceDate"], ["dueDate", "Due date", "date", "dueDate", "", "labelDueDate"],
    ["paymentTerms", "Payment terms", "select", "payTerms"],
    ["reference", "Reference / PO", "text", "reference", "full", "labelReference"]]],
  ["Client", [
    ["clientName", "Client name", "text", "client"], ["clientEmail", "Client email", "email", "client"],
    ["clientContact", "Contact name", "text", "client"], ["clientTax", "VAT / Tax number", "text", "client"],
    ["clientAddress", "Address", "area", "client", "full"]]],
  ["ITEMS", []],
  ["COLUMNS", []],
  ["Totals", [
    ["discount", "Discount %", "num", "discount"], ["tax", "Tax %", "num", "tax"], ["shipping", "Shipping", "num", "shipping"],
    ["labelTax", "Tax name (e.g. VAT, GST)", "text", "tax"], ["tax2", "Second tax %", "num", "tax2"], ["amountPaid", "Amount already paid", "num", "amountPaid"]]],
  ["Notes & terms", [
    ["notes", "Notes", "area", "notes", "full"], ["paymentDetails", "Payment details", "area", "payment", "full"],
    ["terms", "Terms", "area", "terms", "full"], ["notesAlign", "Notes alignment", "select", "notes"],
    ["payProvider", "Online payment provider", "select", "payQr"], ["payLink", "Online payment link (shows a QR code)", "url", "payQr"]]],
  ["Your company", [
    ["companyName", "Company name", "text", "company", "full"], ["companyEmail", "Email", "email", "company"],
    ["companyPhone", "Phone", "tel", "company"], ["companyWebsite", "Website", "url", "company"],
    ["companyReg", "Registration number", "text", "company"], ["companyVat", "VAT / Tax number", "text", "company"],
    ["companyAddress", "Address", "area", "company", "full"], ["footerText", "Footer text", "text", "footer", "full"]]],
  ["LOGO", []],
  ["SIGN", [["signName", "Name or title under the signature", "text", "signature", "full"]]],
  ["DESIGN", []],
  ["LABELS", [
    ["labelTitle", "Document title", "text", null], ["labelBillTo", "Client heading", "text", "client"],
    ["labelInvoiceDate", "Issue date label", "text", "invoiceDate"], ["labelDueDate", "Due date label", "text", "dueDate"],
    ["labelReference", "Reference label", "text", "reference"], ["labelBalance", "Balance label", "text", "balance"],
    ["labelNote", "Notes heading", "text", "notes"], ["labelPayment", "Payment heading", "text", "payment"],
    ["labelTerms", "Terms heading", "text", "terms"]]]
];
const PROFILE = new Set(["Your company", "LOGO", "SIGN", "DESIGN", "LABELS"]);
const NAV = [["Details", "feSecDetails"], ["Client", "feSecClient"], ["Items", "feItemsSec"], ["Totals", "feSecTotals"], ["Notes", "feSecNotes"], ["Business", "feProfile"]];
const PH = {
  clientName: "e.g. Acme Ltd", clientEmail: "billing@acme.com", clientContact: "e.g. Jane Smith", clientTax: "e.g. GB123456789",
  clientAddress: "Street, city, postcode", companyName: "e.g. Your Studio", companyEmail: "hello@yourstudio.com",
  companyPhone: "+1 555 123 4567", companyWebsite: "https://yourstudio.com", invoiceNumber: "e.g. INV-0001",
  reference: "e.g. PO-1234", notes: "e.g. Thank you for your business", discount: "0", tax: "0", shipping: "0.00",
  tax2: "0", amountPaid: "0.00", labelTax: "Tax", payLink: "https://paypal.me/yourname", footerText: "e.g. www.yourstudio.com · Thank you!", signName: "e.g. Jane Smith, Director"
};
const AC = { companyName: "organization", companyEmail: "email", companyPhone: "tel", companyWebsite: "url", companyAddress: "street-address" };
const SECID = { Details: "feSecDetails", Client: "feSecClient", Totals: "feSecTotals", "Notes & terms": "feSecNotes" };
const REQ_HINT = { clientName: "Needed before printing" };
const isEmail = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

function fieldEl(def) {
  const [id, label, kind, section, extra, labelFrom] = def;
  const src = $(id); if (!src) return null;
  const wrap = document.createElement("div");
  wrap.className = "fe-field" + (extra === "full" ? " fe-full" : "");
  const lab = document.createElement("label"); lab.htmlFor = "fe_" + id; lab.textContent = label;
  let el;
  if (kind === "area") { el = document.createElement("textarea"); el.rows = 3; }
  else if (kind === "select") {
    el = document.createElement("select");
    el.innerHTML = [...src.options].map(o => `<option value="${esc(o.value)}">${esc(o.textContent)}</option>`).join("");
  } else {
    el = document.createElement("input");
    el.type = kind === "num" ? "text" : kind === "date" ? "date" : kind;
    if (kind === "num") { el.inputMode = "decimal"; el.autocomplete = "off"; }
    el.autocomplete = kind === "num" ? "off" : (AC[id] || "off");
    if (kind !== "date" && kind !== "num") el.enterKeyHint = "next";
    if (kind === "num") el.enterKeyHint = "next";
  }
  if (PH[id]) el.placeholder = PH[id];
  el.id = "fe_" + id; el.className = "fe-input" + (kind === "num" ? " fe-num" : "");
  const evt = kind === "select" ? "change" : "input";
  el.addEventListener(evt, () => {
    src.value = el.value;
    src.dispatchEvent(new Event(evt, { bubbles: true }));
    if (kind === "select") src.dispatchEvent(new Event("input", { bubbles: true }));
  });
  let box = el;
  if (kind === "num") {
    const sym = id === "shipping" || id === "amountPaid" ? null : "%";
    box = document.createElement("div"); box.className = "fe-affix" + (sym ? " fe-suffix" : " fe-prefix");
    const a = document.createElement("span"); a.className = "fe-aff"; a.setAttribute("aria-hidden", "true");
    if (sym) a.textContent = sym; else a.dataset.cur = "1";
    if (sym) box.append(el, a); else box.append(a, el);
  }
  wrap.append(lab, box);
  if (id === "clientName" || id === "clientEmail" || id === "companyEmail") {
    const hint = document.createElement("p"); hint.className = "fe-err"; hint.id = "fe_err_" + id; hint.hidden = true; hint.setAttribute("role", "alert");
    el.setAttribute("aria-describedby", hint.id); wrap.append(hint);
    const check = () => {
      const v = el.value.trim(); let m = "";
      if (id === "clientName" && !v) m = REQ_HINT.clientName;
      else if (id !== "clientName" && v && !isEmail(v)) m = "Check the email address";
      hint.textContent = m; hint.hidden = !m; el.classList.toggle("fe-bad", !!m); el.setAttribute("aria-invalid", m ? "true" : "false");
    };
    el.addEventListener("blur", check);
    el.addEventListener("input", () => { if (!hint.hidden) check(); });
  }
  binds.push({ src, el, section, wrap, lab, label, labelFrom });
  return wrap;
}

function build() {
  const root = $("formEditor"); if (!root || built) return;
  built = true;
  root.innerHTML = "";
  const nav = document.createElement("nav"); nav.className = "fe-nav"; nav.setAttribute("aria-label", "Jump to section");
  nav.innerHTML = NAV.map(([t, id]) => `<button type="button" data-go="${id}">${t}</button>`).join("");
  root.appendChild(nav);
  const prof = document.createElement("details"); prof.className = "fe-details fe-profile"; prof.id = "feProfile";
  prof.innerHTML = '<summary><span>Business profile &amp; design</span><small id="feProfileSum"></small></summary><p class="fe-hint">Your company details, logo, template, colors and labels. Usually set once.</p><div class="fe-profile-body"></div>';
  const profBody = prof.querySelector(".fe-profile-body");
  GROUPS.forEach(([title, defs]) => {
    const sec = document.createElement("section"); sec.className = "fe-sec";
    if (SECID[title]) sec.id = SECID[title];
    if (title === "LOGO") {
      sec.innerHTML = '<h2>Logo</h2><div class="fe-logo"><div class="fe-logo-thumb" id="feLogoThumb"><img alt="" id="feLogoImg" hidden><span id="feLogoLetter">Y</span></div><div class="fe-logo-actions"><label class="btn small primary" for="feLogoFile">Upload logo</label><input id="feLogoFile" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" class="visually-hidden"><button type="button" class="btn small" id="feLogoRemove">Remove</button><button type="button" class="btn small" id="feLogoReset">Reset size</button></div></div>' +
        '<div class="fe-grid"><div class="fe-field fe-full"><label for="fe_logoHeight">Size</label><div class="fe-wrow fe-logo-size"><input class="fe-range" id="fe_logoHeight" type="range" min="24" max="160" step="1" aria-describedby="feLogoSizeHint"><span class="fe-affix fe-suffix"><input class="fe-input fe-num" id="fe_logoHeightValue" type="text" inputmode="numeric" autocomplete="off" aria-label="Logo height in pixels"><span class="fe-aff" aria-hidden="true">px</span></span></div><p class="fe-hint" id="feLogoSizeHint">Drag to resize. Proportions stay locked.</p></div>' +
        '<div class="fe-field"><span class="fe-lab">Position</span><div class="fe-seg" id="feLogoPos" role="group" aria-label="Logo position"><button type="button" data-pos="">Auto</button><button type="button" data-pos="left">Left</button><button type="button" data-pos="above">Above</button></div></div></div>';
    } else if (title === "SIGN") {
      sec.innerHTML = '<h2>Signature or stamp</h2><div class="fe-logo"><div class="fe-logo-thumb fe-sign-thumb" id="feSignThumb"></div><div class="fe-logo-actions"><button type="button" class="btn small primary" id="feSignUpload">Upload signature or stamp</button><button type="button" class="btn small" id="feSignRemove">Remove</button></div></div><div class="fe-grid"></div>';
      const grid = sec.querySelector(".fe-grid");
      defs.forEach(d => { const f = fieldEl(d); if (f) grid.appendChild(f); });
    } else if (title === "COLUMNS") {
      return;   // column + import tools live in the Line items toolbar (see ITEMS)
    } else if (title === "DESIGN") {
      buildDesign(sec);
    } else if (title === "LABELS") {
      sec.innerHTML = '<details class="fe-details"><summary>Labels &amp; headings</summary><p class="fe-hint">Rename the headings printed on the document. Leave blank for the default.</p><div class="fe-grid"></div></details>';
      const grid = sec.querySelector(".fe-grid");
      defs.forEach(d => { const f = fieldEl(d); if (f) grid.appendChild(f); });
    } else if (title === "ITEMS") {
      sec.id = "feItemsSec";
      sec.innerHTML = '<h2>Line items</h2>' +
        '<div class="fe-libar" role="group" aria-label="Table columns and import">' +
          '<div class="fe-libar-cols"><span class="fe-libar-lab">Columns <small id="feColCount"></small></span><div class="fe-colstrip" id="feCols" role="list" aria-label="Columns in table order"></div></div>' +
          '<div class="fe-libar-acts"><button type="button" class="btn small" id="feEditCols" aria-haspopup="dialog"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="9" y1="4" x2="9" y2="20"/><line x1="15" y1="4" x2="15" y2="20"/></svg>Edit columns</button>' +
          '<button type="button" class="btn small" id="feImport" title="Import line items from a CSV or Excel file (.csv, .xlsx, .xls)"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>Import CSV / Excel</button>' +
          '<button type="button" class="btn small icon fe-libar-help" id="feImportInfo" aria-expanded="false" aria-controls="feImportHelp" aria-label="How to set up your import file" title="How to set up your file"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 4.9.8c0 1.7-2.4 2-2.4 3.7"/><line x1="12" y1="17.2" x2="12" y2="17.3"/></svg></button></div>' +
        '</div>' +
        '<div class="fe-import-help" id="feImportHelp" hidden></div>' +
        '<div id="feItems" class="fe-items"></div><div class="fe-item-tools"><button type="button" class="fe-add" id="feAddItem">+ Add line item</button><button type="button" class="fe-add fe-ghost" id="fePickProduct">+ Add saved item</button><button type="button" class="fe-add fe-ghost fe-danger" id="feClearAll">Clear all items</button></div>';
    } else {
      sec.innerHTML = `<h2>${title}</h2><div class="fe-grid"></div>`;
      const grid = sec.querySelector(".fe-grid");
      if (title === "Totals") grid.classList.add("fe-grid3");
      defs.forEach(d => { const f = fieldEl(d); if (f) grid.appendChild(f); });
      if (title === "Totals") {
        const sum = document.createElement("dl"); sum.className = "fe-sum"; sum.id = "feSum";
        sum.innerHTML = '<div><dt>Subtotal</dt><dd id="feSub"></dd></div><div><dt>Discount</dt><dd id="feDisc"></dd></div><div><dt>Tax</dt><dd id="feTax"></dd></div><div id="feTax2Wrap"><dt>Second tax</dt><dd id="feTax2"></dd></div><div id="feItemTaxWrap"><dt>Item tax</dt><dd id="feItemTax"></dd></div><div class="fe-total"><dt id="feTotLabel">Total</dt><dd id="feTot"></dd></div><div id="fePaidWrap"><dt>Amount paid</dt><dd id="fePaid"></dd></div><div class="fe-total" id="feBalWrap"><dt>Balance due</dt><dd id="feBal"></dd></div>';
        sec.appendChild(sum);
      }
    }
    (PROFILE.has(title) ? profBody : root).appendChild(sec);
    if (title === "Notes & terms") root.appendChild(prof);
  });
  const help = document.querySelector("#importPanel .importhelp"), hh = $("feImportHelp");
  if (help && hh) { const body = help.querySelector(".importhelp-body"); hh.innerHTML = '<p class="fe-import-help-title">How to import items from a spreadsheet</p>' + (body ? body.innerHTML : ""); }
  const foot = document.createElement("div"); foot.className = "fe-foot";
  foot.innerHTML = '<button type="button" class="btn primary" id="feSeePreview">See preview</button>';
  root.appendChild(foot);
  if (!$("feFab")) {
    const fab = document.createElement("div"); fab.id = "feFab"; fab.className = "fe-fab";
    fab.innerHTML = '<span class="fe-saved" id="feSaved" role="status" aria-live="polite"></span><button type="button" class="btn primary" id="feFabBtn">Preview</button>';
    document.body.appendChild(fab);
    fab.querySelector("#feFabBtn").addEventListener("click", () => $("canvasModePreviewBtn").click());
    const sn = document.createElement("div"); sn.id = "feSnack"; sn.className = "fe-snack"; sn.setAttribute("role", "status"); sn.hidden = true;
    sn.innerHTML = '<span id="feSnackMsg"></span><button type="button" id="feUndo">Undo</button>';
    document.body.appendChild(sn);
    sn.querySelector("#feUndo").addEventListener("click", undoRemove);
    let st; window.addEventListener("invoicestudio:autosaved", () => {
      if (!document.body.classList.contains("form-mode")) return;
      const el = $("feSaved"); el.textContent = "Saved ✓"; el.classList.add("show"); clearTimeout(st); st = setTimeout(() => el.classList.remove("show"), 1600);
    });
  }

  const cs = $("feSecClient");
  if (cs) { const bar = document.createElement("div"); bar.className = "fe-client-bar"; bar.innerHTML = '<button type="button" class="btn small" id="fePickClient">Choose saved client</button><button type="button" class="btn small" id="feSaveClient">Save this client</button>'; cs.querySelector("h2").after(bar); }
  root.addEventListener("click", e => {
    const go = e.target.closest(".fe-nav [data-go]");
    if (go) {
      const t = $(go.dataset.go); if (!t) return;
      if (t.tagName === "DETAILS") t.open = true;
      t.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion:reduce)").matches ? "auto" : "smooth", block: "start" });
      return;
    }
    if (e.target.closest("#feAddItem")) { api.addItem(); return; }
    if (e.target.closest("#fePickProduct")) { openPicker("product"); return; }
    if (e.target.closest("#fePickClient")) { openPicker("client"); return; }
    if (e.target.closest("#feSaveClient")) { saveCurrentClient(); return; }
    if (e.target.closest("#feSignUpload")) { $("signFile").click(); return; }
    if (e.target.closest("#feSignRemove")) { $("signRemoveBtn").click(); return; }
    const oc = e.target.closest("#feGoCols, #feEditCols, .fe-colpill");
    if (oc) { openColumnsDialog(oc, oc.dataset.key); return; }
    if (e.target.closest("#feClearAll")) { const b = $("clearItemsBtn"); if (b) b.click(); return; }
    const dup = e.target.closest(".fe-dup");
    if (dup) {
      const idx = Number(dup.dataset.idx), it = state.items[idx];
      if (it) { state.items.splice(idx + 1, 0, JSON.parse(JSON.stringify(it))); api.renderPreview(); api.save(); }
      return;
    }
    if (e.target.closest("#feSeePreview")) { $("canvasModePreviewBtn").click(); return; }
    if (e.target.closest("#feImport")) { $("importSheetBtn").click(); return; }
    const info = e.target.closest("#feImportInfo");
    if (info) { const h = $("feImportHelp"), open = h.hidden; h.hidden = !open; info.setAttribute("aria-expanded", String(open)); info.classList.toggle("active", open); return; }
    if (e.target.closest("#feLogoRemove")) { $("removeLogoBtn").click(); return; }
    if (e.target.closest("#feLogoReset")) { $("resetLogoSizeBtn").click(); return; }
    const pos = e.target.closest("#feLogoPos button");
    if (pos) { const b = document.querySelector('.logo-position-btn[data-pos="' + pos.dataset.pos + '"]'); if (b) b.click(); return; }
    const rm = e.target.closest(".fe-del");
    if (rm) {
      const idx = Number(rm.dataset.idx);
      if (Number.isInteger(idx) && state.items[idx] !== undefined) {
        const [item] = state.items.splice(idx, 1); api.renderPreview(); api.save();
        showUndo(idx, item);
      }
    }
  });
  root.addEventListener("keydown", onEnter);
  const onCell = e => {
    const el = e.target.closest(".fe-cell"); if (!el) return;
    const idx = Number(el.dataset.idx), item = state.items[idx]; if (!item) return;
    const col = state.columns.find(c => c.key === el.dataset.key);
    item[el.dataset.key] = col && ["number", "currency", "percentage"].includes(col.type)
      ? (el.value.trim() === "" ? "" : num(el.value)) : el.value;
    api.refreshItemRowAndTotals(idx); api.save();
    updateAmounts();
  };
  root.addEventListener("input", onCell); root.addEventListener("change", onCell);
  root.addEventListener("change", e => {
    if (e.target.id === "feLogoFile") { const file = e.target.files && e.target.files[0]; if (file) api.handleLogoFile(file, e.target); }
  });
  root.addEventListener("input", e => {
    if (e.target.id === "fe_logoHeight") {
      const r = $("logoHeight"); r.value = e.target.value; r.dispatchEvent(new Event("input", { bubbles: true }));
      const n = $("fe_logoHeightValue"); if (n) n.value = e.target.value;
      return;
    }
    if (e.target.id === "fe_logoHeightValue") {
      const n = $("logoHeightValue"); n.value = e.target.value; n.dispatchEvent(new Event("input", { bubbles: true }));
    }
  });
}

let undoInfo = null, undoT;
function showUndo(idx, item) {
  undoInfo = { idx, item };
  const sn = $("feSnack"); if (!sn) return;
  $("feSnackMsg").textContent = "Item " + (idx + 1) + " removed"; sn.hidden = false;
  clearTimeout(undoT); undoT = setTimeout(() => { sn.hidden = true; undoInfo = null; }, 6000);
}
function undoRemove() {
  if (!undoInfo) return;
  state.items.splice(Math.min(undoInfo.idx, state.items.length), 0, undoInfo.item);
  undoInfo = null; $("feSnack").hidden = true; clearTimeout(undoT);
  api.renderPreview(); api.save();
}
function onEnter(e) {
  if (e.key !== "Enter" || e.isComposing) return;
  const t = e.target;
  if (!(t instanceof HTMLInputElement) || ["checkbox", "color", "file", "button"].includes(t.type)) return;
  const all = [...document.querySelectorAll("#formEditor input.fe-input, #formEditor select.fe-input, #formEditor textarea.fe-input")].filter(x => x.offsetParent !== null && !x.disabled);
  const i = all.indexOf(t); if (i < 0) return;
  e.preventDefault();
  const cells = [...document.querySelectorAll("#feItems .fe-cell")];
  if (cells.length && t === cells[cells.length - 1]) {
    api.addItem();
    requestAnimationFrame(() => { const c = document.querySelectorAll("#feItems .fe-cell"); const first = c[cells.length]; if (first) first.focus(); });
    return;
  }
  if (all[i + 1]) all[i + 1].focus();
}
function visibleCols() { return state.columns.filter(c => c.visible); }

function updateAmounts() {
  const cols = visibleCols();
  document.querySelectorAll("#feItems .fe-amount").forEach(n => {
    const item = state.items[Number(n.dataset.idx)], col = cols.find(c => c.role === "amount");
    if (item && col) n.textContent = fmtCell(itemValue(item, col), col);
  });
  const showRow = (id, on) => { const el = $(id); if (el && el.hidden === on) el.hidden = !on; };
  showRow("feTax2Wrap", state.sections.tax2 !== false);
  const paidOn = state.sections.amountPaid !== false && num($("amountPaid").value) > 0;
  showRow("fePaidWrap", paidOn); showRow("feBalWrap", paidOn);
  showRow("feItemTaxWrap", !$("itemTaxRow").hidden);
  [["feSub", "pSubtotal"], ["feDisc", "pDiscount"], ["feTax", "pTax"], ["feTax2", "pTax2"], ["feItemTax", "pItemTax"], ["feTot", "pTotal"], ["fePaid", "pPaid"], ["feBal", "pBalanceDue"]].forEach(([a, b]) => {
    const t = $(a), s = $(b); if (t && s && t.textContent !== s.textContent) t.textContent = s.textContent;
  });
  const tl = $("feTotLabel"), bl = $("labelBalance");
  if (tl && bl) { const v = paidOn ? "Total" : (bl.value || bl.placeholder || "Total"); if (tl.textContent !== v) tl.textContent = v; }
}

function renderItems() {
  const host = $("feItems"); if (!host) return;
  const cols = visibleCols();
  const sig = cols.map(c => [c.key, c.label, c.type, c.role].join("|")).join(";") + "#" + state.items.length;
  if (sig === itemsSig) {
    // same structure: refresh values of fields that aren't being typed in
    host.querySelectorAll(".fe-cell").forEach(el => {
      if (el === document.activeElement) return;
      const v = state.items[Number(el.dataset.idx)]?.[el.dataset.key];
      const s = v == null ? "" : String(v);
      if (el.value !== s) el.value = s;
    });
    return;
  }
  itemsSig = sig;
  if (!state.items.length) { host.innerHTML = '<p class="fe-empty">No line items yet.</p>'; return; }
  const prim = cols.filter(c => c.role !== "amount" && !["number", "currency", "percentage", "date"].includes(c.type)).sort((a, b) => num(b.width) - num(a.width))[0];
  const tpl = cols.map(c => c === prim ? "minmax(150px,3fr)" : c.role === "amount" ? "minmax(84px,1fr)" : "minmax(60px,1fr)").join(" ");
  const touch = typeof matchMedia === "function" && matchMedia("(pointer:coarse)").matches;
  host.innerHTML = state.items.map((item, idx) => {
    const cells = cols.map(c => {
      if (c.role === "amount") return `<div class="fe-cell-wrap fe-amt"><span class="fe-lab">${esc(c.label)}</span><span class="fe-amount" data-idx="${idx}">${esc(fmtCell(itemValue(item, c), c))}</span></div>`;
      const numeric = ["number", "currency", "percentage"].includes(c.type);
      const type = numeric ? (touch ? "text" : "number") : c.type === "date" ? "date" : "text";
      const v = item[c.key] == null ? "" : item[c.key];
      const wide = c === prim ? " fe-wide" : "";
      return `<div class="fe-cell-wrap${wide}"><label class="fe-lab" for="fe_i${idx}_${esc(c.key)}">${esc(c.label)}</label><input id="fe_i${idx}_${esc(c.key)}" class="fe-input fe-cell${numeric ? " fe-num" : ""}" type="${type}"${type === "number" ? ' step="0.01"' : ""}${numeric ? ' inputmode="decimal" autocomplete="off"' : ""} data-idx="${idx}" data-key="${esc(c.key)}" value="${esc(v)}"${c === prim ? ' placeholder="e.g. Website design" enterkeyhint="next"' : ' enterkeyhint="next"'}></div>`;
    }).join("");
    return `<div class="fe-item"><div class="fe-item-head"><span>Item ${idx + 1}</span><span class="fe-item-acts"><button type="button" class="fe-dup" data-idx="${idx}" aria-label="Duplicate item ${idx + 1}">Duplicate</button><button type="button" class="fe-del" data-idx="${idx}" aria-label="Remove item ${idx + 1}">Remove</button></span></div><div class="fe-item-grid" style="--tpl:${tpl}">${cells}</div></div>`;
  }).join("");
}

let colsSig = "";
/* Compact, read-only summary of the table columns (in order). Editing happens in the Table columns popup. */
function renderColumns() {
  const host = $("feCols"); if (!host) return;
  const cc = $("feColCount"); if (cc) cc.textContent = "· " + state.columns.filter(c => c.visible).length + " of " + state.columns.length + " shown";
  const sig = state.columns.map(c => [c.key, c.label, c.visible ? 1 : 0, Math.round(num(c.width))].join("|")).join(";");
  if (sig === colsSig) return;
  colsSig = sig;
  host.innerHTML = state.columns.map(c => `<button type="button" role="listitem" class="fe-colpill${c.visible ? "" : " is-off"}" data-key="${esc(c.key)}" style="--w:${Math.max(5, Math.round(num(c.width)))}" aria-label="Edit ${esc(c.label)} column${c.visible ? "" : " (hidden)"}"><span>${esc(c.label)}</span></button>`).join("");
}
function syncSign() {
  const t = $("feSignThumb"); if (!t) return;
  const want = state.signature ? `<img src="${esc(state.signature)}" alt="">` : '<span class="fe-sign-empty">No signature</span>';
  if (t.dataset.v !== (state.signature || "-")) { t.innerHTML = want; t.dataset.v = state.signature || "-"; }
}
function syncLogo() {
  const img = $("feLogoImg"), letter = $("feLogoLetter"); if (!img) return;
  if (state.logo) { if (img.getAttribute("src") !== state.logo) img.src = state.logo; img.hidden = false; letter.hidden = true; }
  else { img.removeAttribute("src"); img.hidden = true; letter.hidden = false; letter.textContent = (($("companyName").value || "").trim()[0] || "Y").toUpperCase(); }
  const n = $("fe_logoHeightValue"), v = $("logoHeightValue");
  if (n && v && n !== document.activeElement && n.value !== v.value) n.value = v.value;
  const fr = $("fe_logoHeight"), lr = $("logoHeight");
  if (fr && lr && fr !== document.activeElement && fr.value !== lr.value) fr.value = lr.value;
  const pos = $("logoPosition") ? $("logoPosition").value : "";
  document.querySelectorAll("#feLogoPos button").forEach(b => b.classList.toggle("active", b.dataset.pos === pos));
}

const COLOR_ROWS = [
  ["balanceLabelColor", "Balance due label color"], ["totalColor", "Balance due amount color"],
  ["headerColor", "Header background"], ["headerTextColor", "Header text color"], ["invoiceColor", "Invoice area background"]
];
const sectionToggles = [];
const designMirrors = []; // { src, el }

function mirrorSelect(id, label, host) {
  const src = $(id); if (!src) return;
  const wrap = document.createElement("div"); wrap.className = "fe-field";
  const lab = document.createElement("label"); lab.htmlFor = "fe_" + id; lab.textContent = label;
  const el = document.createElement("select"); el.id = "fe_" + id; el.className = "fe-input";
  el.innerHTML = src.innerHTML;
  el.addEventListener("change", () => { src.value = el.value; src.dispatchEvent(new Event("change", { bubbles: true })); src.dispatchEvent(new Event("input", { bubbles: true })); });
  wrap.append(lab, el); host.appendChild(wrap); designMirrors.push({ src, el });
}
function colorRow(id, label, host, optional) {
  const sw = $(id), hex = $(id + "Hex"); if (!sw || !hex) return;
  const wrap = document.createElement("div"); wrap.className = "fe-field fe-full";
  wrap.innerHTML = `<label for="fe_${id}Hex">${label}</label><div class="fe-colorrow"><input type="color" id="fe_${id}" class="fe-swatch" aria-label="${label} swatch"><input type="text" id="fe_${id}Hex" class="fe-input" autocomplete="off" spellcheck="false">${optional ? `<button type="button" class="btn small" data-clear="${id}">Reset</button>` : ""}</div>`;
  const fs = wrap.querySelector(".fe-swatch"), fh = wrap.querySelector(".fe-input");
  fs.addEventListener("input", () => { sw.value = fs.value; sw.dispatchEvent(new Event("input", { bubbles: true })); });
  fh.addEventListener("input", () => { hex.value = fh.value; hex.dispatchEvent(new Event("input", { bubbles: true })); });
  fh.addEventListener("change", () => { hex.dispatchEvent(new Event("change", { bubbles: true })); });
  const clr = wrap.querySelector("[data-clear]");
  if (clr) clr.addEventListener("click", () => { const b = $(id + "Clear"); if (b) b.click(); });
  host.appendChild(wrap);
  designMirrors.push({ src: sw, el: fs }, { src: hex, el: fh, placeholder: true });
}
function buildDesign(sec) {
  sec.innerHTML = '<details class="fe-details" id="feDesignDetails"><summary>Design &amp; layout</summary><p class="fe-hint">Template, page size, colors and which sections appear on the document.</p>' +
    '<div class="fe-grid" id="feDesignGrid"></div><h3 class="fe-sub">Colors</h3><div class="fe-grid" id="feColorGrid"></div><button type="button" class="btn small" id="feResetColors">Reset colors</button>' +
    '<h3 class="fe-sub">Show / hide sections</h3><div class="fe-toggles" id="feToggles"></div></details>';
  const g = sec.querySelector("#feDesignGrid");
  mirrorSelect("template", "Template", g); mirrorSelect("paperSize", "Page size", g);
  mirrorSelect("invoiceFont", "Font", g); mirrorSelect("docLanguage", "Document language", g); mirrorSelect("watermark", "Watermark", g);
  const cg = sec.querySelector("#feColorGrid");
  colorRow("accent", "Accent color", cg, false);
  COLOR_ROWS.forEach(([id, l]) => colorRow(id, l, cg, true));
  sec.querySelector("#feResetColors").addEventListener("click", () => { const b = $("resetColorBtn"); if (b) b.click(); });
  const t = sec.querySelector("#feToggles");
  sectionDefs.forEach(([k, l]) => {
    const row = document.createElement("div"); row.className = "fe-toggle";
    row.innerHTML = `<span id="fe-tl-${k}">${l}</span><label class="switch"><input type="checkbox" data-fe-section="${k}" aria-labelledby="fe-tl-${k}"><span class="slider"></span></label>`;
    const cb = row.querySelector("input");
    cb.addEventListener("change", () => { state.sections[k] = cb.checked; api.renderPreview(); api.save(); });
    t.appendChild(row); sectionToggles.push([k, cb]);
  });
}
function syncDesign() {
  designMirrors.forEach(m => {
    if (m.el !== document.activeElement && m.el.value !== m.src.value) m.el.value = m.src.value;
    if (m.placeholder && m.src.placeholder && m.el.placeholder !== m.src.placeholder) m.el.placeholder = m.src.placeholder;
  });
  sectionToggles.forEach(([k, cb]) => { const on = state.sections[k] !== false; if (cb.checked !== on && cb !== document.activeElement) cb.checked = on; });
}

/* Called after every renderPreview() and on mode entry. Cheap; skips fields being typed in. */
export function syncFormEditor() {
  if (!built || !document.body.classList.contains("form-mode")) return;
  binds.forEach(b => {
    if (b.el !== document.activeElement && b.el.value !== b.src.value) b.el.value = b.src.value;
    if (b.src.placeholder && b.el.placeholder !== b.src.placeholder) b.el.placeholder = b.src.placeholder;
    if (b.labelFrom) { const l = $(b.labelFrom); const t = (l && (l.value || l.placeholder)) || b.label; if (b.lab.textContent !== t) b.lab.textContent = t; }
    const on = !b.section || state.sections[b.section] !== false;
    if (b.wrap.hidden === on) b.wrap.hidden = !on;
  });
  const cur = $("currency"), sym = cur ? (CURRENCY_SYMBOLS[cur.value] || cur.value || "") : "";
  document.querySelectorAll('#formEditor .fe-aff[data-cur]').forEach(a => { if (a.textContent !== sym) a.textContent = sym; });
  const ps = $("feProfileSum"), cn = $("companyName"); if (ps && cn) ps.textContent = (cn.value || "").trim();
  renderItems();
  renderColumns();
  syncColumnsDialog();
  syncLogo();
  syncSign();
  syncDesign();
  updateAmounts();
}

export function initFormEditor(callbacks) {
  api = callbacks;
  initColumnsDialog(callbacks);
  build();
}

export function enterFormMode() { build(); itemsSig = ""; colsSig = ""; syncFormEditor(); }
