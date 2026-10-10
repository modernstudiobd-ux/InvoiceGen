// polish.js — v3.40.0: small UX helpers that don't belong to any one feature.

// Form section chips: fade whichever edge still has chips hidden off-screen.
function navFade() {
  const nav = document.querySelector("#formEditor .fe-nav");
  if (!nav || nav.dataset.fade) return !!nav;
  nav.dataset.fade = "1";
  const upd = () => {
    const max = nav.scrollWidth - nav.clientWidth;
    nav.classList.toggle("more-left", nav.scrollLeft > 2);
    nav.classList.toggle("more-right", max - nav.scrollLeft > 2);
  };
  nav.addEventListener("scroll", upd, { passive: true });
  window.addEventListener("resize", upd);
  if ("ResizeObserver" in window) new ResizeObserver(upd).observe(nav);
  upd();
  return true;
}
// The Form is built lazily; try now and again once it exists.
if (!navFade()) {
  const mo = new MutationObserver(() => { if (navFade()) mo.disconnect(); });
  const fe = document.getElementById("formEditor");
  if (fe) mo.observe(fe, { childList: true });
}
