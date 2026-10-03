// dom.js — tiny zero-dependency DOM/string helpers used throughout the app.

export const $ = id => document.getElementById(id);

export function uid() {
  if (window.crypto && typeof crypto.randomUUID === "function") {
    try { return crypto.randomUUID(); } catch {}
  }
  return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
}

export function esc(v) {
  return String(v ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

// Only embedded raster/SVG data URLs are accepted as a logo. Anything else
// (a remote URL or other scheme smuggled in via an imported .json/localStorage
// entry) is dropped, so opening a file can never make the app contact a server.
export function safeLogo(v) {
  return typeof v === "string" && v.length <= 6e6 && /^data:image\/(png|jpe?g|webp|gif|svg\+xml);base64,[A-Za-z0-9+/=]+$/i.test(v) ? v : "";
}
