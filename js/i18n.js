// i18n.js — "Document language": ready-made translations of every heading
// and label printed on the document (the app's own interface stays English).
// Choosing a language writes the translated text into the renameable label
// fields (so it saves, prints and can still be edited by hand) and updates the
// few fixed summary words (Subtotal, Total, …) on every render.

export const LANGS = ["en", "bn", "ar", "hi", "es", "fr", "de", "pt"];

// t: per-document-type words  [invoice, estimate, receipt]
const T = {
  en: {
    title: ["INVOICE", "ESTIMATE", "RECEIPT"], bill: ["BILL TO", "PREPARED FOR", "RECEIVED FROM"],
    date: ["Invoice date", "Estimate date", "Receipt date"], due: ["Due date", "Valid until", "Payment date"],
    balance: ["Balance due", "Estimated total", "Amount paid"], noun: ["Invoice", "Estimate", "Receipt"],
    ref: "Reference", note: "NOTE", payment: "PAYMENT DETAILS", terms: "TERMS", payTerms: "Payment terms", tax: "Tax",
    paid: "Amount paid", subtotal: "Subtotal", discount: "Discount", shipping: "Shipping", total: "Total", balanceRow: "Balance due",
    itemTax: "Item tax", words: "Amount in words", payOnline: "Pay online", scan: "Scan to pay", sign: "Authorized signature",
    receipt: "Due on receipt", net: "Net", cols: { sku: "SKU", description: "Description", quantity: "Qty", rate: "Rate", amount: "Amount" }
  },
  bn: {
    title: ["ইনভয়েস", "এস্টিমেট", "রসিদ"], bill: ["বিল প্রাপক", "যার জন্য প্রস্তুত", "যার কাছ থেকে প্রাপ্ত"],
    date: ["ইনভয়েসের তারিখ", "এস্টিমেটের তারিখ", "রসিদের তারিখ"], due: ["পরিশোধের শেষ তারিখ", "মেয়াদ শেষ", "পরিশোধের তারিখ"],
    balance: ["বকেয়া", "আনুমানিক মোট", "পরিশোধিত"], noun: ["ইনভয়েস", "এস্টিমেট", "রসিদ"],
    ref: "রেফারেন্স", note: "নোট", payment: "পেমেন্টের বিবরণ", terms: "শর্তাবলি", payTerms: "পেমেন্টের শর্ত", tax: "কর",
    paid: "পরিশোধিত", subtotal: "উপমোট", discount: "ছাড়", shipping: "ডেলিভারি", total: "মোট", balanceRow: "বকেয়া",
    itemTax: "পণ্যভিত্তিক কর", words: "কথায়", payOnline: "অনলাইনে পরিশোধ করুন", scan: "পরিশোধ করতে স্ক্যান করুন", sign: "অনুমোদিত স্বাক্ষর",
    receipt: "প্রাপ্তির সাথে সাথে", net: "নেট", cols: { sku: "কোড", description: "বিবরণ", quantity: "সংখ্যা", rate: "দর", amount: "মূল্য" }
  },
  ar: {
    title: ["فاتورة", "عرض سعر", "إيصال"], bill: ["فاتورة إلى", "مُعدّ لـ", "مستلم من"],
    date: ["تاريخ الفاتورة", "تاريخ العرض", "تاريخ الإيصال"], due: ["تاريخ الاستحقاق", "صالح حتى", "تاريخ الدفع"],
    balance: ["الرصيد المستحق", "الإجمالي التقديري", "المبلغ المدفوع"], noun: ["فاتورة", "عرض سعر", "إيصال"],
    ref: "المرجع", note: "ملاحظة", payment: "تفاصيل الدفع", terms: "الشروط", payTerms: "شروط الدفع", tax: "الضريبة",
    paid: "المبلغ المدفوع", subtotal: "المجموع الفرعي", discount: "الخصم", shipping: "الشحن", total: "الإجمالي", balanceRow: "الرصيد المستحق",
    itemTax: "ضريبة البنود", words: "المبلغ كتابةً", payOnline: "ادفع عبر الإنترنت", scan: "امسح للدفع", sign: "التوقيع المعتمد",
    receipt: "مستحق عند الاستلام", net: "صافي", cols: { sku: "الرمز", description: "الوصف", quantity: "الكمية", rate: "السعر", amount: "المبلغ" }
  },
  hi: {
    title: ["इनवॉइस", "अनुमान", "रसीद"], bill: ["बिल प्राप्तकर्ता", "किसके लिए", "प्राप्त किया"],
    date: ["इनवॉइस तिथि", "अनुमान तिथि", "रसीद तिथि"], due: ["देय तिथि", "मान्य तिथि तक", "भुगतान तिथि"],
    balance: ["देय राशि", "अनुमानित कुल", "भुगतान की गई राशि"], noun: ["इनवॉइस", "अनुमान", "रसीद"],
    ref: "संदर्भ", note: "नोट", payment: "भुगतान विवरण", terms: "शर्तें", payTerms: "भुगतान शर्तें", tax: "कर",
    paid: "भुगतान की गई राशि", subtotal: "उप-योग", discount: "छूट", shipping: "शिपिंग", total: "कुल", balanceRow: "देय राशि",
    itemTax: "मद कर", words: "शब्दों में राशि", payOnline: "ऑनलाइन भुगतान करें", scan: "भुगतान हेतु स्कैन करें", sign: "अधिकृत हस्ताक्षर",
    receipt: "प्राप्ति पर देय", net: "नेट", cols: { sku: "कोड", description: "विवरण", quantity: "मात्रा", rate: "दर", amount: "राशि" }
  },
  es: {
    title: ["FACTURA", "PRESUPUESTO", "RECIBO"], bill: ["FACTURAR A", "PREPARADO PARA", "RECIBIDO DE"],
    date: ["Fecha de factura", "Fecha del presupuesto", "Fecha del recibo"], due: ["Fecha de vencimiento", "Válido hasta", "Fecha de pago"],
    balance: ["Saldo pendiente", "Total estimado", "Importe pagado"], noun: ["Factura", "Presupuesto", "Recibo"],
    ref: "Referencia", note: "NOTA", payment: "DATOS DE PAGO", terms: "CONDICIONES", payTerms: "Condiciones de pago", tax: "Impuesto",
    paid: "Importe pagado", subtotal: "Subtotal", discount: "Descuento", shipping: "Envío", total: "Total", balanceRow: "Saldo pendiente",
    itemTax: "Impuesto por artículo", words: "Importe en letras", payOnline: "Pagar en línea", scan: "Escanea para pagar", sign: "Firma autorizada",
    receipt: "Pago al recibir", net: "Neto", cols: { sku: "Código", description: "Descripción", quantity: "Cant.", rate: "Precio", amount: "Importe" }
  },
  fr: {
    title: ["FACTURE", "DEVIS", "REÇU"], bill: ["FACTURÉ À", "PRÉPARÉ POUR", "REÇU DE"],
    date: ["Date de facture", "Date du devis", "Date du reçu"], due: ["Date d'échéance", "Valable jusqu'au", "Date de paiement"],
    balance: ["Solde dû", "Total estimé", "Montant payé"], noun: ["Facture", "Devis", "Reçu"],
    ref: "Référence", note: "NOTE", payment: "COORDONNÉES DE PAIEMENT", terms: "CONDITIONS", payTerms: "Conditions de paiement", tax: "Taxe",
    paid: "Montant payé", subtotal: "Sous-total", discount: "Remise", shipping: "Livraison", total: "Total", balanceRow: "Solde dû",
    itemTax: "Taxe par article", words: "Montant en lettres", payOnline: "Payer en ligne", scan: "Scannez pour payer", sign: "Signature autorisée",
    receipt: "Payable à réception", net: "Net", cols: { sku: "Réf.", description: "Description", quantity: "Qté", rate: "Prix unitaire", amount: "Montant" }
  },
  de: {
    title: ["RECHNUNG", "ANGEBOT", "QUITTUNG"], bill: ["RECHNUNG AN", "ERSTELLT FÜR", "ERHALTEN VON"],
    date: ["Rechnungsdatum", "Angebotsdatum", "Quittungsdatum"], due: ["Fälligkeitsdatum", "Gültig bis", "Zahlungsdatum"],
    balance: ["Offener Betrag", "Geschätzte Summe", "Bezahlter Betrag"], noun: ["Rechnung", "Angebot", "Quittung"],
    ref: "Referenz", note: "HINWEIS", payment: "ZAHLUNGSINFORMATIONEN", terms: "BEDINGUNGEN", payTerms: "Zahlungsbedingungen", tax: "Steuer",
    paid: "Bezahlter Betrag", subtotal: "Zwischensumme", discount: "Rabatt", shipping: "Versand", total: "Gesamt", balanceRow: "Offener Betrag",
    itemTax: "Positionssteuer", words: "Betrag in Worten", payOnline: "Online bezahlen", scan: "Zum Bezahlen scannen", sign: "Autorisierte Unterschrift",
    receipt: "Zahlbar bei Erhalt", net: "Netto", cols: { sku: "Art.-Nr.", description: "Beschreibung", quantity: "Menge", rate: "Preis", amount: "Betrag" }
  },
  pt: {
    title: ["FATURA", "ORÇAMENTO", "RECIBO"], bill: ["FATURAR A", "PREPARADO PARA", "RECEBIDO DE"],
    date: ["Data da fatura", "Data do orçamento", "Data do recibo"], due: ["Data de vencimento", "Válido até", "Data de pagamento"],
    balance: ["Saldo devedor", "Total estimado", "Valor pago"], noun: ["Fatura", "Orçamento", "Recibo"],
    ref: "Referência", note: "NOTA", payment: "DADOS DE PAGAMENTO", terms: "TERMOS", payTerms: "Condições de pagamento", tax: "Imposto",
    paid: "Valor pago", subtotal: "Subtotal", discount: "Desconto", shipping: "Frete", total: "Total", balanceRow: "Saldo devedor",
    itemTax: "Imposto por item", words: "Valor por extenso", payOnline: "Pagar online", scan: "Escaneie para pagar", sign: "Assinatura autorizada",
    receipt: "Pagamento no recebimento", net: "Líquido", cols: { sku: "Código", description: "Descrição", quantity: "Qtd.", rate: "Preço", amount: "Valor" }
  }
};
const DOC_INDEX = { invoice: 0, estimate: 1, receipt: 2 };

export function langPack(code) { return T[code] || T.en; }
export function tr(code, key, docType) {
  const v = langPack(code)[key];
  return Array.isArray(v) ? v[DOC_INDEX[docType] ?? 0] : v;
}

/* Label field id → key in the pack. Values are written (or cleared, for English,
   so the built-in English placeholders show). */
const FIELD_KEYS = {
  labelTitle: "title", labelBillTo: "bill", labelInvoiceDate: "date", labelDueDate: "due", labelBalance: "balance",
  labelReference: "ref", labelNote: "note", labelPayment: "payment", labelTerms: "terms", labelPayTerms: "payTerms",
  labelTax: "tax", labelPaid: "paid"
};
const KNOWN_COL_LABELS = key => new Set(LANGS.map(l => T[l].cols[key]).concat(key === "quantity" ? ["Quantity"] : []));

export function applyLanguage(code, docType, $, columns) {
  Object.entries(FIELD_KEYS).forEach(([id, key]) => {
    const el = $(id); if (!el) return;
    el.value = code === "en" ? "" : tr(code, key, docType);
  });
  const sn = $("signName");
  if (sn && (!sn.value.trim() || LANGS.some(l => T[l].sign === sn.value.trim()))) sn.value = code === "en" ? "" : T[code].sign;
  // Default column headings follow the language; renamed columns are left alone.
  (columns || []).forEach(c => {
    if (T.en.cols[c.key] && KNOWN_COL_LABELS(c.key).has(c.label)) c.label = langPack(code).cols[c.key];
  });
}
