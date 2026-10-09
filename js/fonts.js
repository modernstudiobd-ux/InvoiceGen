// fonts.js — "Use a font installed on this device". Chromium desktop browsers
// can list installed fonts (Local Font Access API, with permission); every
// other browser can type a font name, which is checked live for availability.
// Chosen fonts are stored as "local:<Family>" in the normal Font field.

import { $, esc } from "./dom.js";

const RECENT = "invoiceStudio.localFonts.v1";
let api = null, families = null, chosen = "", prevValue = "";
const safe = fn => { try { return fn(); } catch { return null; } };

export function isLocalFont(v) { return typeof v === "string" && v.startsWith("local:") && v.length > 6; }
export const localFamily = v => String(v).slice(6).replace(/["\;{}<>]/g, "").trim();

/* Is the font installed? Compare text width against generic fallbacks. */
let ctx = null;
export function fontAvailable(name) {
  name = String(name || "").replace(/["\\]/g, "").trim(); if (!name) return false;
  ctx = ctx || document.createElement("canvas").getContext("2d");
  const t = "mmmmmmmmmmlli1WQ@#ÅÉ", out = [];
  for (const b of ["monospace", "serif", "sans-serif"]) {
    ctx.font = `64px ${b}`; const w0 = ctx.measureText(t).width;
    ctx.font = `64px "${name}", ${b}`; out.push(ctx.measureText(t).width !== w0);
  }
  return out.some(Boolean);
}

/* Make sure a "local:" value has an <option> so selects can show it. */
export function ensureLocalOption(v) {
  if (!isLocalFont(v)) return;
  const sel = $("invoiceFont"); if (!sel) return; const grp = sel.querySelector("optgroup[data-local-fonts]") || sel;
  if ([...sel.options].some(o => o.value === v)) return;
  const o = document.createElement("option"); o.value = v; o.textContent = localFamily(v) + " (this device)";
  grp.appendChild(o);
}
function remember(v) {
  const list = (safe(() => JSON.parse(localStorage.getItem(RECENT))) || []).filter(x => x !== v);
  list.unshift(v); safe(() => localStorage.setItem(RECENT, JSON.stringify(list.slice(0, 8))));
}

function setPreview(name) {
  const p = $("fontPreview");
  p.style.fontFamily = name ? `"${name.replace(/"/g, "")}", system-ui, sans-serif` : "";
}
function check() {
  const v = $("fontSearch").value.trim(), st = $("fontStatus"), use = $("fontUseBtn");
  setPreview(v);
  if (!v) { st.textContent = ""; st.className = "font-status"; use.disabled = true; chosen = ""; return; }
  const exact = families ? families.find(f => f.toLowerCase() === v.toLowerCase()) : null;
  const ok = exact ? true : fontAvailable(v);
  chosen = exact || v;
  st.textContent = ok ? `✓ "${chosen}" is installed on this device.` : `"${v}" wasn't found on this device. Check the spelling, or install the font first.`;
  st.className = "font-status " + (ok ? "ok" : "bad");
  use.disabled = !ok;
}
function renderList() {
  const ul = $("fontList"); if (!families) { ul.hidden = true; return; }
  const q = $("fontSearch").value.trim().toLowerCase();
  const items = families.filter(f => !q || f.toLowerCase().includes(q)).slice(0, 200);
  ul.hidden = false;
  ul.innerHTML = items.length ? items.map(f => `<li><button type="button" class="picker-item font-item" data-f="${esc(f)}" role="option" style="font-family:&quot;${esc(f)}&quot;,system-ui"><strong>${esc(f)}</strong><span>The quick brown fox · 1,234.50</span></button></li>`).join("")
    : '<li class="picker-empty">No installed font matches.</li>';
}
async function loadInstalled() {
  try {
    const fonts = await window.queryLocalFonts();
    families = [...new Set(fonts.map(f => f.family))].sort((a, b) => a.localeCompare(b));
    $("fontAccessBox").hidden = true;
    $("fontSearchLab").textContent = "Search your fonts";
    renderList(); $("fontSearch").focus();
  } catch { $("fontStatus").textContent = "Permission wasn't given — you can still type a font name."; }
}

export function openFontDialog() {
  const d = $("fontDialog");
  $("fontAccessBox").hidden = !(typeof window.queryLocalFonts === "function") || !!families;
  const recent = (safe(() => JSON.parse(localStorage.getItem(RECENT))) || []).map(localFamily);
  $("fontSearch").value = isLocalFont(prevValue) ? localFamily(prevValue) : (recent[0] || "");
  check(); renderList();
  d.showModal(); $("fontSearch").focus();
}
function commit(name) {
  const v = "local:" + name.replace(/["\;{}<>]/g, "").trim();
  ensureLocalOption(v); remember(v);
  const sel = $("invoiceFont"); sel.value = v; prevValue = v;
  sel.dispatchEvent(new Event("change", { bubbles: true }));
  $("fontDialog").close();
}

export function initFonts(callbacks) {
  api = callbacks;
  // Re-create options for recently used local fonts, so they're one click away.
  (safe(() => JSON.parse(localStorage.getItem(RECENT))) || []).forEach(ensureLocalOption);
  const sel = $("invoiceFont"); prevValue = sel.value;
  sel.addEventListener("change", e => {
    if (sel.value === "__local") { e.stopImmediatePropagation(); sel.value = prevValue; openFontDialog(); return; }
    prevValue = sel.value;
  }, true);
  const d = $("fontDialog");
  $("fontSearch").addEventListener("input", () => { check(); renderList(); });
  $("fontSearch").addEventListener("keydown", e => { if (e.key === "Enter" && !$("fontUseBtn").disabled) { e.preventDefault(); commit(chosen); } });
  $("fontAccessBtn").addEventListener("click", loadInstalled);
  $("fontUseBtn").addEventListener("click", () => { if (chosen) commit(chosen); });
  $("fontList").addEventListener("click", e => { const b = e.target.closest(".font-item"); if (b) { $("fontSearch").value = b.dataset.f; check(); commit(b.dataset.f); } });
  d.addEventListener("click", e => { if (e.target === d || e.target.closest("[data-close]")) d.close(); });
  window.addEventListener("invoicestudio:loaded", () => { prevValue = sel.value; });
}
