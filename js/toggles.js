// toggles.js — the show/hide switches for each invoice section (Design tab).

import { $ } from "./dom.js";
import { state, sectionDefs } from "./state.js";
import { renderPreview } from "./preview.js";
import { save } from "./persistence.js";

export function renderToggles() {
  let r = $("sectionToggles");
  r.innerHTML = sectionDefs.map(([k, l]) => `<label class="toggleline"><span id="toggle-label-${k}">${l}</span><span class="switch"><input type="checkbox" data-section-toggle="${k}" aria-labelledby="toggle-label-${k}" ${state.sections[k] ? "checked" : ""}><span class="slider"></span></span></label>`).join("");
  r.querySelectorAll("[data-section-toggle]").forEach(e => e.onchange = () => { state.sections[e.dataset.sectionToggle] = e.checked; renderPreview(); save(); });
}
