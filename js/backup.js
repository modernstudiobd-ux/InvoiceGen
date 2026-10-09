// backup.js — one-file backup & restore of everything this app keeps in the
// browser (current document, Saved invoices, Brand templates, Clients,
// Products, settings, letterhead), so clearing browser data never loses work.

import { $ } from "./dom.js";
import { toast } from "./toast.js";

const PREFIXES = ["invoiceStudio", "invoiceStudioPro"];
const LAST = "invoiceStudio.lastBackup";
const ours = k => PREFIXES.some(p => k === p || k.startsWith(p + ".") );
const stamp = () => { const d = new Date(), p = n => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };

function showLast() {
  const el = $("backupLast"); if (!el) return;
  const t = Number(localStorage.getItem(LAST) || 0);
  el.textContent = "Saves every invoice, client, product, template and setting into one file. " + (t ? "Last backup: " + new Date(t).toLocaleDateString() + "." : "No backup yet.");
}
export function downloadBackup() {
  const data = {};
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (ours(k) && k !== LAST) data[k] = localStorage.getItem(k); }
  const blob = new Blob([JSON.stringify({ app: "InvoGen", kind: "backup", version: 1, createdAt: new Date().toISOString(), data }, null, 1)], { type: "application/json" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `invogen-backup-${stamp()}.json`;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  try { localStorage.setItem(LAST, String(Date.now())); } catch {}
  showLast(); toast("Backup downloaded.");
}
async function restore(file) {
  try {
    if (file.size > 40e6) throw Error("That file is too large to be a backup.");
    const j = JSON.parse(await file.text());
    if (!j || j.kind !== "backup" || typeof j.data !== "object") throw Error("This isn't an InvoGen backup file.");
    const keys = Object.keys(j.data).filter(ours);
    if (!keys.length) throw Error("This backup is empty.");
    if (!confirm(`Restore this backup from ${j.createdAt ? new Date(j.createdAt).toLocaleString() : "an earlier date"}?\n\nEverything currently on this device will be replaced. This can't be undone.`)) return;
    const old = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (ours(k)) old.push(k); }
    old.forEach(k => localStorage.removeItem(k));
    keys.forEach(k => { if (typeof j.data[k] === "string") localStorage.setItem(k, j.data[k]); });
    toast("Backup restored. Reloading…");
    setTimeout(() => location.reload(), 600);
  } catch (err) { toast(err.message || "The backup could not be restored."); }
}
export function initBackup() {
  $("backupBtn").addEventListener("click", downloadBackup);
  $("restoreBtn").addEventListener("click", () => $("restoreFile").click());
  $("restoreFile").addEventListener("change", e => { const f = e.target.files && e.target.files[0]; e.target.value = ""; if (f) restore(f); });
  showLast();
}
