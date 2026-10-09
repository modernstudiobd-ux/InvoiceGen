// columnDialog.js — "Table columns" popup used by the Form editor.
// Columns are shown as a compact, horizontal row of cards in table order.
// Drag a card (or its grip) to reorder — same idea as dragging a header on
// the Edit canvas — and tap a card to edit its name, visibility, type,
// alignment, calculation role and width in the panel underneath.
// It edits state.columns directly and goes through the same addColumn /
// removeColumn / setRole helpers as the canvas, so undo, save, preview,
// print and PDF all behave exactly as before.

import { esc } from "./dom.js";
import { state } from "./state.js";
import { num } from "./format.js";

let api = null;      // { renderPreview, save, addColumn, removeColumn, setRole }
let dlg = null;
let selKey = null;
let lastTrigger = null;

const TYPES = [["text", "Text"], ["number", "Number"], ["currency", "Currency"], ["percentage", "Percent"], ["date", "Date"]];
const ROLES = [["none", "None"], ["quantity", "Quantity"], ["rate", "Rate / price"], ["amount", "Amount (calculated)"], ["tax", "Tax % for this line"]];
const ALIGNS = [["left", "Left"], ["center", "Center"], ["right", "Right"]];
const TYPE_TXT = Object.fromEntries(TYPES);
const ROLE_TXT = { quantity: "Qty", rate: "Rate", amount: "Amount", tax: "Tax %" };
const opts = (list, v) => list.map(([k, t]) => `<option value="${k}"${k === v ? " selected" : ""}>${t}</option>`).join("");
const ICON = {
  grip: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>',
  eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>',
  eyeOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M10.7 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-2.2 3.1M6.6 6.6C3.9 8.4 2 12 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/><line x1="2" y1="2" x2="22" y2="22"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" focusable="false"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" focusable="false"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  left: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="m15 18-6-6 6-6"/></svg>',
  right: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="m9 18 6-6-6-6"/></svg>'
};

const commit = () => { api.renderPreview(); api.save(); };
const col = key => state.columns.find(c => c.key === key);
const visibleCount = () => state.columns.filter(c => c.visible).length;
function announce(msg) { const n = dlg && dlg.querySelector("#csLive"); if (n) { n.textContent = ""; requestAnimationFrame(() => { n.textContent = msg; }); } }
const meta = c => {
  const r = ROLE_TXT[c.role], t = TYPE_TXT[c.type] || "Text";
  const kind = r && r.toLowerCase() !== String(c.label).trim().toLowerCase() ? r : t;
  return kind + " · " + Math.round(num(c.width)) + "%";
};

function build() {
  dlg = document.createElement("dialog");
  dlg.id = "columnsDialog"; dlg.className = "cs-dialog";
  dlg.setAttribute("aria-labelledby", "csTitle");
  dlg.innerHTML = `<div class="cs-inner">
    <header class="cs-head"><div><h2 id="csTitle">Table columns</h2><p class="cs-sub" id="csSub"></p></div>
      <button type="button" class="cs-icon-btn" data-cs="close" aria-label="Close">${ICON.close}</button></header>
    <p class="cs-hint">Drag a card to reorder. Tap a card to edit it.</p>
    <div class="cs-strip" id="csStrip" role="list" aria-label="Columns in table order"></div>
    <section class="cs-editor" id="csEditor" aria-label="Selected column"></section>
    <footer class="cs-foot"><button type="button" class="btn" data-cs="add">${ICON.plus}Add column</button><button type="button" class="btn primary" data-cs="close">Done</button></footer>
    <span class="visually-hidden" id="csLive" aria-live="polite"></span>
  </div>`;
  document.body.appendChild(dlg);

  dlg.addEventListener("click", e => {
    if (e.target === dlg) { close(); return; }                      // click on the backdrop
    const b = e.target.closest("[data-cs]");
    if (!b) return;
    const act = b.dataset.cs;
    if (act === "close") close();
    else if (act === "add") { api.addColumn(); selKey = state.columns[state.columns.length - 1].key; render(); focusName(); announce("Column added"); }
    else if (act === "select") { selKey = b.closest(".cs-card").dataset.key; render(); }
    else if (act === "vis") toggleVisible(b.closest(".cs-card").dataset.key);
    else if (act === "left" || act === "right") move(selKey, act === "left" ? -1 : 1);
    else if (act === "remove") {
      const c = col(selKey); if (!c) return;
      if (!confirm(`Remove the "${c.label}" column? Its values on every line item are removed too.`)) return;
      const i = state.columns.indexOf(c);
      api.removeColumn(c.key);
      if (!col(c.key)) { selKey = (state.columns[Math.min(i, state.columns.length - 1)] || {}).key; announce("Column removed"); }
      render();
    } else if (act === "align") {
      const c = col(selKey); if (!c) return; c.align = b.dataset.v; commit(); render();
    }
  });
  dlg.addEventListener("input", onField);
  dlg.addEventListener("change", onField);
  dlg.addEventListener("keydown", e => {
    const grip = e.target.closest(".cs-grip");
    if (grip && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
      e.preventDefault();
      const key = grip.closest(".cs-card").dataset.key;
      move(key, e.key === "ArrowLeft" ? -1 : 1, true);
    }
  });
  dlg.addEventListener("close", () => { if (lastTrigger && lastTrigger.isConnected) lastTrigger.focus(); });
  dlg.addEventListener("pointerdown", onPointerDown);
}

function onField(e) {
  const el = e.target.closest("[data-f]"); if (!el) return;
  const c = col(selKey); if (!c) return;
  const f = el.dataset.f;
  if (f === "label") {
    if (e.type === "change" && !el.value.trim()) el.value = "Column";
    c.label = el.value || (e.type === "change" ? "Column" : c.label);
    refreshCard(c); api.save(); api.renderPreview();
    return;
  }
  if (f === "visible") { toggleVisible(c.key); return; }
  if (f === "type") c.type = el.value;
  else if (f === "role") { api.setRole(c, el.value); if (el.value === "tax") { c.type = "percentage"; if (c.align === "left") c.align = "right"; } }
  else if (f === "width") {
    if (e.type === "input" && el.type === "text" && el.value.trim() === "") return;
    c.width = Math.max(5, Math.min(80, Math.round(num(el.value)) || c.width));
    dlg.querySelectorAll('[data-f="width"]').forEach(x => { if (x !== el || e.type === "change") x.value = Math.round(c.width); });
    refreshCard(c); commit();
    return;
  }
  commit(); render();
}

function toggleVisible(key) {
  const c = col(key); if (!c) return;
  if (c.visible && visibleCount() <= 1) { announce("At least one column must stay visible"); return; }
  c.visible = !c.visible; commit(); render();
  announce(`${c.label} ${c.visible ? "shown" : "hidden"}`);
}

function move(key, dir, keepFocusOnGrip) {
  const i = state.columns.findIndex(c => c.key === key), j = i + dir;
  if (i < 0 || j < 0 || j >= state.columns.length) return;
  const [m] = state.columns.splice(i, 1); state.columns.splice(j, 0, m);
  commit(); render();
  announce(`${m.label} moved to position ${j + 1} of ${state.columns.length}`);
  if (keepFocusOnGrip) { const g = dlg.querySelector(`.cs-card[data-key="${CSS.escape(key)}"] .cs-grip`); if (g) g.focus(); }
}

function cardHtml(c) {
  const on = c.key === selKey;
  return `<div class="cs-card${on ? " is-sel" : ""}${c.visible ? "" : " is-off"}" role="listitem" data-key="${esc(c.key)}" style="--w:${Math.max(5, Math.round(num(c.width)))}">
    <span class="cs-grip" tabindex="0" role="button" aria-label="Reorder ${esc(c.label)}. Use left and right arrow keys" title="Drag to reorder">${ICON.grip}</span>
    <button type="button" class="cs-card-main" data-cs="select" aria-pressed="${on}"><strong>${esc(c.label)}</strong><small>${esc(meta(c))}</small></button>
    <button type="button" class="cs-vis" data-cs="vis" aria-pressed="${c.visible}" aria-label="${c.visible ? "Hide" : "Show"} ${esc(c.label)}" title="${c.visible ? "Visible — click to hide" : "Hidden — click to show"}">${c.visible ? ICON.eye : ICON.eyeOff}</button>
  </div>`;
}
function refreshCard(c) {
  const card = dlg.querySelector(`.cs-card[data-key="${CSS.escape(c.key)}"]`); if (!card) return;
  card.querySelector("strong").textContent = c.label;
  card.querySelector("small").textContent = meta(c);
  card.style.setProperty("--w", Math.max(5, Math.round(num(c.width))));
}

function render() {
  if (!dlg) return;
  if (!col(selKey)) selKey = (state.columns[0] || {}).key;
  dlg.querySelector("#csSub").textContent = `${visibleCount()} of ${state.columns.length} shown on the document`;
  dlg.querySelector("#csStrip").innerHTML = state.columns.map(cardHtml).join("");
  const c = col(selKey), ed = dlg.querySelector("#csEditor");
  if (!c) { ed.innerHTML = ""; return; }
  const i = state.columns.indexOf(c), w = Math.round(num(c.width));
  const active = document.activeElement && ed.contains(document.activeElement) ? document.activeElement.dataset.f : null;
  ed.innerHTML = `<div class="cs-ed-row">
      <div class="cs-field cs-grow"><label for="csName">Column name</label><input id="csName" class="fe-input" data-f="label" value="${esc(c.label)}" autocomplete="off"></div>
      <label class="cs-switch"><input type="checkbox" data-f="visible"${c.visible ? " checked" : ""}><span>Show</span></label>
    </div>
    <div class="cs-ed-grid">
      <div class="cs-field"><label for="csType">Type</label><select id="csType" class="fe-input" data-f="type">${opts(TYPES, c.type)}</select></div>
      <div class="cs-field"><label for="csRole">Calculation</label><select id="csRole" class="fe-input" data-f="role">${opts(ROLES, c.role)}</select></div>
      <div class="cs-field"><span class="cs-lab" id="csAlignLab">Align</span><div class="cs-seg" role="group" aria-labelledby="csAlignLab">${ALIGNS.map(([k, t]) => `<button type="button" data-cs="align" data-v="${k}" aria-pressed="${c.align === k}">${t}</button>`).join("")}</div></div>
      <div class="cs-field"><label for="csWidth">Width</label><div class="cs-wrow"><input id="csWidth" class="fe-range" type="range" min="5" max="80" step="1" data-f="width" value="${w}"><span class="fe-affix fe-suffix"><input class="fe-input fe-num" type="text" inputmode="numeric" data-f="width" value="${w}" aria-label="Width percent"><span class="fe-aff" aria-hidden="true">%</span></span></div></div>
    </div>
    <div class="cs-ed-actions">
      <button type="button" class="btn small" data-cs="left"${i === 0 ? " disabled" : ""} aria-label="Move column left">${ICON.left}Move left</button>
      <button type="button" class="btn small" data-cs="right"${i === state.columns.length - 1 ? " disabled" : ""} aria-label="Move column right">Move right${ICON.right}</button>
      <button type="button" class="btn small danger cs-remove" data-cs="remove">Remove column</button>
    </div>`;
  if (active) { const el = ed.querySelector(`[data-f="${active}"]`); if (el) el.focus(); }
}
function focusName() { const n = dlg && dlg.querySelector("#csName"); if (n) { n.focus(); n.select(); } }

/* ---- drag to reorder (pointer events: mouse, pen and touch) ---- */
let drag = null;
function onPointerDown(e) {
  if (e.button !== 0) return;
  const card = e.target.closest(".cs-card"); if (!card) return;
  if (e.target.closest(".cs-vis")) return;                       // the eye toggle is just a button
  drag = { card, key: card.dataset.key, x0: e.clientX, y0: e.clientY, id: e.pointerId, on: false, fromGrip: !!e.target.closest(".cs-grip") };
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onUp);
}
function indicator() {
  let ind = dlg.querySelector(".cs-drop");
  if (!ind) { ind = document.createElement("div"); ind.className = "cs-drop"; ind.setAttribute("aria-hidden", "true"); dlg.querySelector("#csStrip").appendChild(ind); }
  return ind;
}
function onMove(e) {
  if (!drag || e.pointerId !== drag.id) return;
  const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
  if (!drag.on) {
    if (Math.hypot(dx, dy) < (drag.fromGrip ? 2 : 6)) return;
    drag.on = true; drag.card.classList.add("is-drag"); dlg.classList.add("cs-dragging");
    try { drag.card.setPointerCapture(drag.id); } catch {}
  }
  e.preventDefault();
  drag.card.style.transform = `translate(${dx}px,${dy}px)`;
  const strip = dlg.querySelector("#csStrip"), sr = strip.getBoundingClientRect();
  const cards = [...strip.querySelectorAll(".cs-card")].filter(c => c !== drag.card);
  let best = null, bd = Infinity;
  cards.forEach(c => {
    const r = c.getBoundingClientRect();
    const cx = Math.max(r.left, Math.min(e.clientX, r.right)), cy = Math.max(r.top, Math.min(e.clientY, r.bottom));
    const d = Math.hypot(e.clientX - cx, (e.clientY - cy) * 2);
    if (d < bd) { bd = d; best = c; }
  });
  const ind = indicator();
  if (!best) { ind.style.display = "none"; drag.target = null; return; }
  const r = best.getBoundingClientRect(), before = e.clientX < r.left + r.width / 2;
  drag.target = best.dataset.key; drag.before = before;
  ind.style.display = "block";
  ind.style.left = ((before ? r.left : r.right) - sr.left + strip.scrollLeft - 2 + (before ? -4 : 4)) + "px";
  ind.style.top = (r.top - sr.top + strip.scrollTop) + "px";
  ind.style.height = r.height + "px";
}
function onUp(e) {
  if (!drag || e.pointerId !== drag.id) return;
  const d = drag; drag = null;
  window.removeEventListener("pointermove", onMove);
  window.removeEventListener("pointerup", onUp);
  window.removeEventListener("pointercancel", onUp);
  try { d.card.releasePointerCapture(d.id); } catch {}
  dlg.classList.remove("cs-dragging");
  const ind = dlg.querySelector(".cs-drop"); if (ind) ind.style.display = "none";
  if (!d.on) {
    // A plain tap/click: select the card (unless it landed on its own button, which handles itself).
    if (e.type === "pointerup" && d.card.contains(e.target) && !e.target.closest("button")) { selKey = d.key; render(); }
    return;
  }
  d.card.classList.remove("is-drag"); d.card.style.transform = "";
  // Swallow the click that follows a drag so it doesn't also select.
  const swallow = ev => { ev.stopPropagation(); ev.preventDefault(); };
  dlg.addEventListener("click", swallow, { capture: true, once: true });
  setTimeout(() => dlg.removeEventListener("click", swallow, { capture: true }), 0);
  if (e.type !== "pointerup" || !d.target || d.target === d.key) { render(); return; }
  const from = state.columns.findIndex(c => c.key === d.key);
  const [m] = state.columns.splice(from, 1);
  let to = state.columns.findIndex(c => c.key === d.target);
  state.columns.splice(d.before ? to : to + 1, 0, m);
  selKey = m.key;
  commit(); render();
  announce(`${m.label} moved to position ${state.columns.indexOf(m) + 1}`);
}

export function openColumnsDialog(trigger, key) {
  if (!dlg) build();
  lastTrigger = trigger || document.activeElement;
  if (key) selKey = key;
  render();
  if (!dlg.open) { if (typeof dlg.showModal === "function") dlg.showModal(); else dlg.setAttribute("open", ""); }
  const first = dlg.querySelector(".cs-card.is-sel .cs-card-main"); if (first) first.focus();
}
export function close() { if (dlg && dlg.open) { if (typeof dlg.close === "function") dlg.close(); else dlg.removeAttribute("open"); } }
/* Keep the dialog in step with undo/redo or canvas edits while it's open. */
export function syncColumnsDialog() { if (dlg && dlg.open && !drag && !dlg.contains(document.activeElement)) render(); }
export function initColumnsDialog(callbacks) { api = callbacks; }
