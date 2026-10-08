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
import { num, fmtCell } from "./format.js";

let api = null;          // { addItem, renderPreview, save, refreshItemRowAndTotals }
let built = false;
let itemsSig = "";
const binds = [];        // { src, el, section, wrap, labelFrom }

/* [id, label, kind, section, extra] — kind: text | email | tel | url | date | area | select | num */
const GROUPS = [
  ["Client", [
    ["clientName", "Client name", "text", "client"], ["clientEmail", "Client email", "email", "client"],
    ["clientContact", "Contact name", "text", "client"], ["clientTax", "VAT / Tax number", "text", "client"],
    ["clientAddress", "Address", "area", "client", "full"]]],
  ["Your company", [
    ["companyName", "Company name", "text", "company", "full"], ["companyEmail", "Email", "email", "company"],
    ["companyPhone", "Phone", "tel", "company"], ["companyWebsite", "Website", "url", "company"],
    ["companyReg", "Registration number", "text", "company"], ["companyVat", "VAT / Tax number", "text", "company"],
    ["companyAddress", "Address", "area", "company", "full"]]],
  ["LOGO", []],
  ["Details", [
    ["invoiceNumber", "Number", "text", null], ["status", "Status", "select", "status"],
    ["invoiceDate", "Issue date", "date", "invoiceDate", "", "labelInvoiceDate"], ["dueDate", "Due date", "date", "dueDate", "", "labelDueDate"],
    ["reference", "Reference / PO", "text", "reference", "full", "labelReference"]]],
  ["ITEMS", []],
  ["COLUMNS", []],
  ["Totals", [
    ["discount", "Discount %", "num", "discount"], ["tax", "Tax %", "num", "tax"], ["shipping", "Shipping", "num", "shipping"]]],
  ["Notes & terms", [
    ["notesAlign", "Notes alignment", "select", "notes"],
    ["notes", "Notes", "area", "notes", "full"], ["paymentDetails", "Payment details", "area", "payment", "full"],
    ["terms", "Terms", "area", "terms", "full"]]],
  ["DESIGN", []],
  ["LABELS", [
    ["labelTitle", "Document title", "text", null], ["labelBillTo", "Client heading", "text", "client"],
    ["labelInvoiceDate", "Issue date label", "text", "invoiceDate"], ["labelDueDate", "Due date label", "text", "dueDate"],
    ["labelReference", "Reference label", "text", "reference"], ["labelBalance", "Balance label", "text", "balance"],
    ["labelNote", "Notes heading", "text", "notes"], ["labelPayment", "Payment heading", "text", "payment"],
    ["labelTerms", "Terms heading", "text", "terms"]]]
];

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
    if (kind === "email") el.autocomplete = "off";
  }
  el.id = "fe_" + id; el.className = "fe-input";
  const evt = kind === "select" ? "change" : "input";
  el.addEventListener(evt, () => {
    src.value = el.value;
    src.dispatchEvent(new Event(evt, { bubbles: true }));
    if (kind === "select") src.dispatchEvent(new Event("input", { bubbles: true }));
  });
  wrap.append(lab, el);
  binds.push({ src, el, section, wrap, lab, label, labelFrom });
  return wrap;
}

function build() {
  const root = $("formEditor"); if (!root || built) return;
  built = true;
  root.innerHTML = "";
  GROUPS.forEach(([title, defs]) => {
    const sec = document.createElement("section"); sec.className = "fe-sec";
    if (title === "LOGO") {
      sec.innerHTML = '<h3>Logo</h3><div class="fe-logo"><div class="fe-logo-thumb" id="feLogoThumb"><img alt="" id="feLogoImg" hidden><span id="feLogoLetter">Y</span></div><div class="fe-logo-actions"><label class="btn small primary" for="feLogoFile">Upload logo</label><input id="feLogoFile" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" class="visually-hidden"><button type="button" class="btn small" id="feLogoRemove">Remove</button><button type="button" class="btn small" id="feLogoReset">Reset size</button></div></div>' +
        '<div class="fe-grid"><div class="fe-field"><label for="fe_logoHeightValue">Size (px)</label><input class="fe-input fe-num" id="fe_logoHeightValue" type="text" inputmode="numeric" autocomplete="off"></div>' +
        '<div class="fe-field"><span class="fe-lab">Position</span><div class="fe-seg" id="feLogoPos" role="group" aria-label="Logo position"><button type="button" data-pos="">Auto</button><button type="button" data-pos="left">Left</button><button type="button" data-pos="above">Above</button></div></div></div>';
    } else if (title === "COLUMNS") {
      sec.innerHTML = '<details class="fe-details" id="feColsDetails"><summary>Table columns</summary><p class="fe-hint">Rename, show/hide, reorder and set the type of each line-item column.</p><div id="feCols" class="fe-cols"></div><button type="button" class="fe-add" id="feAddCol">+ Add column</button></details>';
    } else if (title === "DESIGN") {
      buildDesign(sec);
    } else if (title === "LABELS") {
      sec.innerHTML = '<details class="fe-details"><summary>Labels &amp; headings</summary><p class="fe-hint">Rename the headings printed on the document. Leave blank for the default.</p><div class="fe-grid"></div></details>';
      const grid = sec.querySelector(".fe-grid");
      defs.forEach(d => { const f = fieldEl(d); if (f) grid.appendChild(f); });
    } else if (title === "ITEMS") {
      sec.id = "feItemsSec";
      sec.innerHTML = '<h3>Line items</h3><div id="feItems" class="fe-items"></div><div class="fe-item-tools"><button type="button" class="fe-add" id="feAddItem">+ Add line item</button></div><div class="fe-import" id="feImportBox"><div class="fe-import-title">Import from spreadsheet</div><p class="fe-hint">Upload a CSV or Excel file (.csv, .xlsx, .xls). Its columns are matched to your table columns automatically.</p><button type="button" class="btn primary" id="feImport">Choose CSV / Excel file</button><div id="feImportHelp"></div></div>';
    } else {
      sec.innerHTML = `<h3>${title}</h3><div class="fe-grid"></div>`;
      const grid = sec.querySelector(".fe-grid");
      defs.forEach(d => { const f = fieldEl(d); if (f) grid.appendChild(f); });
      if (title === "Totals") {
        const sum = document.createElement("dl"); sum.className = "fe-sum"; sum.id = "feSum";
        sum.innerHTML = '<div><dt>Subtotal</dt><dd id="feSub"></dd></div><div><dt>Discount</dt><dd id="feDisc"></dd></div><div><dt>Tax</dt><dd id="feTax"></dd></div><div class="fe-total"><dt id="feTotLabel">Total</dt><dd id="feTot"></dd></div>';
        sec.appendChild(sum);
      }
    }
    root.appendChild(sec);
  });
  const help = document.querySelector("#importPanel .importhelp"), hh = $("feImportHelp");
  if (help && hh) hh.innerHTML = '<details class="fe-details fe-help">' + help.innerHTML.replace(/<summary>[\s\S]*?<\/summary>/, "<summary>How to set up your file</summary>") + "</details>";
  const foot = document.createElement("div"); foot.className = "fe-foot";
  foot.innerHTML = '<button type="button" class="btn primary" id="feSeePreview">See preview</button>';
  root.appendChild(foot);

  root.addEventListener("click", e => {
    if (e.target.closest("#feAddItem")) { api.addItem(); return; }
    if (e.target.closest("#feSeePreview")) { $("canvasModePreviewBtn").click(); return; }
    if (e.target.closest("#feImport")) { $("importSheetBtn").click(); return; }
    if (e.target.closest("#feLogoRemove")) { $("removeLogoBtn").click(); return; }
    if (e.target.closest("#feLogoReset")) { $("resetLogoSizeBtn").click(); return; }
    const pos = e.target.closest("#feLogoPos button");
    if (pos) { const b = document.querySelector('.logo-position-btn[data-pos="' + pos.dataset.pos + '"]'); if (b) b.click(); return; }
    if (e.target.closest("#feAddCol")) { api.addColumn(); return; }
    const cb = e.target.closest(".fe-col button[data-act]");
    if (cb) { colAction(cb.dataset.act, cb.closest(".fe-col").dataset.key); return; }
    const rm = e.target.closest(".fe-del");
    if (rm) {
      const idx = Number(rm.dataset.idx);
      if (Number.isInteger(idx) && state.items[idx] !== undefined) { state.items.splice(idx, 1); api.renderPreview(); api.save(); }
    }
  });
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
    if (e.target.id === "feLogoFile") { const file = e.target.files && e.target.files[0]; if (file) api.handleLogoFile(file, e.target); return; }
    const cf = e.target.closest(".fe-col [data-f]");
    if (cf) colFieldChange(cf);
  });
  root.addEventListener("input", e => {
    const cf = e.target.closest(".fe-col [data-f]");
    if (cf && cf.dataset.f === "label") { const c = state.columns.find(x => x.key === cf.closest(".fe-col").dataset.key); if (c) { c.label = cf.value; api.save(); } }
    if (e.target.id === "fe_logoHeightValue") {
      const n = $("logoHeightValue"); n.value = e.target.value; n.dispatchEvent(new Event("input", { bubbles: true }));
    }
  });
}

function visibleCols() { return state.columns.filter(c => c.visible); }

function updateAmounts() {
  const cols = visibleCols();
  document.querySelectorAll("#feItems .fe-amount").forEach(n => {
    const item = state.items[Number(n.dataset.idx)], col = cols.find(c => c.role === "amount");
    if (item && col) n.textContent = fmtCell(itemValue(item, col), col);
  });
  [["feSub", "pSubtotal"], ["feDisc", "pDiscount"], ["feTax", "pTax"], ["feTot", "pTotal"]].forEach(([a, b]) => {
    const t = $(a), s = $(b); if (t && s && t.textContent !== s.textContent) t.textContent = s.textContent;
  });
  const tl = $("feTotLabel"), bl = $("labelBalance");
  if (tl && bl) { const v = bl.value || bl.placeholder || "Total"; if (tl.textContent !== v) tl.textContent = v; }
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
  const touch = typeof matchMedia === "function" && matchMedia("(pointer:coarse)").matches;
  host.innerHTML = state.items.map((item, idx) => {
    const cells = cols.map(c => {
      if (c.role === "amount") return `<div class="fe-cell-wrap fe-amt"><span class="fe-lab">${esc(c.label)}</span><span class="fe-amount" data-idx="${idx}">${esc(fmtCell(itemValue(item, c), c))}</span></div>`;
      const numeric = ["number", "currency", "percentage"].includes(c.type);
      const type = numeric ? (touch ? "text" : "number") : c.type === "date" ? "date" : "text";
      const v = item[c.key] == null ? "" : item[c.key];
      const wide = !numeric && c.type !== "date" ? " fe-wide" : "";
      return `<div class="fe-cell-wrap${wide}"><label class="fe-lab" for="fe_i${idx}_${esc(c.key)}">${esc(c.label)}</label><input id="fe_i${idx}_${esc(c.key)}" class="fe-input fe-cell${numeric ? " fe-num" : ""}" type="${type}"${type === "number" ? ' step="0.01"' : ""}${numeric ? ' inputmode="decimal" autocomplete="off"' : ""} data-idx="${idx}" data-key="${esc(c.key)}" value="${esc(v)}"></div>`;
    }).join("");
    return `<div class="fe-item"><div class="fe-item-head"><span>Item ${idx + 1}</span><button type="button" class="fe-del" data-idx="${idx}" aria-label="Remove item ${idx + 1}">Remove</button></div><div class="fe-item-grid">${cells}</div></div>`;
  }).join("");
}

const TYPES = [["text", "Text"], ["number", "Number"], ["currency", "Currency"], ["percentage", "Percentage"], ["date", "Date"]];
const ALIGNS = [["left", "Left"], ["center", "Center"], ["right", "Right"]];
const ROLES = [["none", "None"], ["quantity", "Quantity"], ["rate", "Rate / price"], ["amount", "Amount (calculated)"]];
const opts = (list, v) => list.map(([k, t]) => `<option value="${k}"${k === v ? " selected" : ""}>${t}</option>`).join("");
let colsSig = "";

function colAction(act, key) {
  const i = state.columns.findIndex(c => c.key === key); if (i < 0) return;
  if (act === "remove") api.removeColumn(key);
  else if (act === "up" && i > 0) { [state.columns[i - 1], state.columns[i]] = [state.columns[i], state.columns[i - 1]]; api.renderPreview(); api.save(); }
  else if (act === "down" && i < state.columns.length - 1) { [state.columns[i + 1], state.columns[i]] = [state.columns[i], state.columns[i + 1]]; api.renderPreview(); api.save(); }
}
function colFieldChange(el) {
  const c = state.columns.find(x => x.key === el.closest(".fe-col").dataset.key); if (!c) return;
  const f = el.dataset.f;
  if (f === "label") { if (!c.label.trim()) { c.label = "Column"; el.value = "Column"; } }
  else if (f === "type") c.type = el.value;
  else if (f === "align") c.align = el.value;
  else if (f === "role") api.setRole(c, el.value);
  else if (f === "width") c.width = Math.max(5, Math.min(80, num(el.value) || c.width));
  else if (f === "visible") {
    if (!el.checked && state.columns.filter(x => x.visible).length <= 1) { el.checked = true; return; }
    c.visible = el.checked;
  }
  api.renderPreview(); api.save();
}
function renderColumns() {
  const host = $("feCols"); if (!host) return;
  const sig = state.columns.map(c => c.key + (c.visible ? "1" : "0") + c.role).join(",");
  if (sig === colsSig) {
    host.querySelectorAll(".fe-col").forEach(row => {
      const c = state.columns.find(x => x.key === row.dataset.key); if (!c) return;
      [["label", c.label], ["type", c.type], ["align", c.align], ["role", c.role], ["width", String(Math.round(num(c.width)))]].forEach(([f, v]) => {
        const el = row.querySelector(`[data-f="${f}"]`); if (el && el !== document.activeElement && el.value !== v) el.value = v;
      });
    });
    return;
  }
  colsSig = sig;
  host.innerHTML = state.columns.map((c, i) => `<div class="fe-col" data-key="${esc(c.key)}">
    <div class="fe-col-top"><input class="fe-input" data-f="label" value="${esc(c.label)}" aria-label="Column name">
      <label class="fe-chk"><input type="checkbox" data-f="visible"${c.visible ? " checked" : ""}> Show</label></div>
    <div class="fe-col-grid">
      <label>Type<select class="fe-input" data-f="type">${opts(TYPES, c.type)}</select></label>
      <label>Align<select class="fe-input" data-f="align">${opts(ALIGNS, c.align)}</select></label>
      <label>Role<select class="fe-input" data-f="role">${opts(ROLES, c.role)}</select></label>
      <label>Width %<input class="fe-input fe-num" data-f="width" type="text" inputmode="numeric" value="${Math.round(num(c.width))}"></label></div>
    <div class="fe-col-actions"><button type="button" data-act="up" aria-label="Move column up"${i === 0 ? " disabled" : ""}>↑ Up</button><button type="button" data-act="down" aria-label="Move column down"${i === state.columns.length - 1 ? " disabled" : ""}>↓ Down</button><button type="button" class="fe-del" data-act="remove" aria-label="Remove column">Remove</button></div></div>`).join("");
}
function syncLogo() {
  const img = $("feLogoImg"), letter = $("feLogoLetter"); if (!img) return;
  if (state.logo) { if (img.getAttribute("src") !== state.logo) img.src = state.logo; img.hidden = false; letter.hidden = true; }
  else { img.removeAttribute("src"); img.hidden = true; letter.hidden = false; letter.textContent = (($("companyName").value || "").trim()[0] || "Y").toUpperCase(); }
  const n = $("fe_logoHeightValue"), v = $("logoHeightValue");
  if (n && v && n !== document.activeElement && n.value !== v.value) n.value = v.value;
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
    '<div class="fe-grid" id="feDesignGrid"></div><h4 class="fe-sub">Colors</h4><div class="fe-grid" id="feColorGrid"></div><button type="button" class="btn small" id="feResetColors">Reset colors</button>' +
    '<h4 class="fe-sub">Show / hide sections</h4><div class="fe-toggles" id="feToggles"></div></details>';
  const g = sec.querySelector("#feDesignGrid");
  mirrorSelect("template", "Template", g); mirrorSelect("paperSize", "Page size", g);
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
  renderItems();
  renderColumns();
  syncLogo();
  syncDesign();
  updateAmounts();
}

export function initFormEditor(callbacks) {
  api = callbacks;
  build();
}

export function enterFormMode() { build(); itemsSig = ""; colsSig = ""; syncFormEditor(); }
