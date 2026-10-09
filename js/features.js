// features.js — v3.37.0 document features: payment terms, second tax,
// per-line tax, amount paid & balance, amount in words, document language,
// brand font, colour presets, footer text, watermark, signature/stamp,
// letterhead background, online payment link + QR code, and "Send to client".
//
// renderExtras() is called from preview.js on every render; everything else
// is wired once by initFeatures(). All data lives in the normal `fields` /
// state, so save, undo, Saved invoices, brand templates and print all work.

import { $, esc, safeLogo } from "./dom.js";
import { state, letterheadInsetsMm, templatePaddingMm } from "./state.js";
import { num, plusDays, today, dateFmt } from "./format.js";
import { amountInWords } from "./words.js";
import { applyLanguage, tr, netTerms } from "./i18n.js";
import { toast } from "./toast.js";
import qrcode from "./vendor/qrcode.js";

let api = null;  // { renderPreview, save, setAccent, printPdf }
const LH_KEY = "invoiceStudio.letterhead.v1";
const safe = fn => { try { return fn(); } catch { return null; } };
const lang = () => ($("docLanguage") && $("docLanguage").value) || "en";
const fire = (el, type = "input") => el && el.dispatchEvent(new Event(type, { bubbles: true }));

/* ------------------------------ helpers ------------------------------ */
function setText(id, t) { const el = $(id); if (el && el.textContent !== t) el.textContent = t; }
export function normalizeUrl(v) {
  let s = String(v || "").trim();
  if (!s) return "";
  if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) s = "https://" + s;
  try { const u = new URL(s); return /^https?:$/.test(u.protocol) && u.hostname.includes(".") ? u.href : ""; } catch { return ""; }
}
const FONT_STACK = {
  "Inter": '"InvCurSym","Inter","InvScript",system-ui,sans-serif', "Noto Sans": '"InvCurSym","Noto Sans","InvScript",sans-serif',
  "Montserrat": '"InvCurSym","Montserrat","InvScript",sans-serif', "PT Serif": '"InvCurSym","PT Serif","InvScript",Georgia,serif',
  "Lora": '"InvCurSym","Lora","InvScript",Georgia,serif', "Playfair Display": '"InvCurSym","Playfair Display","InvScript",Georgia,serif',
  "IBM Plex Mono": '"InvCurSym","IBM Plex Mono","InvScript",ui-monospace,monospace'
};
const PAY_PLACEHOLDER = {
  PayPal: "https://paypal.me/yourname", Stripe: "https://buy.stripe.com/…", Wise: "https://wise.com/pay/me/yourname",
  Payoneer: "https://link.payoneer.com/…", Square: "https://square.link/u/…", Revolut: "https://revolut.me/yourname", other: "https://…"
};

/* Downscale an uploaded image (keeps storage small; PNG keeps transparency). */
export function readImage(file, { maxW, maxH, type = "image/png", quality = 0.9 }) {
  return new Promise((res, rej) => {
    if (!file) return rej(Error("No file"));
    if (!/^image\//.test(file.type)) return rej(Error("Please choose an image file."));
    if (file.size > 12e6) return rej(Error("That image is too large (max 12 MB)."));
    const r = new FileReader();
    r.onerror = () => rej(Error("The image could not be read."));
    r.onload = () => {
      const img = new Image();
      img.onerror = () => rej(Error("The image could not be opened."));
      img.onload = () => {
        const s = Math.min(1, maxW / (img.naturalWidth || maxW), maxH / (img.naturalHeight || maxH));
        const w = Math.max(1, Math.round((img.naturalWidth || maxW) * s)), h = Math.max(1, Math.round((img.naturalHeight || maxH) * s));
        const c = document.createElement("canvas"); c.width = w; c.height = h;
        const g = c.getContext("2d");
        if (type === "image/jpeg") { g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); }
        g.drawImage(img, 0, 0, w, h);
        res(c.toDataURL(type, quality));
      };
      img.src = String(r.result);
    };
    r.readAsDataURL(file);
  });
}
export const getLetterhead = () => safeLogo(safe(() => localStorage.getItem(LH_KEY)) || "");
export function setLetterhead(v) {
  if (!v) { safe(() => localStorage.removeItem(LH_KEY)); return true; }
  try { localStorage.setItem(LH_KEY, v); return true; } catch { toast("Not enough storage for this letterhead — try a smaller image."); return false; }
}

/* QR code as crisp SVG (cached per link). */
let qrCache = { link: "", svg: "" };
function qrSvg(text) {
  if (qrCache.link === text) return qrCache.svg;
  const q = qrcode(0, "M"); q.addData(text); q.make();
  const n = q.getModuleCount(), m = 2; let d = "";
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c + m} ${r + m}h1v1h-1z`;
  const svg = `<svg viewBox="0 0 ${n + m * 2} ${n + m * 2}" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" role="img" aria-label="QR code for the payment link"><rect width="100%" height="100%" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
  qrCache = { link: text, svg };
  return svg;
}

/* Size short label inputs to their text, so long translations are never cut off. */
let measureCtx = null;
function fitInput(el) {
  if (!el || el.offsetParent === null) return;
  const cs = getComputedStyle(el), txt = el.value || el.placeholder || "";
  measureCtx = measureCtx || document.createElement("canvas").getContext("2d");
  measureCtx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  const ls = parseFloat(cs.letterSpacing) || 0;
  const w = Math.ceil(measureCtx.measureText(txt).width + ls * txt.length + parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) + 4);
  const px = Math.max(24, w) + "px";
  if (el.style.width !== px) el.style.width = px;
}
const FIT_IDS = ["labelInvoiceDate", "labelDueDate", "labelReference", "labelPayTerms", "labelTax", "labelTax2", "labelPaid"];
export function fitLabels() { FIT_IDS.forEach(id => fitInput($(id))); }

/* Document noun ("Invoice", "請求書", …) in the chosen document language. */
export function docNounL() { return tr(lang(), "noun", state.docType || "invoice"); }

/* ------------------------------ render ------------------------------ */
export function renderExtras(t) {
  const inv = $("invoice"); if (!inv) return;
  const L = lang(), doc = state.docType || "invoice", cur = $("currency").value;

  // Fixed summary words follow the document language.
  setText("sumLabSubtotal", tr(L, "subtotal")); setText("sumLabDiscount", tr(L, "discount"));
  setText("sumLabShipping", tr(L, "shipping")); setText("sumLabTotal", tr(L, "total"));
  setText("sumLabBalance", tr(L, "balanceRow")); setText("sumLabItemTax", tr(L, "itemTax")); setText("sumLabWords", tr(L, "words"));
  const lt = $("labelTax"); if (lt && L !== "en") lt.placeholder = tr(L, "tax");
  const no = $("invoiceNumber").value.trim() || "Untitled";
  setText("pFooterInvoice", tr(L, "noun", doc) + " #" + no);

  // Payment terms (shown as text in Preview/print).
  const pt = $("paymentTerms"), ptv = pt ? pt.value : "";
  setText("paymentTermsDisplay", ptv === "" ? "" : ptv === "0" ? tr(L, "receipt") : netTerms(L, ptv));
  const ptRow = document.querySelector('[data-section="payTerms"]'); if (ptRow) ptRow.classList.toggle("print-hide-empty", ptv === "");

  // Amount in words.
  setText("pAmountWords", amountInWords(t.total, cur));
  $("amountWordsRow").classList.toggle("print-hide-empty", !(t.total > 0));

  // Footer text.
  const ft = ($("footerText").value || "").trim();
  if (ft) setText("pFooterCompany", ft);

  // Watermark.
  const wm = $("watermark").value, wmText = wm === "custom" ? ($("watermarkText").value || "").trim() : wm;
  setText("pWatermark", wmText.toUpperCase());
  inv.classList.toggle("has-watermark", !!wmText);
  const wtf = $("watermarkTextField"); if (wtf) wtf.hidden = wm !== "custom";

  // Brand font.
  const f = $("invoiceFont").value;
  const stack = FONT_STACK[f] || (f.startsWith("local:") && f.length > 6 ? `"InvCurSym","${f.slice(6).replace(/["\\;{}<>]/g, "")}","InvScript",system-ui,sans-serif` : "");
  if (stack) { inv.style.setProperty("--inv-font", stack); inv.classList.add("has-font"); }
  else { inv.style.removeProperty("--inv-font"); inv.classList.remove("has-font"); }

  // Signature / stamp.
  const sig = $("pSignature"), hasSig = !!state.signature;
  if (hasSig) { if (sig.getAttribute("src") !== state.signature) sig.src = state.signature; } else sig.removeAttribute("src");
  sig.hidden = !hasSig;
  inv.style.setProperty("--sign-h", Math.max(32, Math.min(140, num($("signHeight").value) || 64)) + "px");
  $("signBox").classList.toggle("has-sign", hasSig);
  $("signBox").classList.toggle("print-hide-empty", !hasSig && !$("signName").value.trim());
  $("signName").placeholder = tr(L, "sign");
  const th = $("signThumb"); if (th) th.innerHTML = hasSig ? `<img src="${esc(state.signature)}" alt="">` : "";

  // Online payment link + QR.
  const link = normalizeUrl($("payLink").value), prov = $("payProvider").value;
  const box = $("payQrBox"), a = $("pPayLink");
  box.classList.toggle("has-link", !!link);
  box.classList.toggle("print-hide-empty", !link);
  if (link) {
    $("pPayQr").innerHTML = qrSvg(link);
    a.href = link; a.textContent = link.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
    setText("pPayTitle", tr(L, "payOnline") + (prov && prov !== "other" ? " · " + prov : ""));
    setText("pPayHint", tr(L, "scan"));
  } else { $("pPayQr").innerHTML = ""; a.removeAttribute("href"); a.textContent = ""; }

  requestAnimationFrame(fitLabels);

  // Letterhead background (stored once per device, switched on per document).
  const lh = $("useLetterhead").checked ? getLetterhead() : "";
  inv.classList.toggle("has-letterhead", !!lh);
  if (lh) inv.style.setProperty("--letterhead", `url("${lh}")`); else inv.style.removeProperty("--letterhead");
  const ins = letterheadInsetsMm(), pad = templatePaddingMm($("template").value);
  if (ins) { inv.style.paddingTop = pad.top + "mm"; inv.style.paddingBottom = pad.bottom + "mm"; }
  else { inv.style.paddingTop = ""; inv.style.paddingBottom = ""; }
  const lhs = $("lhSpacing"); if (lhs) lhs.hidden = !getLetterhead();
  const lt2 = $("lhThumb"); if (lt2) { const g = getLetterhead(); lt2.style.backgroundImage = g ? `url("${g}")` : ""; lt2.classList.toggle("empty", !g); }
}

/* ------------------------------ wiring ------------------------------ */
function wirePaymentTerms() {
  let auto = false;
  const apply = () => {
    const v = $("paymentTerms").value; if (v === "") return;
    const base = $("invoiceDate").value || today();
    auto = true; $("dueDate").value = plusDays(base, Number(v)); fire($("dueDate")); auto = false;
  };
  $("paymentTerms").addEventListener("change", apply);
  $("invoiceDate").addEventListener("change", apply);
  $("invoiceDate").addEventListener("input", apply);
  $("dueDate").addEventListener("input", () => { if (!auto && $("paymentTerms").value !== "") { $("paymentTerms").value = ""; fire($("paymentTerms"), "change"); } });
}

function wireLanguage() {
  $("docLanguage").addEventListener("change", () => {
    applyLanguage(lang(), state.docType || "invoice", $, state.columns);
    api.renderPreview(); api.save();
    toast("Document labels translated. You can still edit any of them.");
  });
}

function wireSignature() {
  const open = () => $("signFile").click();
  $("signAddBtn").addEventListener("click", open);
  $("signFile").addEventListener("change", async e => {
    const file = e.target.files && e.target.files[0]; e.target.value = "";
    if (!file) return;
    try { state.signature = await readImage(file, { maxW: 700, maxH: 360 }); api.renderPreview(); api.save(); toast("Signature added."); }
    catch (err) { toast(err.message); }
  });
  $("signRemoveBtn").addEventListener("click", () => { if (!state.signature) return; state.signature = ""; api.renderPreview(); api.save(); toast("Signature removed."); });
}

function wireLetterhead() {
  $("lhFile").addEventListener("change", async e => {
    const file = e.target.files && e.target.files[0]; e.target.value = "";
    if (!file) return;
    try {
      const v = await readImage(file, { maxW: 1654, maxH: 2339, type: "image/jpeg", quality: 0.82 });
      if (!setLetterhead(v)) return;
      $("useLetterhead").checked = true; fire($("useLetterhead"));
      toast("Letterhead added.");
    } catch (err) { toast(err.message); }
  });
  $("lhRemoveBtn").addEventListener("click", () => {
    if (!getLetterhead()) return;
    if (!confirm("Remove the letterhead image from this device?")) return;
    setLetterhead(""); $("useLetterhead").checked = false; fire($("useLetterhead"));
  });
}

function wirePayLink() {
  const d = $("payLinkDialog"), inp = $("payLink"), err = $("payLinkErr");
  const ph = () => { inp.placeholder = PAY_PLACEHOLDER[$("payProvider").value] || "https://…"; };
  const check = () => {
    const v = inp.value.trim(), ok = !v || !!normalizeUrl(v);
    err.hidden = ok; err.textContent = ok ? "" : "Enter a full web address, for example " + (PAY_PLACEHOLDER[$("payProvider").value] || "https://…");
    inp.setAttribute("aria-invalid", ok ? "false" : "true");
    return ok;
  };
  $("payProvider").addEventListener("change", ph);
  inp.addEventListener("blur", () => { if (check() && inp.value.trim()) { const n = normalizeUrl(inp.value); if (n !== inp.value) { inp.value = n; fire(inp); } } });
  $("payLinkBtn").addEventListener("click", () => { ph(); check(); d.showModal(); inp.focus(); });
  $("pPayQr").addEventListener("click", () => { if (!document.body.classList.contains("canvas-preview-mode")) $("payLinkBtn").click(); });
  $("payLinkClear").addEventListener("click", () => { inp.value = ""; fire(inp); check(); d.close(); });
  d.addEventListener("click", e => { if (e.target === d || e.target.closest("[data-close]")) { if (check()) d.close(); } });
  d.addEventListener("cancel", e => { if (!check()) e.preventDefault(); });
}

/* ------------------------------ send to client ------------------------------ */
function shareMessage() {
  const doc = state.docType || "invoice";
  const noun = tr("en", "noun", doc).toLowerCase(), no = $("invoiceNumber").value.trim();
  const client = $("clientContact").value.trim() || $("clientName").value.trim();
  const company = $("companyName").value.trim();
  const amt = ($("pBalance").textContent || "").trim();
  const due = $("dueDate").value ? dateFmt($("dueDate").value) : "";
  const link = normalizeUrl($("payLink").value);
  return [
    `Hello${client ? " " + client : ""},`, "",
    `Please find attached ${noun} ${no}${company ? " from " + company : ""}.`,
    amt ? `Amount due: ${amt}${due && doc === "invoice" ? " (due " + due + ")" : ""}` : null,
    link ? `Pay online: ${link}` : null, "",
    "Thank you!", company || null
  ].filter(x => x !== null).join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
function wireShare() {
  const d = $("shareDialog");
  const subject = () => `${tr("en", "noun", state.docType || "invoice")} ${$("invoiceNumber").value.trim()}${$("companyName").value.trim() ? " from " + $("companyName").value.trim() : ""}`;
  $("shareBtn").addEventListener("click", () => {
    $("shareTo").value = $("clientEmail").value.trim();
    $("shareMsg").value = shareMessage();
    d.querySelector('[data-share="native"]').hidden = typeof navigator.share !== "function";
    const sec = $("actionsSecondary"); if (sec) sec.classList.remove("open");
    d.showModal();
  });
  d.addEventListener("click", async e => {
    if (e.target === d || e.target.closest("[data-close]")) { d.close(); return; }
    const b = e.target.closest("[data-share]"); if (!b) return;
    const msg = $("shareMsg").value, to = $("shareTo").value.trim();
    if (b.dataset.share === "pdf") { d.close(); api.printPdf(); }
    else if (b.dataset.share === "email") location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject())}&body=${encodeURIComponent(msg)}`;
    else if (b.dataset.share === "whatsapp") window.open("https://wa.me/?text=" + encodeURIComponent(msg), "_blank", "noopener");
    else if (b.dataset.share === "copy") { try { await navigator.clipboard.writeText(msg); toast("Message copied."); } catch { $("shareMsg").select(); document.execCommand("copy"); toast("Message copied."); } }
    else if (b.dataset.share === "native") { try { await navigator.share({ title: subject(), text: msg }); } catch {} }
  });
}

export function initFeatures(callbacks) {
  api = callbacks;
  wirePaymentTerms(); wireLanguage(); wireSignature(); wireLetterhead(); wirePayLink(); wireShare();
  // Switching Invoice / Estimate / Receipt resets labels to English defaults — re-apply the chosen language.
  document.querySelectorAll("[data-doctype]").forEach(b => b.addEventListener("click", () => setTimeout(() => {
    if (lang() !== "en") { applyLanguage(lang(), state.docType || "invoice", $, state.columns); api.renderPreview(); api.save(); }
  }, 0)));
}
