// format.js — number/date/currency formatting.
//
// Currency renders with a real symbol (₹, €, ₩, ...) rather than the ISO
// code — see CURRENCY_SYMBOLS below, which is a curated, hand-picked symbol
// per currency rather than pulling Intl's own currencyDisplay:"symbol".
// That choice is deliberate: for several locales (bn-BD, ne-NP, si-LK, the
// Arabic ones, ...) Intl's native formatting doesn't just swap in a symbol,
// it *also* switches the digits themselves to that locale's native numeral
// system (Bengali/Devanagari/Arabic-Indic digits) — e.g. Taka would come
// out as "১,২৩৪.৫০৳" with no Western digits at all. That's the right
// behavior for a document meant to be read only by a local reader, but
// wrong for an invoice meant to be read internationally, so amounts always
// use plain Western digits/grouping here regardless of currency, with only
// the symbol changing.
//
// A handful of the symbols below (₹ ₩ ₪ ₦ ₴ ₺ ₽ ₱ ₫ ₵ ł č ฿ ৳) aren't in the
// self-hosted Inter font — see the small offline-cached fallback subsets
// wired up under the "Inter" family in css/base.css (unicode-range) for why
// these still render correctly with no network connection.

import { $, esc } from "./dom.js";
import { getDateFormat } from "./settings.js";

// Forgiving number parser. Phone keyboards often produce things a plain
// Number() rejects (and the app then silently treated as 0, so amounts never
// changed): Bengali/Hindi/Arabic/Persian digits (০১২…), a comma as the decimal
// mark ("12,5"), thousands commas ("1,200"), spaces / non-breaking spaces, and
// stray currency symbols. Plain ASCII input behaves exactly as before.
const DIGIT_BASES = [0x09E6, 0x0966, 0x0660, 0x06F0, 0x0AE6, 0x0BE6];
export function num(v) {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  let s = String(v ?? "").trim();
  if (!s) return 0;
  let plain = Number(s);
  if (Number.isFinite(plain)) return plain;
  s = s.replace(/[\u0966-\u096F\u09E6-\u09EF\u0660-\u0669\u06F0-\u06F9\u0AE6-\u0AEF\u0BE6-\u0BEF]/g, ch => {
    const c = ch.codePointAt(0), base = DIGIT_BASES.find(b => c >= b && c <= b + 9);
    return String(c - base);
  }).replace(/[\u066B]/g, ".").replace(/[\u066C\u00A0\u202F\s]/g, "").replace(/[^0-9.,eE+-]/g, "");
  if (s.includes(",")) {
    if (s.includes(".")) s = s.replace(/,/g, "");                       // 1,234.50
    else if (/^[+-]?\d{1,3}(,\d{3})+$/.test(s)) s = s.replace(/,/g, ""); // 1,200
    else s = s.replace(",", ".");                                       // 12,5
  }
  plain = Number(s);
  return Number.isFinite(plain) ? plain : 0;
}

export function today() {
  let d = new Date(), o = d.getTimezoneOffset();
  return new Date(d - o * 60000).toISOString().slice(0, 10);
}

export function plusDays(s, n) {
  let d = new Date(s + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export function alignClass(a) {
  return a === "right" ? "right" : a === "center" ? "center" : "";
}

function pad2(n) { return String(n).padStart(2, "0"); }

// The single place invoice dates are rendered as text anywhere in the app
// (as opposed to a native <input type="date">, which the browser/OS itself
// renders) — used by fmtCell() below for "date"-type line-item columns,
// and by the Saved Invoices / Brand Templates lists (js/library.js,
// js/brandTemplates.js). Always reads the live Settings > Default date
// format (js/settings.js) rather than a fixed style, so changing that
// setting is immediately reflected everywhere a date is formatted through
// this function — nothing else in the app hardcodes a date format.
// Accepts a "YYYY-MM-DD" date-only string (line-item cell values, native
// date-input values), a timestamp number, or a Date.
export function dateFmt(v) {
  if (v === "" || v == null) return "—";
  let d;
  if (v instanceof Date) d = v;
  else if (typeof v === "number") d = new Date(v);
  // A plain "YYYY-MM-DD" string is parsed at local midnight (appending
  // T00:00:00) so it never shifts a day depending on the visitor's UTC
  // offset — new Date("YYYY-MM-DD") alone parses as UTC midnight.
  else if (/^\d{4}-\d{2}-\d{2}$/.test(String(v))) d = new Date(v + "T00:00:00");
  else d = new Date(v);
  if (isNaN(d.getTime())) return "—";
  const day = pad2(d.getDate()), month = pad2(d.getMonth() + 1), year = d.getFullYear();
  return getDateFormat() === "mdy" ? `${month}/${day}/${year}` : `${day}/${month}/${year}`;
}

// Kept only for anything that still wants a locale hint (not used by
// money()/moneyFor() anymore, which always format digits the same way).
export const CURRENCY_LOCALE = { USD: "en-US", CAD: "en-CA", MXN: "es-MX", BRL: "pt-BR", ARS: "es-AR", CLP: "es-CL", COP: "es-CO", PEN: "es-PE", UYU: "es-UY", JMD: "en-JM", EUR: "de-DE", GBP: "en-GB", CHF: "de-CH", SEK: "sv-SE", NOK: "nb-NO", DKK: "da-DK", PLN: "pl-PL", CZK: "cs-CZ", HUF: "hu-HU", RON: "ro-RO", UAH: "uk-UA", RUB: "ru-RU", TRY: "tr-TR", AED: "ar-AE", SAR: "ar-SA", QAR: "ar-QA", KWD: "ar-KW", BHD: "ar-BH", OMR: "ar-OM", ILS: "he-IL", EGP: "ar-EG", ZAR: "en-ZA", NGN: "en-NG", KES: "en-KE", GHS: "en-GH", AUD: "en-AU", NZD: "en-NZ", JPY: "ja-JP", CNY: "zh-CN", HKD: "zh-HK", TWD: "zh-TW", KRW: "ko-KR", SGD: "en-SG", INR: "en-IN", PKR: "en-PK", BDT: "bn-BD", LKR: "si-LK", NPR: "ne-NP", IDR: "id-ID", MYR: "ms-MY", PHP: "en-PH", THB: "th-TH", VND: "vi-VN" };

// One symbol per currency. Single-character symbols sit tight against the
// number ("$1,234.50", "₹1,234.50"); multi-letter abbreviations get a space
// ("CHF 1,234.50", "Rs 1,234.50") — used where no single universal symbol
// exists (Gulf currencies, PKR/LKR/NPR all sharing "Rs", etc).
export const CURRENCY_SYMBOLS = {
  USD: "$", CAD: "$", MXN: "$", BRL: "R$", ARS: "$", CLP: "$", COP: "$", PEN: "S/", UYU: "$U", JMD: "J$",
  EUR: "€", GBP: "£", CHF: "CHF", SEK: "kr", NOK: "kr", DKK: "kr", PLN: "zł", CZK: "Kč", HUF: "Ft", RON: "lei",
  UAH: "₴", RUB: "₽", TRY: "₺",
  // Native Arabic-script symbols (dirham, riyal, dinar, pound).
  AED: "د.إ", SAR: "ر.س", QAR: "ر.ق", KWD: "د.ك", BHD: "د.ب", OMR: "ر.ع.", EGP: "ج.م",
  ILS: "₪", ZAR: "R", NGN: "₦", KES: "KSh", GHS: "₵",
  AUD: "$", NZD: "$", JPY: "¥", CNY: "¥", HKD: "HK$", TWD: "NT$", KRW: "₩", SGD: "S$",
  INR: "₹", PKR: "₨", BDT: "৳", LKR: "රු", NPR: "रू", IDR: "Rp", MYR: "RM", PHP: "₱", THB: "฿", VND: "₫"
};
// Minor-unit digits per ISO 4217 / CLDR (e.g. ¥1,235 and د.ك 1,234.500), so
// every currency is written the way it is written natively. Default: 2.
export const CURRENCY_DECIMALS = { CLP: 0, JPY: 0, KRW: 0, VND: 0, KWD: 3, BHD: 3, OMR: 3 };
const RTL_SYMBOL = /[\u0590-\u08FF]/;

const NF = {};
function formatAmount(v, code) {
  const symbol = CURRENCY_SYMBOLS[code] || code;
  const d = CURRENCY_DECIMALS[code] ?? 2;
  const nf = NF[d] || (NF[d] = new Intl.NumberFormat("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }));
  let n = nf.format(num(v));
  if (n === "-0" || /^-0[.,]?0*$/.test(n)) n = n.slice(1);
  // Arabic/Hebrew-script symbols are followed by an invisible left-to-right
  // mark so the amount always stays to the right of the symbol.
  const sep = [...symbol].length === 1 ? "" : RTL_SYMBOL.test(symbol) ? "\u200E " : " ";
  return symbol + sep + n;
}

export function money(v) {
  return formatAmount(v, $("currency").value);
}

export function moneyFor(v, c) {
  return formatAmount(v, c || "USD");
}

export function normalizeKey(s) {
  return String(s || "column").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "column";
}

export function fmtCell(v, col) {
  if (col.type === "currency") return money(v);
  if (col.type === "number") return num(v).toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (col.type === "percentage") return num(v).toFixed(2).replace(/\.00$/, "") + "%";
  if (col.type === "date") return dateFmt(v);
  return esc(v).replaceAll("\n", "<br>");
}
