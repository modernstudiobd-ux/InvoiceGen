// pdfExport.js — "Download PDF". A PDF is produced by the browser's own print
// engine ("Save as PDF"), so it is pixel-identical to the printout: real,
// selectable text, embedded fonts, small files, fully offline. This module
// adds the friendly parts around it: a clear file name and a one-time guide
// with steps for the person's device.

import { $ } from "./dom.js";

const HIDE_KEY = "invoiceStudio.pdfGuideHidden";
const safe = fn => { try { return fn(); } catch { return null; } };

export function pdfFileName() {
  const num = ($("invoiceNumber").value || "").trim();
  const client = ($("clientName").value || "").trim();
  const title = ($("labelTitle") && ($("labelTitle").value || $("labelTitle").placeholder) || "Invoice").trim();
  const base = [num || title, client].filter(Boolean).join(" – ");
  return (base || "Invoice").replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "-").replace(/\s+/g, " ").slice(0, 120);
}

function platform() {
  const ua = navigator.userAgent || "", p = navigator.platform || "";
  const iOS = /iPhone|iPad|iPod/.test(ua) || (p === "MacIntel" && navigator.maxTouchPoints > 1);
  if (iOS) return "ios";
  if (/Android/i.test(ua)) return "android";
  if (/Firefox\//.test(ua)) return "firefox";
  if (/Safari\//.test(ua) && !/Chrome|Chromium|Edg\//.test(ua)) return "safari";
  return "chrome";
}

const STEPS = {
  chrome: ["Next to <strong>Destination</strong>, choose <strong>Save as PDF</strong>.", "Click <strong>Save</strong>, then pick where to keep the file."],
  firefox: ["Next to <strong>Destination</strong>, choose <strong>Save to PDF</strong>.", "Click <strong>Save</strong>, then pick where to keep the file."],
  safari: ["At the bottom-left, open the <strong>PDF</strong> menu.", "Choose <strong>Save as PDF</strong>, then click <strong>Save</strong>."],
  ios: ["In the print window, tap the <strong>Share</strong> button at the top.", "Tap <strong>Save to Files</strong> (or share it straight to Mail or WhatsApp)."],
  android: ["At the top, tap the printer name and choose <strong>Save as PDF</strong>.", "Tap the round <strong>PDF</strong> button, then <strong>Save</strong>."]
};

let onGo = null;
function dialogEl() {
  const d = $("pdfGuide");
  if (d && !d.dataset.wired) {
    d.dataset.wired = "1";
    d.addEventListener("click", e => {
      if (e.target === d) { close(); return; }
      const b = e.target.closest("[data-pdf]"); if (!b) return;
      if (b.dataset.pdf === "go") {
        if ($("pdfGuideHide").checked) safe(() => localStorage.setItem(HIDE_KEY, "1"));
        const go = onGo; close(); if (go) setTimeout(go, 50);
      } else close();
    });
  }
  return d;
}
function close() { const d = $("pdfGuide"); onGo = null; if (d && d.open) d.close(); }

/* Show the guide (unless hidden), then call `run`, which opens the print dialog. */
export function withPdfGuide(run) {
  const hidden = safe(() => localStorage.getItem(HIDE_KEY) === "1");
  const d = dialogEl();
  if (hidden || !d || typeof d.showModal !== "function") { run(); return; }
  const steps = STEPS[platform()] || STEPS.chrome;
  $("pdfGuideSteps").innerHTML = steps.map((t, i) => `<li><span class="imp-n" aria-hidden="true">${i + 1}</span><span>${t}</span></li>`).join("");
  const fn = pdfFileName();
  $("pdfGuideFile").textContent = "Suggested file name: " + fn + ".pdf";
  $("pdfGuideHide").checked = false;
  onGo = run;
  d.showModal();
  const go = d.querySelector('[data-pdf="go"]'); if (go) go.focus();
}
export function resetPdfGuide() { safe(() => localStorage.removeItem(HIDE_KEY)); }
