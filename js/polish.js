// polish.js — small UX helpers that don't belong to any one feature.

// Form section chips (Business · Details · Client · …): fade the edge that has
// more chips, let a mouse drag or wheel scroll the row (touch already swipes),
// and highlight the section currently on screen.
function initNav() {
  const nav = document.querySelector("#formEditor .fe-nav");
  if (!nav || nav.dataset.ready) return !!nav;
  nav.dataset.ready = "1";

  const upd = () => {
    const max = nav.scrollWidth - nav.clientWidth;
    nav.classList.toggle("more-left", nav.scrollLeft > 2);
    nav.classList.toggle("more-right", max - nav.scrollLeft > 2);
  };
  nav.addEventListener("scroll", upd, { passive: true });
  window.addEventListener("resize", upd);
  if ("ResizeObserver" in window) new ResizeObserver(upd).observe(nav);
  upd();

  // Mouse drag to scroll. A drag of more than 5px doesn't count as a click.
  let down = null, moved = false;
  nav.addEventListener("pointerdown", e => {
    if (e.pointerType !== "mouse" || e.button !== 0 || nav.scrollWidth <= nav.clientWidth) return;
    down = { x: e.clientX, left: nav.scrollLeft, id: e.pointerId }; moved = false;
  });
  nav.addEventListener("pointermove", e => {
    if (!down || e.pointerId !== down.id) return;
    const dx = e.clientX - down.x;
    if (!moved && Math.abs(dx) > 5) { moved = true; nav.classList.add("dragging"); try { nav.setPointerCapture(e.pointerId); } catch {} }
    if (moved) nav.scrollLeft = down.left - dx;
  });
  const end = () => { if (!down) return; down = null; if (moved) requestAnimationFrame(() => nav.classList.remove("dragging")); };
  nav.addEventListener("pointerup", end); nav.addEventListener("pointercancel", end); nav.addEventListener("lostpointercapture", end);
  nav.addEventListener("click", e => { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);

  // Vertical mouse wheel scrolls the chips sideways while there's room to go;
  // at either end the page scrolls as normal.
  nav.addEventListener("wheel", e => {
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX) || e.ctrlKey) return;
    const max = nav.scrollWidth - nav.clientWidth; if (max <= 0) return;
    const next = nav.scrollLeft + e.deltaY;
    if ((e.deltaY < 0 && nav.scrollLeft <= 0) || (e.deltaY > 0 && nav.scrollLeft >= max)) return;
    e.preventDefault(); nav.scrollLeft = Math.max(0, Math.min(max, next));
  }, { passive: false });

  // Highlight the chip for the section in view, and keep it visible in the row.
  const chips = [...nav.querySelectorAll("[data-go]")];
  const targets = chips.map(c => document.getElementById(c.dataset.go)).filter(Boolean);
  if (targets.length) {
    let raf = 0, cur = "";
    const pick = () => {
      raf = 0;
      if (!nav.offsetParent) return;                       // Form hidden (Edit/Preview mode)
      const line = nav.getBoundingClientRect().bottom + 24;  // just under the sticky chip row
      let id = targets[0].id;
      targets.forEach(t => { if (t.offsetParent && t.getBoundingClientRect().top <= line) id = t.id; });
      if (id === cur) return; cur = id;
      chips.forEach(c => {
        const on = c.dataset.go === id;
        c.classList.toggle("active", on);
        if (on) c.setAttribute("aria-current", "true"); else c.removeAttribute("aria-current");
        if (on && !nav.classList.contains("dragging")) {
          const cl = c.offsetLeft, cr = cl + c.offsetWidth;
          if (cl < nav.scrollLeft + 24 || cr > nav.scrollLeft + nav.clientWidth - 24) nav.scrollTo({ left: Math.max(0, cl - 24), behavior: "smooth" });
        }
      });
    };
    const req = () => { if (!raf) raf = requestAnimationFrame(pick); };
    document.addEventListener("scroll", req, { passive: true, capture: true });
    window.addEventListener("resize", req);
    document.addEventListener("toggle", req, true);   // a section opened/closed
    pick();
  }
  return true;
}
// The Form is built lazily; try now and again once it exists.
if (!initNav()) {
  const fe = document.getElementById("formEditor");
  if (fe) { const mo = new MutationObserver(() => { if (initNav()) mo.disconnect(); }); mo.observe(fe, { childList: true }); }
}
