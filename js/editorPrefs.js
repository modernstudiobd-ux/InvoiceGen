// Editor preference: show/hide the Edit mode button. Default = hidden on every device.
const KEY = "invoiceStudio.showEditMode";
const $ = (id) => document.getElementById(id);
const stored = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
const effective = () => { const s = stored(); return s === null ? false : s === "1"; };

function apply() {
  const show = effective();
  document.body.classList.toggle("hide-edit-mode", !show);
  const sel = $("settingEditMode");
  if (sel) sel.value = show ? "1" : "0";
  // Never leave someone stranded in a hidden mode: fall back to Form.
  const inEdit = !document.body.classList.contains("form-mode") && !document.body.classList.contains("canvas-preview-mode");
  if (!show && inEdit && $("canvasModeFormBtn")) $("canvasModeFormBtn").click();
}

const sel = $("settingEditMode");
if (sel) sel.addEventListener("change", () => { try { localStorage.setItem(KEY, sel.value); } catch {} apply(); });
apply();
window.addEventListener("load", () => setTimeout(apply, 0));
