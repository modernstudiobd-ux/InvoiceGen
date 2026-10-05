// accent.js — the invoice's accent color (used across CSS via --accent / --accent-rgb).

import { $ } from "./dom.js";

export function safeColor(v) {
  return /^#[0-9a-f]{6}$/i.test(v) ? v : "#2563eb";
}

export function setAccent(v) {
  v = safeColor(v);
  let h = v.slice(1), rgb = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)).join(",");
  // Scoped to #invoice (not the document root) so this only ever affects the
  // invoice design — never the app's own sidebar/editor chrome.
  $("invoice").style.setProperty("--accent", v);
  $("invoice").style.setProperty("--accent-rgb", rgb);
  $("accent").value = v;
  $("accentHex").value = v;
}

// Optional overrides, independent of the accent color: Total due color, and
// Header background/Header text/Invoice area background. Each pairs a hex
// text field (the stored value — empty means "no override, use the
// template's own default") with a color-picker swatch (a convenience input,
// not itself persisted). All are scoped to #invoice, same as setAccent above.
const OPTIONAL_COLOR_VARS = {
  totalColor: { cssVar: "--total-color", hostClass: null },
  headerColor: { cssVar: "--header-bg", hostClass: "has-header-bg" },
  headerTextColor: { cssVar: "--header-text", hostClass: "has-header-text" },
  invoiceColor: { cssVar: "--invoice-bg", hostClass: null },
  // Balance due LABEL (not the amount): see applyBalanceLabelColor below.
  balanceLabelColor: { cssVar: "--balance-label-color", hostClass: "has-balance-label" }
};

// Each template's own actual default for these four settings — must stay in
// sync with the CSS fallbacks in css/invoice.css and css/templates.css
// (search for var(--total-color, / var(--header-bg, / var(--invoice-bg,).
// Used only to make the *swatches* below show a template's real current
// color (Luxury's gold, Medical's teal, Corporate's navy, Dark's near-black
// canvas, etc.) whenever no override is set, instead of an arbitrary
// leftover value — so switching templates makes it obvious what a template's
// distinct palette actually is, and the picker starts from the right color
// if the person wants to adjust it. Not used for "Header text" (composed of
// several differently-colored elements) beyond the company name's own color,
// the most prominent header text element.
const TEMPLATE_DEFAULT_COLORS = {
  modern: { total: "#18181b", headerBg: "#ffffff", headerText: "#1f2937", invoiceBg: "#ffffff" },
  classic: { total: "#1f2937", headerBg: "#ffffff", headerText: "#1f2937", invoiceBg: "#ffffff" },
  compact: { total: "#18181b", headerBg: "#ffffff", headerText: "#1f2937", invoiceBg: "#ffffff" },
  apple: { total: "#18181b", headerBg: "#ffffff", headerText: "#1d1d1f", invoiceBg: "#ffffff" },
  corporate: { total: "#0b2545", headerBg: "#ffffff", headerText: "#0b2545", invoiceBg: "#ffffff" },
  luxury: { total: "#b08d57", headerBg: "#ffffff", headerText: "#2a231c", invoiceBg: "#ffffff" },
  agency: { total: "#ffffff", headerBg: "#ffffff", headerText: "#1f2937", invoiceBg: "#ffffff" },
  construction: { total: "#f2b705", headerBg: "#ffffff", headerText: "#1f2430", invoiceBg: "#ffffff" },
  medical: { total: "#0f6a63", headerBg: "#f4fbfa", headerText: "#0f6a63", invoiceBg: "#ffffff" },
  legal: { total: "#1f2937", headerBg: "#ffffff", headerText: "#1f2937", invoiceBg: "#ffffff" },
  realestate: { total: "#2b2b28", headerBg: "#ffffff", headerText: "#2b2b28", invoiceBg: "#ffffff" },
  freelancer: { total: "#18181b", headerBg: "#ffffff", headerText: "#1f2937", invoiceBg: "#ffffff" },
  restaurant: { total: "#4b5320", headerBg: "#ffffff", headerText: "#3c3a2f", invoiceBg: "#fbf9f4" },
  retail: { total: "#ffffff", headerBg: "#ffffff", headerText: "#1f2937", invoiceBg: "#ffffff" },
  technology: { total: "#7ee7c7", headerBg: "#ffffff", headerText: "#1f2937", invoiceBg: "#ffffff" },
  manufacturing: { total: "#1f2733", headerBg: "#ffffff", headerText: "#1f2733", invoiceBg: "#ffffff" },
  dark: { total: "#ffffff", headerBg: "#ffffff", headerText: "#ffffff", invoiceBg: "#111318" }
};
const OPTIONAL_COLOR_DEFAULT_KEY = { totalColor: "total", headerColor: "headerBg", headerTextColor: "headerText", invoiceColor: "invoiceBg" };

// ---- Balance due label: automatic, contrast-aware colour -----------------
// WCAG 2.x relative luminance / contrast ratio.
const AA = 4.5, AA_TARGET = 4.6; // small margin so rounding to hex never dips below 4.5
const lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
function parseRgba(str) {
  const m = String(str).match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const p = m[1].split(/[\s,\/]+/).filter(Boolean).map(Number);
  return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
}
const over = (fg, bg) => [0, 1, 2].map(i => fg[i] * fg[3] + bg[i] * (1 - fg[3]));
// The colour the label really sits on: its box's background composited over
// every ancestor's (backgrounds can be translucent, e.g. rgba(accent, .16)).
function effectiveBackground(el) {
  const layers = [];
  for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
    const c = parseRgba(getComputedStyle(n).backgroundColor);
    if (c && c[3] > 0) { layers.push(c); if (c[3] >= 1) break; }
  }
  let base = [255, 255, 255];
  for (let i = layers.length - 1; i >= 0; i--) base = over(layers[i], base);
  return base;
}
const toHex = rgb => "#" + rgb.map(v => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("");
// Keep the template's own label colour when it is already readable; otherwise
// move it (keeping its hue) toward black or white, whichever reaches the
// target ratio with the smallest change.
function readable(fg, bg) {
  if (ratio(fg, bg) >= AA) return fg;
  let best = null;
  for (const target of [[0, 0, 0], [255, 255, 255]]) {
    for (let t = 0.02; t <= 1.0001; t += 0.02) {
      const c = fg.map((v, i) => v + (target[i] - v) * t);
      if (ratio(c, bg) >= AA_TARGET) { if (!best || t < best.t) best = { t, c }; break; }
    }
  }
  return best ? best.c : (lum(bg) > 0.179 ? [0, 0, 0] : [255, 255, 255]);
}

export function applyBalanceLabelColor() {
  const inv = $("invoice"), label = $("labelBalance"), swatch = $("balanceLabelColor");
  if (!inv || !label) return;
  const cfg = OPTIONAL_COLOR_VARS.balanceLabelColor;
  const hex = $("balanceLabelColorHex").value.trim();
  if (/^#[0-9a-f]{6}$/i.test(hex)) {             // user override: always respected
    inv.style.setProperty(cfg.cssVar, hex);
    inv.classList.add(cfg.hostClass);
    if (swatch) swatch.value = hex;
    return;
  }
  // Automatic: measure the template's own label colour and the box's real
  // background with the override layer switched off, then fix only if needed.
  inv.classList.remove(cfg.hostClass);
  inv.style.removeProperty(cfg.cssVar);
  const box = label.closest(".balance") || label;
  const bg = effectiveBackground(box);
  const fgRaw = parseRgba(getComputedStyle(label).color) || [0, 0, 0, 1];
  const auto = toHex(readable(over(fgRaw, bg), bg));
  inv.style.setProperty(cfg.cssVar, auto);
  inv.classList.add(cfg.hostClass);
  if (swatch) swatch.value = auto;
}

export function applyOptionalColor(id) {
  const cfg = OPTIONAL_COLOR_VARS[id];
  if (!cfg) return;
  if (id === "balanceLabelColor") return applyBalanceLabelColor();
  const invoice = $("invoice");
  const hex = $(id + "Hex").value.trim();
  if (/^#[0-9a-f]{6}$/i.test(hex)) {
    invoice.style.setProperty(cfg.cssVar, hex);
    $(id).value = hex;
    if (cfg.hostClass) invoice.classList.add(cfg.hostClass);
  } else {
    invoice.style.removeProperty(cfg.cssVar);
    if (cfg.hostClass) invoice.classList.remove(cfg.hostClass);
    // No override: show this template's own actual color in the swatch
    // (see TEMPLATE_DEFAULT_COLORS above) instead of leaving whatever the
    // previous template happened to show.
    const tplEl = $("template");
    const defaults = TEMPLATE_DEFAULT_COLORS[tplEl ? tplEl.value : "modern"] || TEMPLATE_DEFAULT_COLORS.modern;
    const key = OPTIONAL_COLOR_DEFAULT_KEY[id];
    if (key && defaults[key]) $(id).value = defaults[key];
  }
}

export function clearOptionalColor(id) {
  $(id + "Hex").value = "";
  applyOptionalColor(id);
}

export function applyAllOptionalColors() {
  // The label's automatic colour depends on the others (accent, invoice
  // background, template), so it is always resolved last.
  Object.keys(OPTIONAL_COLOR_VARS).filter(k => k !== "balanceLabelColor").forEach(applyOptionalColor);
  applyBalanceLabelColor();
}
