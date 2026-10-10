// Short, consistent tooltips for toolbar and icon buttons (hover and keyboard focus). No effect on touch.
const TIPS = {
  undoBtn: "Undo", redoBtn: "Redo", zoomOut: "Zoom out", zoomIn: "Zoom in",
  designReopenBtn: "Open Design", designCloseBtn: "Close Design",
  saveInvoiceBtn: "Save", pdfBtn: "Download PDF", printBtn: "Print", posBtn: "Print receipt",
  shareBtn: "Send to client", duplicateInvoiceBtn: "Copy invoice", exportBtn: "Export JSON", importBtn: "Import JSON",
  resetBtn: "Clear fields", moreActionsBtn: "More actions", newInvoiceBtn: "New document",
  canvasModeEditBtn: "Type on the invoice", canvasModeFormBtn: "Fill in a form", canvasModePreviewBtn: "See the final invoice",
  resetColorBtn: "Reset colors", feResetColors: "Reset colors", mvEditBtn: "Menu", expandPreviewBtn: "Full preview",
  currencySearchInput: "Currency", feImportInfo: "File format help", feEditCols: "Edit columns", feImport: "Import items",
  signRemoveBtn: "Remove signature", lhRemoveBtn: "Remove letterhead", designReopen: "Open Design"
};
const tipFor = (el) => {
  if (el.dataset.tip) return el.dataset.tip;
  if (TIPS[el.id]) return TIPS[el.id];
  if (/Clear$/.test(el.id) && el.classList.contains("icon")) return "Use template color";
  if (el.matches(".btn.icon, .cs-icon-btn") && el.getAttribute("aria-label")) return el.getAttribute("aria-label");
  return "";
};
let tip, timer, cur;
const hide = () => { clearTimeout(timer); cur = null; if (tip) { tip.remove(); tip = null; } };
function show(el, text) {
  hide(); cur = el;
  tip = document.createElement("div"); tip.className = "ui-tip"; tip.setAttribute("role", "tooltip"); tip.textContent = text;
  document.body.appendChild(tip);
  const r = el.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
  let top = r.bottom + 8; if (top + h > innerHeight - 8) top = r.top - h - 8;
  tip.style.top = Math.round(top) + "px";
  tip.style.left = Math.round(Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2))) + "px";
}
function enter(e, delay) {
  const el = e.target.closest && e.target.closest("button, input, label, summary, a, [role=tab]"); if (!el || el === cur) return;
  const text = tipFor(el); if (!text) return;
  if (el.hasAttribute("title")) { el.dataset.title = el.getAttribute("title"); el.removeAttribute("title"); }
  if (!el.getAttribute("aria-label") && !el.textContent.trim() ) el.setAttribute("aria-label", text);
  clearTimeout(timer); timer = setTimeout(() => show(el, text), delay);
}
if (matchMedia("(hover:hover) and (pointer:fine)").matches) {
  document.addEventListener("mouseover", (e) => enter(e, 450));
  document.addEventListener("mouseout", (e) => { if (!e.relatedTarget || !cur || !cur.contains(e.relatedTarget)) hide(); });
}
document.addEventListener("focusin", (e) => { if (e.target.matches && e.target.matches(":focus-visible")) enter(e, 150); });
document.addEventListener("focusout", hide);
document.addEventListener("click", hide);
document.addEventListener("keydown", (e) => { if (e.key === "Escape") hide(); });
window.addEventListener("scroll", hide, true);
