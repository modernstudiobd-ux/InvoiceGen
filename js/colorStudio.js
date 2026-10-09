// colorStudio.js — one simple, smart Colors panel:
//   1. Brand color  — 8 curated presets or any custom color
//   2. Color style  — Subtle / Accent / Bold
// The style decides where the brand color goes (totals, header, …) and every
// derived color is checked for readability (WCAG AA 4.5:1) against the real
// background it sits on, so no combination can produce unreadable text.
// The five individual overrides still exist under "Custom colors (advanced)";
// editing any of them switches the style to "Custom".

import { $ } from "./dom.js";
import { applyOptionalColor, effectiveBackground, readable, toHex, ratio, safeColor } from "./accent.js";

export const COLOR_PRESETS = [
  ["Ink", "#18181b"], ["Ocean", "#1d4ed8"], ["Teal", "#0f766e"], ["Forest", "#166534"],
  ["Burgundy", "#9f1239"], ["Amber", "#b45309"], ["Violet", "#6d28d9"], ["Slate", "#334155"]
];
const HINTS = {
  subtle: "The template's own colors, with your brand color on small details.",
  accent: "Your brand color on the totals and the balance due.",
  bold: "A header filled with your brand color. Text colors are chosen automatically so everything stays readable.",
  custom: "You're using custom colors (below). Choose a style to start fresh."
};
const IDS = ["totalColor", "headerColor", "headerTextColor", "balanceLabelColor", "invoiceColor"];
let api = null, applying = false;
const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const setHex = (id, v) => { const el = $(id + "Hex"); if (el) el.value = v; };

function currentStyle() {
  const v = $("colorStyle").value;
  if (v) return v;
  return IDS.some(id => ($(id + "Hex").value || "").trim()) ? "custom" : "subtle";
}
function syncUI() {
  const st = currentStyle(), brand = safeColor($("accentHex").value);
  $("colorStyleSeg").querySelectorAll("[data-style]").forEach(b => { const on = b.dataset.style === st; b.setAttribute("aria-checked", String(on)); b.tabIndex = on || (st === "custom" && b.dataset.style === "subtle") ? 0 : -1; });
  $("colorPresets").querySelectorAll(".preset").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.c.toLowerCase() === brand.toLowerCase())));
  const custom = !COLOR_PRESETS.some(([, c]) => c.toLowerCase() === brand.toLowerCase());
  const cl = document.querySelector(".preset-custom"); if (cl) { cl.classList.toggle("is-on", custom); cl.style.setProperty("--c", brand); }
  $("colorStyleSeg").style.setProperty("--brand", brand);
  $("colorStyleHint").textContent = HINTS[st] || "";
}

/* Apply the chosen style using the current brand color. */
export function applyColorStyle(style) {
  if (!["subtle", "accent", "bold"].includes(style)) { syncUI(); return; }
  applying = true;
  const brand = safeColor($("accentHex").value);
  IDS.forEach(id => setHex(id, ""));
  IDS.forEach(applyOptionalColor);              // back to template defaults first
  if (style === "bold") {
    const b = rgb(brand), white = [255, 255, 255], ink = [17, 24, 39];
    setHex("headerColor", brand);
    setHex("headerTextColor", ratio(white, b) >= ratio(ink, b) ? "#ffffff" : "#111827");
    applyOptionalColor("headerColor"); applyOptionalColor("headerTextColor");
  }
  if (style === "accent" || style === "bold") {
    // Totals: brand color, nudged darker/lighter only as much as needed for 4.5:1
    // against the actual background of the balance box in this template.
    const box = document.querySelector("#invoice .balance") || $("invoice");
    const bg = effectiveBackground(box);
    setHex("totalColor", toHex(readable(rgb(brand), bg)));
    applyOptionalColor("totalColor");
  }
  $("colorStyle").value = style;
  applying = false;
  syncUI();
}

export function initColorStudio(callbacks) {
  api = callbacks;
  const host = $("colorPresets");
  host.innerHTML = COLOR_PRESETS.map(([n, c]) => `<button type="button" class="preset" data-c="${c}" style="--c:${c}" title="${n}" aria-label="${n}" aria-pressed="false"></button>`).join("");
  const refresh = () => { applyColorStyle(currentStyle()); api.renderPreview(); api.save(); };
  host.addEventListener("click", e => {
    const b = e.target.closest(".preset"); if (!b) return;
    const hx = $("accentHex"); hx.value = b.dataset.c; hx.dispatchEvent(new Event("input", { bubbles: true }));
  });
  // Brand color changes re-run the current style (main.js has already applied the accent itself).
  ["accent", "accentHex"].forEach(id => $(id).addEventListener("input", () => { if (!applying && /^#[0-9a-f]{6}$/i.test($("accentHex").value)) refresh(); }));
  $("colorStyle").addEventListener("change", () => { if (!applying) refresh(); });
  const seg = $("colorStyleSeg");
  seg.addEventListener("click", e => { const b = e.target.closest("[data-style]"); if (!b) return; $("colorStyle").value = b.dataset.style; refresh(); });
  seg.addEventListener("keydown", e => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
    e.preventDefault();
    const order = ["subtle", "accent", "bold"], i = Math.max(0, order.indexOf(currentStyle()));
    const n = order[(i + (e.key === "ArrowLeft" || e.key === "ArrowUp" ? 2 : 1)) % 3];
    $("colorStyle").value = n; refresh(); seg.querySelector(`[data-style="${n}"]`).focus();
  });
  // Any manual advanced edit → style becomes "custom".
  IDS.forEach(id => ["", "Hex"].forEach(sfx => { const el = $(id + sfx); if (el) el.addEventListener("input", () => { if (!applying) { $("colorStyle").value = "custom"; syncUI(); api.save(); } }); }));
  IDS.forEach(id => { const c = $(id + "Clear"); if (c) c.addEventListener("click", () => { if (!applying) { $("colorStyle").value = "custom"; syncUI(); api.save(); } }); });
  $("resetColorBtn").addEventListener("click", () => setTimeout(() => { $("colorStyle").value = "subtle"; refresh(); }, 0));
  // Template switch: re-derive so readability is re-checked on the new template's backgrounds.
  $("template").addEventListener("change", () => setTimeout(() => { if (["accent", "bold"].includes(currentStyle())) refresh(); }, 0));
  window.addEventListener("invoicestudio:loaded", syncUI);
  syncUI();
}
export { syncUI as syncColorStudio };
