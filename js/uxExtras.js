// uxExtras.js — small UI/UX helpers: phone "More" actions menu, mobile balance
// strip, visual template picker, saved-invoice search/filter chips, first-run
// guidance and a gentle pre-print check. Presentation/guidance only: every
// control it wraps still drives the same inputs/handlers as before.

import { $ } from "./dom.js";
import { state } from "./state.js";
import { calc } from "./calc.js";

const phone = window.matchMedia("(max-width:640px)");
const safe = fn => { try { return fn(); } catch { return undefined; } };

/* ---- Phone header: "More" menu for the secondary actions ------------------ */
export function initMoreMenu() {
  const btn = $("moreActionsBtn"), panel = $("actionsSecondary");
  if (!btn || !panel) return;
  let lastW = window.innerWidth;
  const close = () => { panel.classList.remove("open"); btn.setAttribute("aria-expanded", "false"); };
  const open = () => {
    const r = btn.getBoundingClientRect();
    panel.style.setProperty("--more-top", Math.round(r.bottom + 8) + "px");
    panel.style.setProperty("--more-right", Math.max(12, Math.round(window.innerWidth - r.right)) + "px");
    panel.classList.add("open"); btn.setAttribute("aria-expanded", "true");
  };
  btn.addEventListener("click", () => (panel.classList.contains("open") ? close() : open()));
  document.addEventListener("click", e => {
    if (!panel.classList.contains("open")) return;
    if (btn.contains(e.target)) return;
    if (panel.contains(e.target) && !e.target.closest(".btn")) return;
    close();
  });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && panel.classList.contains("open")) { close(); btn.focus(); } });
  window.addEventListener("resize", () => { if (window.innerWidth !== lastW) { lastW = window.innerWidth; close(); place(); } });
  phone.addEventListener("change", () => { close(); place(); });
  // Where the button lives: phone → merged top bar; larger screens → next to Save / Print.
  const place = () => {
    const bar = $("mobileViewToggle"), prim = document.querySelector(".actions-primary"), fs = $("expandPreviewBtn");
    if (phone.matches && bar && fs) { if (btn.parentElement !== bar) bar.insertBefore(btn, fs); }
    else if (prim) { if (btn.parentElement !== prim) prim.appendChild(btn); }
  };
  place();
}

/* ---- Design panel: only the template picker starts open (sections already
   collapse on heading tap — see layout.js) ------------------------------- */
export function initPanelAccordion() {
  document.querySelectorAll("#rightSidebar > .panel").forEach((p, i) => { if (i > 0) p.classList.add("collapsed"); });
}

/* ---- Mobile balance strip (mirrors the invoice's balance due) -------------- */
export function syncMobileTotal() {
  const amt = $("mtAmount"), lab = $("mtLabel"), src = $("pBalance"), srcLab = $("labelBalance");
  if (!amt || !src) return;
  if (amt.textContent !== src.textContent) amt.textContent = src.textContent;
  const t = (srcLab && (srcLab.value || srcLab.placeholder)) || "Balance due";
  if (lab && lab.textContent !== t) lab.textContent = t;
  syncJumpNav();
}

/* ---- Jump to top / bottom — only for long invoices (many line items) ------- */
let jump = null, jumpRaf = 0;
function buildJump() {
  jump = document.createElement("div"); jump.className = "jump-nav"; jump.hidden = true;
  const ic = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="${d}"/></svg>`;
  jump.innerHTML = `<button type="button" id="jumpTop" title="Jump to top" aria-label="Jump to top">${ic("m18 15-6-6-6 6")}</button><button type="button" id="jumpBottom" title="Jump to bottom" aria-label="Jump to bottom">${ic("m6 9 6 6 6-6")}</button>`;
  document.body.appendChild(jump);
  const go = top => window.scrollTo({ top: top ? 0 : document.documentElement.scrollHeight, behavior: matchMedia("(prefers-reduced-motion:reduce)").matches ? "auto" : "smooth" });
  jump.querySelector("#jumpTop").addEventListener("click", () => go(true));
  jump.querySelector("#jumpBottom").addEventListener("click", () => go(false));
  const onScroll = () => { if (!jumpRaf) jumpRaf = requestAnimationFrame(() => { jumpRaf = 0; syncJumpNav(); }); };
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
}
export function syncJumpNav() {
  if (!jump) { if (!document.body) return; buildJump(); }
  const doc = document.documentElement, max = doc.scrollHeight - innerHeight;
  const long = state.items.length >= 6 && max > innerHeight * 1.2;
  jump.hidden = !long;
  if (!long) return;
  const y = scrollY;
  jump.querySelector("#jumpTop").hidden = y < 240;
  jump.querySelector("#jumpBottom").hidden = y > max - 240;
}

/* ---- Visual template picker ------------------------------------------------ */
export function syncTemplateGallery() {
  const gal = $("templateGallery"), sel = $("template");
  if (!gal || !sel) return;
  if (!gal.dataset.built) {
    gal.dataset.built = "1";
    gal.innerHTML = [...sel.querySelectorAll("optgroup")].map(g =>
      `<div class="tpl-group-label">${g.label}</div><div class="tpl-grid">` + [...g.querySelectorAll("option")].map(o =>
        `<button type="button" class="tpl-card" role="radio" data-value="${o.value}" aria-checked="false" tabindex="-1">` +
        `<img src="img/templates/${o.value}.webp" alt="" width="120" height="170" loading="lazy" decoding="async"><span>${o.textContent}</span></button>`).join("") + `</div>`).join("");
    const pick = btn => {
      if (sel.value === btn.dataset.value) return;
      sel.value = btn.dataset.value; sel.dispatchEvent(new Event("change", { bubbles: true }));
    };
    gal.addEventListener("click", e => { const b = e.target.closest(".tpl-card"); if (b) pick(b); });
    gal.addEventListener("keydown", e => {
      const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
      if (!(e.key in keys)) return;
      const cards = [...gal.querySelectorAll(".tpl-card")], i = cards.indexOf(document.activeElement);
      if (i < 0) return;
      e.preventDefault();
      const next = cards[(i + keys[e.key] + cards.length) % cards.length];
      next.focus(); pick(next);
    });
  }
  gal.querySelectorAll(".tpl-card").forEach(b => {
    const on = b.dataset.value === sel.value;
    b.setAttribute("aria-checked", on ? "true" : "false");
    b.tabIndex = on ? 0 : -1;
    b.classList.toggle("active", on);
  });
}

/* ---- Saved invoices: search + status chips ---------------------------------- */
export function initHistoryFilters(rerender) {
  const chips = $("historyChips"), search = $("historySearch"), status = $("status");
  if (!chips || !search) return;
  if (status) {
    const seen = new Set();
    chips.innerHTML = '<button type="button" class="chip active" data-status="" aria-pressed="true">All</button>' +
      [...status.options].map(o => o.value).filter(v => v && !seen.has(v) && seen.add(v))
        .map(v => `<button type="button" class="chip" data-status="${v.replace(/"/g, "&quot;")}" aria-pressed="false">${v}</button>`).join("");
  }
  chips.addEventListener("click", e => {
    const c = e.target.closest(".chip"); if (!c) return;
    chips.querySelectorAll(".chip").forEach(x => { const on = x === c; x.classList.toggle("active", on); x.setAttribute("aria-pressed", on ? "true" : "false"); });
    rerender();
  });
  search.addEventListener("input", () => rerender());
}

/* ---- First-run guidance ------------------------------------------------------ */
const FIRST_RUN_KEY = "invoiceStudio.firstRunDismissed";
export function initFirstRun() {
  const el = $("firstRun"); if (!el) return;
  const dismissed = () => safe(() => localStorage.getItem(FIRST_RUN_KEY) === "1") === true;
  const dismiss = () => { safe(() => localStorage.setItem(FIRST_RUN_KEY, "1")); el.hidden = true; };
  const blank = () => !$("clientName").value.trim() && !state.items.length;
  const refresh = () => {
    if (dismissed()) { el.hidden = true; return; }
    if (touched || !blank()) { if (touched) dismiss(); else el.hidden = true; return; }   // user started typing: never show again
    el.hidden = false;
  };
  let touched = false;
  $("firstRunDismiss").addEventListener("click", dismiss);
  document.addEventListener("input", () => { touched = true; setTimeout(refresh, 0); });
  window.addEventListener("invoicestudio:autosaved", refresh);
  refresh();
}

/* ---- Gentle pre-print check -------------------------------------------------- */
export function confirmPrint() {
  const issues = [];
  if (!$("clientName").value.trim()) issues.push("the client name is empty");
  if (!(calc().total > 0)) issues.push("the total is zero");
  if (!issues.length) return true;
  return confirm(`Before printing: ${issues.join(" and ")}.\n\nPrint anyway?`);
}
