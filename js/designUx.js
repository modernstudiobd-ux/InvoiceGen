// Design panel: keep only look-and-feel here; move business/document settings into their own section.
(function restructure() {
  const g = (id) => document.getElementById(id);
  const wrapOf = (id) => { const e = g(id); return e ? e.closest(".field") : null; };
  const brand = g("brandPanel"), rs = g("rightSidebar");
  if (!brand || !rs) return;
  const more = g("brandMore");
  const doc = document.createElement("section");
  doc.className = "panel collapsed"; doc.id = "docPanel";
  doc.innerHTML = '<div class="panelhead"><h2>Business &amp; document</h2></div>';
  const body = document.createElement("div"); body.className = "doc-body"; doc.appendChild(body);
  // Document-level settings and business assets leave the Design sections
  ["docLanguage", "paperSize", "footerText"].forEach((id) => { const w = wrapOf(id); if (w) body.appendChild(w); });
  if (more) { [...more.children].forEach((c) => { if (c.tagName !== "SUMMARY" && !c.querySelector("#watermark") && c.id !== "watermarkTextField" && !c.classList.contains("grid2:first")) body.appendChild(c); }); }
  // Alignment joins the Brand section (renamed "Font & style"); the old Layout panel is removed
  const al = wrapOf("notesAlign"); if (al) brand.appendChild(al);
  const h = brand.querySelector(".panelhead h2"); if (h) h.textContent = "Font & style";
  // Unwrap watermark from the removed "More" details
  if (more) { while (more.lastElementChild && more.lastElementChild.tagName !== "SUMMARY") brand.insertBefore(more.lastElementChild, more); more.remove(); }
  const layout = [...rs.querySelectorAll(":scope > .panel")].find((p) => p.querySelector(".panelhead h2") && p.querySelector(".panelhead h2").textContent.trim() === "Layout");
  if (layout) layout.remove();
  const sections = [...rs.querySelectorAll(":scope > .panel")].find((p) => p.querySelector("#sectionToggles"));
  rs.insertBefore(doc, sections || null);
  doc.querySelector(".panelhead").addEventListener("click", () => doc.classList.toggle("collapsed"));
})();
// Design panel: one section open at a time, with a one-line summary on each collapsed section.
const $ = (id) => document.getElementById(id);
const val = (id) => { const e = $(id); return e ? e.value : ""; };
const opt = (id) => { const e = $(id); return e && e.selectedOptions[0] ? e.selectedOptions[0].textContent.trim() : ""; };
const SUM = [
  () => opt("template"),
  () => (val("accentHex") || val("accent")).toUpperCase() + " · " + opt("colorStyle"),
  () => [opt("invoiceFont") || "Template font", opt("notesAlign")].join(" · "),
  () => [opt("docLanguage"), opt("paperSize")].join(" · "),
  () => ""
];
const panels = () => [...document.querySelectorAll("#rightSidebar > .panel")];
function refresh() {
  panels().forEach((p, i) => {
    const head = p.querySelector(".panelhead"); if (!head) return;
    let s = head.querySelector(".panel-sum");
    if (!s) { s = document.createElement("span"); s.className = "panel-sum"; head.insertBefore(s, head.querySelector(".btn")); }
    s.textContent = SUM[i] ? SUM[i]() : "";
  });
}
document.addEventListener("click", (e) => {
  const head = e.target.closest("#rightSidebar > .panel > .panelhead"); if (!head || e.target.closest(".btn")) return;
  setTimeout(() => {
    const me = head.closest(".panel");
    if (!me.classList.contains("collapsed")) panels().forEach((p) => { if (p !== me) p.classList.add("collapsed"); });
    refresh();
  }, 0);
});
const rs = $("rightSidebar");
if (rs) { rs.addEventListener("input", () => setTimeout(refresh, 0)); rs.addEventListener("change", () => setTimeout(refresh, 0)); }
window.addEventListener("load", () => { setTimeout(refresh, 300); setTimeout(refresh, 1500); });
refresh();

/* Tooltip shown when the Design panel is closed, pointing at the button that reopens it */
(function reopenHint() {
  const close = $("designCloseBtn"), reopen = $("designReopenBtn"); if (!close || !reopen) return;
  const KEY = "invoiceStudio.designHintCount"; let tip = null, timer = null;
  const hide = () => { clearTimeout(timer); if (tip) { tip.remove(); tip = null; } };
  function show() {
    hide();
    const r = reopen.getBoundingClientRect(); if (!r.width) return;
    tip = document.createElement("div"); tip.className = "design-hint"; tip.setAttribute("role", "status");
    tip.innerHTML = '<strong>Design is closed</strong><span>Click here to open it again.</span>';
    document.body.appendChild(tip);
    const w = tip.offsetWidth, left = Math.max(8, Math.min(innerWidth - w - 8, r.right - w));
    tip.style.top = Math.round(r.bottom + 10) + "px"; tip.style.left = left + "px";
    tip.style.setProperty("--arrow", Math.round(r.left + r.width / 2 - left) + "px");
    tip.addEventListener("click", () => { hide(); reopen.click(); });
    timer = setTimeout(hide, 7000);
  }
  close.addEventListener("click", () => {
    let n = 0; try { n = +localStorage.getItem(KEY) || 0; localStorage.setItem(KEY, String(n + 1)); } catch {}
    if (n < 3) setTimeout(show, 260);   // first three times only, after the layout settles
  });
  reopen.addEventListener("click", hide);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") hide(); });
  window.addEventListener("resize", hide);
})();
