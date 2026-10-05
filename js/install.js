// install.js — the "Install this app" notice and service worker registration.
//
// Installation is NOT one API that works everywhere, so this decides what to
// show by what the browser actually supports:
//
//   1. Native prompt (Chromium: Chrome, Edge, Samsung Internet, Opera…).
//      The browser fires `beforeinstallprompt` once it judges the app
//      installable. The event is kept until the person taps Install, and
//      .prompt() is then called directly inside that click (a real user
//      gesture, as the API requires). The event may fire before this module
//      runs, so an early listener in index.html's <head> stashes it on
//      window.__installPromptEvent and this module adopts it.
//
//   2. Manual instructions (browsers with no beforeinstallprompt at all —
//      detected by feature test, not by waiting for an event that will never
//      come): iOS/iPadOS (Share → Add to Home Screen), Safari 17+ on macOS
//      (File → Add to Dock), Firefox for Android (menu → Install). The
//      notice only describes the browser's own UI; there is no Install
//      button, because none of these allow triggering it from script.
//
//   3. Nothing: Firefox desktop (no PWA install support), a Chromium browser
//      that hasn't fired the event (already installed, criteria unmet, or
//      recently dismissed natively — the browser's own address-bar/menu
//      install entry still works there), or any unrecognised browser.
//
// The notice is never shown when already running as an installed app, and is
// application UI only: it is hidden for print/print preview (css/print.css
// plus the beforeprint/afterprint handling below) and restored afterwards.

import { $ } from "./dom.js";
import { toast } from "./toast.js";

const DISMISS_KEY = "invoiceStudio.installDismissedAt";
const LEGACY_DISMISS_KEY = "invoiceStudio.installDismissed";   // old permanent flag — ignored now
const DISMISS_DAYS = 14;

function isStandalone() {
  try {
    if (window.navigator.standalone === true) return true;   // iOS home-screen app
    return ["standalone", "window-controls-overlay", "minimal-ui", "fullscreen"]
      .some(m => window.matchMedia(`(display-mode: ${m})`).matches);
  } catch { return false; }
}

function recentlyDismissed() {
  try {
    const t = Number(localStorage.getItem(DISMISS_KEY));
    return !!t && Date.now() - t < DISMISS_DAYS * 864e5;
  } catch { return false; }
}

// Returns the manual-install instructions for this browser, or null when
// there is no in-browser install route worth describing.
function manualInstallHint() {
  const ua = navigator.userAgent || "";
  const touchMac = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;   // iPadOS reports a Mac UA
  if (/iPad|iPhone|iPod/.test(ua) || touchMac) {
    // Every iOS browser is WebKit and offers Share → Add to Home Screen.
    return "To install, tap the Share button, then “Add to Home Screen”.";
  }
  if (/Android/.test(ua) && /Firefox\//.test(ua)) {
    return "To install, open the browser menu (⋮), then tap “Install”.";
  }
  const safari = /Version\/(\d+)[\d.]*.*Safari\//.exec(ua);
  if (/Macintosh/.test(ua) && safari && !/Chrome|Chromium|CriOS|FxiOS|Edg|OPR/.test(ua) && Number(safari[1]) >= 17) {
    return "To install, choose File ▸ Add to Dock in the menu bar.";
  }
  return null;   // Firefox desktop, unknown browsers, etc.
}

export function initInstallPrompt() {
  const banner = $("installBanner"), installBtn = $("installAppBtn"), dismissBtn = $("installDismissBtn"), text = $("installText");
  if (!banner) return;

  let deferredPrompt = window.__installPromptEvent || null;
  let printing = false;
  let installed = false;
  const hint = ("onbeforeinstallprompt" in window) ? null : manualInstallHint();

  // Single place that decides visibility from current state.
  const render = () => {
    const canNative = !!deferredPrompt;
    const canManual = !canNative && !!hint && window.isSecureContext;
    const show = !printing && !installed && !isStandalone() && !recentlyDismissed() && (canNative || canManual);
    if (show) {
      if (text) text.textContent = canNative ? "Install this app for quick access and offline use." : hint;
      if (installBtn) installBtn.classList.toggle("hidden", !canNative);
    }
    banner.classList.toggle("hidden", !show);
  };

  window.addEventListener("beforeinstallprompt", e => {
    e.preventDefault();          // keep the event so Install can trigger it from a real click
    deferredPrompt = e;
    render();
  });

  if (installBtn) installBtn.addEventListener("click", async () => {
    const ev = deferredPrompt;
    if (!ev) return;
    deferredPrompt = null;       // a prompt event can only be used once
    window.__installPromptEvent = null;
    try {
      ev.prompt();               // called synchronously inside the click
      const choice = await ev.userChoice;
      if (choice && choice.outcome === "accepted") toast("Installing…");
      else try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch {}
    } catch (err) {
      console.warn("Install prompt failed:", err);
    }
    render();
  });

  if (dismissBtn) dismissBtn.addEventListener("click", () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); localStorage.removeItem(LEGACY_DISMISS_KEY); } catch {}
    render();
  });

  window.addEventListener("appinstalled", () => {
    installed = true;
    deferredPrompt = null;
    window.__installPromptEvent = null;
    render();
    toast("InvoGen installed.");
  });

  // Hide as soon as the app is running as an installed window.
  try {
    ["standalone", "window-controls-overlay"].forEach(m => {
      const mq = window.matchMedia(`(display-mode: ${m})`);
      (mq.addEventListener ? mq.addEventListener.bind(mq, "change") : mq.addListener.bind(mq))(render);
    });
  } catch {}

  // Print lifecycle: the banner is application UI and must never be part of
  // print/print preview (Edge's Ctrl+P preview included). css/print.css hides
  // it outright; this also takes it out of the DOM flow while printing and
  // puts it back afterwards. Both beforeprint/afterprint and the print media
  // query are used, since browsers differ in which they fire for preview.
  const setPrinting = on => { printing = on; render(); };
  window.addEventListener("beforeprint", () => setPrinting(true));
  window.addEventListener("afterprint", () => setPrinting(false));
  try {
    const pmq = window.matchMedia("print");
    const onChange = e => setPrinting(e.matches);
    if (pmq.addEventListener) pmq.addEventListener("change", onChange); else pmq.addListener(onChange);
  } catch {}

  render();
}

export function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    // When a new version takes over an already-controlled page, reload once so
    // the phone runs the new code straight away instead of the old modules.
    const hadController = !!navigator.serviceWorker.controller;
    let reloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!hadController || reloaded) return;
      const a = document.activeElement;
      if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return; // never interrupt typing
      reloaded = true; location.reload();
    });
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).catch(err => console.warn("Service worker registration failed:", err));
    });
  }
}
