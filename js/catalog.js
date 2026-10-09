// catalog.js — saved Clients and Products & services (stored on this device),
// their management pages, and the quick pickers used from the invoice
// ("Choose saved client", "Add saved item") in Edit and Form modes.

import { $, esc, uid } from "./dom.js";
import { state } from "./state.js";
import { num, moneyFor } from "./format.js";
import { toast } from "./toast.js";
import { ICON_EDIT, ICON_TRASH } from "./icons.js";

const CK = "invoiceStudio.clients.v1", PK = "invoiceStudio.products.v1";
let api = null;   // { renderPreview, save, openPage, closePage }
const load = k => { try { const v = JSON.parse(localStorage.getItem(k)); return Array.isArray(v) ? v : []; } catch { return []; } };
const store = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { toast("Storage is full — remove some saved items or download a backup."); return false; } };
export const loadClients = () => load(CK);
export const loadProducts = () => load(PK);
const fire = el => el && el.dispatchEvent(new Event("input", { bubbles: true }));
const S = v => String(v ?? "").trim();
const CLIENT_FIELDS = [["name", "clientName", "Client or company name"], ["contact", "clientContact", "Contact person"], ["email", "clientEmail", "Email"], ["tax", "clientTax", "VAT / Tax number"], ["address", "clientAddress", "Address"]];
const PRODUCT_FIELDS = [["description", "Description"], ["sku", "SKU / code"], ["rate", "Price"], ["taxRate", "Tax % (optional)"]];

/* ---------------- client actions ---------------- */
export function useClient(c) {
  CLIENT_FIELDS.forEach(([k, id]) => { const el = $(id); if (el) { el.value = c[k] || ""; fire(el); } });
  toast(`${c.name || "Client"} added to the ${state.docType || "invoice"}.`);
}
function currentClient() {
  const o = {}; CLIENT_FIELDS.forEach(([k, id]) => o[k] = S($(id) && $(id).value)); return o;
}
export function saveCurrentClient() {
  const c = currentClient();
  if (!c.name) { toast("Add a client name first."); return; }
  const list = loadClients(), ex = list.find(x => S(x.name).toLowerCase() === c.name.toLowerCase());
  if (ex) Object.assign(ex, c, { updatedAt: Date.now() }); else list.unshift({ id: uid(), ...c, updatedAt: Date.now() });
  if (store(CK, list)) { renderClients(); toast(ex ? `Updated ${c.name}.` : `Saved ${c.name} to Clients.`); }
}

/* ---------------- product actions ---------------- */
function colFor(pred) { return state.columns.find(pred); }
export function addProduct(p) {
  const item = {};
  const desc = colFor(c => c.key === "description") || colFor(c => c.role === "none" && c.type === "text" && c.key !== "sku");
  const sku = colFor(c => c.key === "sku"), q = colFor(c => c.role === "quantity"), r = colFor(c => c.role === "rate"), t = colFor(c => c.role === "tax");
  if (desc) item[desc.key] = p.description || "";
  if (sku) item[sku.key] = p.sku || "";
  if (q) item[q.key] = 1;
  if (r) item[r.key] = num(p.rate);
  if (t && S(p.taxRate) !== "") item[t.key] = num(p.taxRate);
  state.items.push(item);
  api.renderPreview(); api.save();
}
export function saveCurrentItems() {
  const desc = colFor(c => c.key === "description"), sku = colFor(c => c.key === "sku"), r = colFor(c => c.role === "rate"), t = colFor(c => c.role === "tax");
  const list = loadProducts(); let n = 0;
  state.items.forEach(i => {
    const d = S(desc ? i[desc.key] : ""); if (!d) return;
    const p = { description: d, sku: S(sku ? i[sku.key] : ""), rate: r ? num(i[r.key]) : 0, taxRate: t ? S(i[t.key]) : "" };
    const ex = list.find(x => S(x.description).toLowerCase() === d.toLowerCase() && S(x.sku) === p.sku);
    if (ex) Object.assign(ex, p, { updatedAt: Date.now() }); else list.unshift({ id: uid(), ...p, updatedAt: Date.now() });
    n++;
  });
  if (!n) { toast("There are no items with a description to save."); return; }
  if (store(PK, list)) { renderProducts(); toast(`Saved ${n} item${n === 1 ? "" : "s"} to Products & services.`); }
}

/* ---------------- edit dialog (shared) ---------------- */
let editDlg = null;
function editDialog() {
  if (editDlg) return editDlg;
  editDlg = document.createElement("dialog");
  editDlg.className = "cs-dialog small-dialog"; editDlg.id = "catalogEdit"; editDlg.setAttribute("aria-labelledby", "catalogEditTitle");
  editDlg.innerHTML = `<form method="dialog" class="cs-inner" novalidate><header class="cs-head"><div><h2 id="catalogEditTitle"></h2></div>
    <button type="button" class="cs-icon-btn" data-close aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" focusable="false"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg></button></header>
    <div class="cat-fields"></div><p class="fe-err" id="catalogErr" hidden role="alert"></p>
    <footer class="cs-foot"><button type="button" class="btn" data-close>Cancel</button><button type="submit" class="btn primary" value="save">Save</button></footer></form>`;
  document.body.appendChild(editDlg);
  editDlg.addEventListener("click", e => { if (e.target === editDlg || e.target.closest("[data-close]")) editDlg.close(); });
  return editDlg;
}
function openEditor(kind, entry) {
  const d = editDialog(), isC = kind === "client", f = d.querySelector(".cat-fields");
  d.querySelector("#catalogEditTitle").textContent = (entry ? "Edit " : "Add ") + (isC ? "client" : "product or service");
  const defs = isC ? CLIENT_FIELDS.map(([k, , l]) => [k, l]) : PRODUCT_FIELDS;
  f.innerHTML = defs.map(([k, l]) => {
    const v = esc(entry ? entry[k] ?? "" : ""), id = "cat_" + k;
    const area = k === "address" || k === "description";
    const numeric = k === "rate" || k === "taxRate";
    return `<div class="cs-field"><label for="${id}">${l}${(k === "name" || k === "description") ? ' <span class="req" aria-hidden="true">*</span>' : ""}</label>${area
      ? `<textarea id="${id}" class="fe-input" rows="2" data-k="${k}">${v}</textarea>`
      : `<input id="${id}" class="fe-input" data-k="${k}" value="${v}" ${numeric ? 'inputmode="decimal"' : ""} ${k === "email" ? 'type="email"' : ""} autocomplete="off">`}</div>`;
  }).join("");
  const err = d.querySelector("#catalogErr"); err.hidden = true;
  const form = d.querySelector("form");
  form.onsubmit = e => {
    e.preventDefault();
    const o = {}; f.querySelectorAll("[data-k]").forEach(el => o[el.dataset.k] = S(el.value));
    const req = isC ? "name" : "description";
    if (!o[req]) { err.textContent = (isC ? "Client name" : "Description") + " is required."; err.hidden = false; f.querySelector(`[data-k="${req}"]`).focus(); return; }
    if (!isC) o.rate = num(o.rate);
    const key = isC ? CK : PK, list = load(key);
    if (entry) { const x = list.find(y => y.id === entry.id); if (x) Object.assign(x, o, { updatedAt: Date.now() }); }
    else list.unshift({ id: uid(), ...o, updatedAt: Date.now() });
    if (store(key, list)) { d.close(); isC ? renderClients() : renderProducts(); toast(entry ? "Saved changes." : "Added."); }
  };
  d.showModal();
  const first = f.querySelector("[data-k]"); if (first) first.focus();
}
function remove(kind, id) {
  const key = kind === "client" ? CK : PK, list = load(key), x = list.find(y => y.id === id); if (!x) return;
  if (!confirm(`Delete "${x.name || x.description}"? This can't be undone.`)) return;
  store(key, list.filter(y => y.id !== id)); kind === "client" ? renderClients() : renderProducts(); toast("Deleted.");
}

/* ---------------- pages ---------------- */
const emptyState = (icon, title, text) => `<div class="history-empty pg-empty">${icon}<h3>${title}</h3><p class="hint">${text}</p></div>`;
const I_USERS = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>';
const I_BOX = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M21 8 12 3 3 8v8l9 5 9-5Z"/><path d="m3 8 9 5 9-5"/><path d="M12 13v8"/></svg>';
const match = (q, ...xs) => !q || xs.join(" ").toLowerCase().includes(q);

export function renderClients() {
  const root = $("clientsList"); if (!root) return;
  const all = loadClients(), q = S($("clientSearch") && $("clientSearch").value).toLowerCase();
  const list = all.filter(c => match(q, c.name, c.contact, c.email)).sort((a, b) => S(a.name).localeCompare(S(b.name)));
  $("clientsCount").textContent = all.length ? (q ? `${list.length} of ${all.length} shown` : `${all.length} client${all.length === 1 ? "" : "s"}`) : "";
  if (!all.length) { root.innerHTML = emptyState(I_USERS, "No saved clients yet", "Add a client here, or fill in a client on an invoice and choose <strong>Save client from current invoice</strong>. Next time, pick them in one click."); return; }
  if (!list.length) { root.innerHTML = '<p class="hint pg-nomatch">No clients match your search.</p>'; return; }
  root.innerHTML = list.map(c => `<article class="historycard pg-card" data-id="${esc(c.id)}">
    <div class="pg-card-title"><strong>${esc(c.name)}</strong><span class="${c.contact ? "" : "pg-muted"}">${esc(c.contact || "No contact person")}</span></div>
    <div class="historymeta pg-lines">${c.email ? `<span>${esc(c.email)}</span>` : ""}${c.address ? `<span>${esc(c.address.split("\n")[0])}</span>` : ""}</div>
    <div class="historyactions pg-actions"><button class="btn small primary" data-act="use" type="button">Use on invoice</button><button class="btn small icon" data-act="edit" type="button" title="Edit" aria-label="Edit ${esc(c.name)}">${ICON_EDIT}</button><button class="btn small icon danger" data-act="del" type="button" title="Delete" aria-label="Delete ${esc(c.name)}">${ICON_TRASH}</button></div></article>`).join("");
}
export function renderProducts() {
  const root = $("productsList"); if (!root) return;
  const all = loadProducts(), q = S($("productSearch") && $("productSearch").value).toLowerCase(), cur = $("currency").value;
  const list = all.filter(p => match(q, p.description, p.sku)).sort((a, b) => S(a.description).localeCompare(S(b.description)));
  $("productsCount").textContent = all.length ? (q ? `${list.length} of ${all.length} shown` : `${all.length} item${all.length === 1 ? "" : "s"}`) : "";
  if (!all.length) { root.innerHTML = emptyState(I_BOX, "No saved products or services yet", "Add the things you bill often — with their price — and insert them into any invoice in one click."); return; }
  if (!list.length) { root.innerHTML = '<p class="hint pg-nomatch">Nothing matches your search.</p>'; return; }
  root.innerHTML = list.map(p => `<article class="historycard pg-card" data-id="${esc(p.id)}">
    <div class="pg-card-main"><div class="pg-card-title"><strong>${esc(p.description)}</strong><span class="${p.sku ? "" : "pg-muted"}">${esc(p.sku || "No code")}</span></div><span class="historyamount">${esc(moneyFor(p.rate, cur))}</span></div>
    ${S(p.taxRate) !== "" ? `<div class="historymeta"><span>Tax ${esc(p.taxRate)}%</span></div>` : ""}
    <div class="historyactions pg-actions"><button class="btn small primary" data-act="use" type="button">Add to invoice</button><button class="btn small icon" data-act="edit" type="button" title="Edit" aria-label="Edit ${esc(p.description)}">${ICON_EDIT}</button><button class="btn small icon danger" data-act="del" type="button" title="Delete" aria-label="Delete ${esc(p.description)}">${ICON_TRASH}</button></div></article>`).join("");
}

/* ---------------- picker ---------------- */
let pickKind = "client";
function renderPicker() {
  const ul = $("pickerList"), q = S($("pickerSearch").value).toLowerCase(), cur = $("currency").value;
  const items = pickKind === "client"
    ? loadClients().filter(c => match(q, c.name, c.contact, c.email)).sort((a, b) => S(a.name).localeCompare(S(b.name)))
    : loadProducts().filter(p => match(q, p.description, p.sku)).sort((a, b) => S(a.description).localeCompare(S(b.description)));
  if (!items.length) {
    const none = pickKind === "client" ? loadClients().length === 0 : loadProducts().length === 0;
    ul.innerHTML = `<li class="picker-empty">${none ? (pickKind === "client" ? "No saved clients yet. Use <strong>Manage list</strong> to add one." : "No saved products or services yet. Use <strong>Manage list</strong> to add some.") : "Nothing matches your search."}</li>`;
    return;
  }
  ul.innerHTML = items.map(x => pickKind === "client"
    ? `<li><button type="button" class="picker-item" data-id="${esc(x.id)}" role="option"><strong>${esc(x.name)}</strong><span>${esc([x.contact, x.email].filter(Boolean).join(" · ") || "—")}</span></button></li>`
    : `<li><button type="button" class="picker-item" data-id="${esc(x.id)}" role="option"><span class="picker-row"><strong>${esc(x.description)}</strong><b>${esc(moneyFor(x.rate, cur))}</b></span><span>${esc(x.sku || "")}</span></button></li>`).join("");
}
export function openPicker(kind) {
  pickKind = kind;
  $("pickerTitle").textContent = kind === "client" ? "Choose a saved client" : "Add saved items";
  $("pickerSub").textContent = kind === "client" ? "Fills in the client's details on this document." : "Tap an item to add it. Add as many as you like.";
  $("pickerSearch").value = ""; renderPicker();
  $("pickerDialog").showModal(); $("pickerSearch").focus();
}

export function initCatalog(callbacks) {
  api = callbacks;
  $("clientAddBtn").addEventListener("click", () => openEditor("client"));
  $("productAddBtn").addEventListener("click", () => openEditor("product"));
  $("clientSaveCurrentBtn").addEventListener("click", saveCurrentClient);
  $("productSaveCurrentBtn").addEventListener("click", saveCurrentItems);
  $("clientSearch").addEventListener("input", renderClients);
  $("productSearch").addEventListener("input", renderProducts);
  $("clientsList").addEventListener("click", e => {
    const b = e.target.closest("[data-act]"); if (!b) return;
    const c = loadClients().find(x => x.id === b.closest("[data-id]").dataset.id); if (!c) return;
    if (b.dataset.act === "use") { useClient(c); api.closePage(); }
    else if (b.dataset.act === "edit") openEditor("client", c); else remove("client", c.id);
  });
  $("productsList").addEventListener("click", e => {
    const b = e.target.closest("[data-act]"); if (!b) return;
    const p = loadProducts().find(x => x.id === b.closest("[data-id]").dataset.id); if (!p) return;
    if (b.dataset.act === "use") { addProduct(p); toast(`Added "${p.description}".`); }
    else if (b.dataset.act === "edit") openEditor("product", p); else remove("product", p.id);
  });
  const d = $("pickerDialog");
  $("pickerSearch").addEventListener("input", renderPicker);
  d.addEventListener("click", e => {
    if (e.target === d || e.target.closest("[data-close]")) { d.close(); return; }
    if (e.target.closest("#pickerManage")) { d.close(); api.openPage(pickKind === "client" ? "clients" : "products"); return; }
    const it = e.target.closest(".picker-item"); if (!it) return;
    if (pickKind === "client") { const c = loadClients().find(x => x.id === it.dataset.id); if (c) { useClient(c); d.close(); } }
    else { const p = loadProducts().find(x => x.id === it.dataset.id); if (p) { addProduct(p); it.classList.add("added"); toast(`Added "${p.description}".`); } }
  });
  $("pickClientBtn").addEventListener("click", () => openPicker("client"));
  $("pickProductBtn").addEventListener("click", () => openPicker("product"));
  window.addEventListener("invoicestudio:page", e => { if (e.detail === "clients") renderClients(); if (e.detail === "products") renderProducts(); });
  renderClients(); renderProducts();
}
