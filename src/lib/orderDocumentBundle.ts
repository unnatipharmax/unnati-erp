import { readFile } from "fs/promises";
import path from "path";
import JSZip from "jszip";
import {
  getPrescriptionAbsolutePath,
  sanitizeDownloadName,
} from "./prescriptions";

type DocumentItem = {
  productName: string;
  composition: string | null;
  manufacturer: string | null;
  hsn: string | null;
  pack: string | null;
  gstPercent: number | null;
  batchNo: string | null;
  mfgDate: string | null;
  expDate: string | null;
  quantity: number;
  inrUnit: number | null;
  amount: number | null;
};

export type DocumentBundleOrder = {
  id: string;
  invoiceNo: string | null;
  invoiceGeneratedAt: Date | null;
  createdAt: Date;
  fullName: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  remitterName: string;
  currency: string;
  shipmentMode: string | null;
  shippingPrice: number;
  exchangeRate: number;
  dollarAmount: number | null;
  prescriptionOriginalName: string | null;
  prescriptionStoredName: string | null;
  items: DocumentItem[];
};

const TEMPLATE_DIR = path.join(
  process.cwd(),
  "src",
  "app",
  "templates",
  "invoice"
);

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatDateLongIN(date: Date) {
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatDateShort(date: Date) {
  return date
    .toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "2-digit",
    })
    .replace(/ /g, "-");
}

function formatDateSlash(date: Date) {
  return date.toLocaleDateString("en-GB");
}

function formatMoney(value: number | null | undefined, digits = 2) {
  if (value == null) return "";
  return value.toFixed(digits);
}

function wordsBelowThousand(n: number): string {
  const ones = [
    "",
    "ONE",
    "TWO",
    "THREE",
    "FOUR",
    "FIVE",
    "SIX",
    "SEVEN",
    "EIGHT",
    "NINE",
    "TEN",
    "ELEVEN",
    "TWELVE",
    "THIRTEEN",
    "FOURTEEN",
    "FIFTEEN",
    "SIXTEEN",
    "SEVENTEEN",
    "EIGHTEEN",
    "NINETEEN",
  ];
  const tens = [
    "",
    "",
    "TWENTY",
    "THIRTY",
    "FORTY",
    "FIFTY",
    "SIXTY",
    "SEVENTY",
    "EIGHTY",
    "NINETY",
  ];

  if (n === 0) return "";
  if (n < 20) return ones[n];
  if (n < 100) {
    return tens[Math.floor(n / 10)] + (n % 10 ? ` ${ones[n % 10]}` : "");
  }

  return (
    `${ones[Math.floor(n / 100)]} HUNDRED` +
    (n % 100 ? ` ${wordsBelowThousand(n % 100)}` : "")
  );
}

function numberToWords(n: number): string {
  if (n === 0) return "ZERO";
  if (n < 1000) return wordsBelowThousand(n);
  if (n < 100000) {
    return (
      `${numberToWords(Math.floor(n / 1000))} THOUSAND` +
      (n % 1000 ? ` ${numberToWords(n % 1000)}` : "")
    );
  }
  if (n < 10000000) {
    return (
      `${numberToWords(Math.floor(n / 100000))} LAKH` +
      (n % 100000 ? ` ${numberToWords(n % 100000)}` : "")
    );
  }

  return (
    `${numberToWords(Math.floor(n / 10000000))} CRORE` +
    (n % 10000000 ? ` ${numberToWords(n % 10000000)}` : "")
  );
}

function dollarsToWords(value: number) {
  const whole = Math.floor(value);
  const cents = Math.round((value - whole) * 100);
  const base = `${numberToWords(whole)} DOLLARS`;
  if (!cents) return `${base} ONLY`;
  return `${base} AND ${numberToWords(cents)} CENTS ONLY`;
}

function rupeesToWords(value: number) {
  const whole = Math.floor(value);
  const paise = Math.round((value - whole) * 100);
  const base = `${numberToWords(whole)} RUPEES`;
  if (!paise) return `${base} ONLY`;
  return `${base} AND ${numberToWords(paise)} PAISE ONLY`;
}

function renderTemplate(
  template: string,
  values: Record<string, string>,
  loops: Record<string, Array<Record<string, string>>> = {}
) {
  let rendered = template.replace(
    /{{#(\w+)}}([\s\S]*?){{\/\1}}/g,
    (_match, key: string, block: string) => {
      const rows = loops[key] ?? [];
      return rows
        .map((row) =>
          block.replace(/{{(\w+)}}/g, (_rowMatch, token: string) => row[token] ?? "")
        )
        .join("");
    }
  );

  rendered = rendered.replace(/{{(\w+)}}/g, (_match, token: string) => {
    return values[token] ?? "";
  });

  return rendered;
}

async function loadTemplate(fileName: string) {
  return readFile(path.join(TEMPLATE_DIR, fileName), "utf8");
}

export async function buildOrderDocumentBundle(order: DocumentBundleOrder) {
  const [gstTemplate, packingTemplate, form2Template, edfTemplate] =
    await Promise.all([
      loadTemplate("gst-invoice.html"),
      loadTemplate("product-list-invoice.html"),
      loadTemplate("form-2-invoice.html"),
      loadTemplate("edf-invoice.html"),
    ]);

  const invoiceDate = order.invoiceGeneratedAt ?? order.createdAt;
  const exchangeRate = order.exchangeRate || 84;
  const itemTotalInr = order.items.reduce((sum, item) => sum + (item.amount ?? 0), 0);
  const totalInr = itemTotalInr + order.shippingPrice;
  const totalUsd = order.dollarAmount ?? 0;
  const fobInr = totalUsd * exchangeRate;
  const safeBaseName = sanitizeDownloadName(order.invoiceNo || order.id);
  const addressLine2 = [order.city, order.state].filter(Boolean).join(", ");
  const cityLine = `${addressLine2} ${order.postalCode}`.trim();

  const values = {
    invoice_no: escapeHtml(order.invoiceNo ?? order.id),
    invoice_date: escapeHtml(formatDateLongIN(invoiceDate)),
    invoice_date_short: escapeHtml(formatDateShort(invoiceDate)),
    invoice_date_slash: escapeHtml(formatDateSlash(invoiceDate)),
    invoice_date_long: escapeHtml(formatDateLongIN(invoiceDate)),
    consignee_name: escapeHtml(order.fullName),
    consignee_address: escapeHtml(order.address),
    consignee_address_line_1: escapeHtml(order.address),
    consignee_address_line_2: escapeHtml(addressLine2 || order.country),
    consignee_city_line: escapeHtml(cityLine),
    consignee_postal_code: escapeHtml(order.postalCode),
    consignee_country: escapeHtml(order.country),
    buyer_reference: escapeHtml(order.remitterName),
    shipment_method: escapeHtml(`By Air through ${order.shipmentMode ?? "EMS"}`),
    pre_carrier: "Mumbai",
    port_of_loading: "Mumbai",
    final_destination: escapeHtml(order.country),
    shipping_charges: formatMoney(order.shippingPrice),
    total_inr: formatMoney(totalInr),
    total_usd: formatMoney(totalUsd),
    amount_words: escapeHtml(dollarsToWords(totalUsd)),
    shipping_country: escapeHtml(order.country),
    foreign_post_office_code: "INBOM5",
    iec: "FNXPP3883B",
    state_code: "27",
    currency: escapeHtml(order.currency),
    exchange_rate: formatMoney(exchangeRate),
    total_assessable_value: formatMoney(fobInr),
    invoice_currency: escapeHtml(order.currency),
    invoice_amount: formatMoney(totalUsd),
    fob_value: formatMoney(totalUsd),
    freight: formatMoney(order.shippingPrice),
    total_fob_value_words_inr: escapeHtml(rupeesToWords(fobInr)),
    custom_assessable_value: formatMoney(fobInr),
  };

  const items = order.items.map((item, index) => ({
    sr: String(index + 1),
    consignee_name: escapeHtml(order.fullName),
    product: escapeHtml(item.productName),
    composition: escapeHtml(item.composition ?? ""),
    manufacturer: escapeHtml(item.manufacturer ?? ""),
    hsn: escapeHtml(item.hsn ?? ""),
    packing: escapeHtml(item.pack ?? ""),
    gst: item.gstPercent != null ? escapeHtml(`${item.gstPercent}%`) : "",
    batch: escapeHtml(item.batchNo ?? ""),
    mfg_date: escapeHtml(item.mfgDate ?? ""),
    exp_date: escapeHtml(item.expDate ?? ""),
    qty: String(item.quantity),
    rate: formatMoney(item.inrUnit),
    amount: formatMoney(item.amount),
    unit: escapeHtml(item.pack ?? "PCS"),
    shipping_country: escapeHtml(order.country),
  }));

  const zip = new JSZip();
  zip.file(`${safeBaseName}-gst-invoice.html`, renderTemplate(gstTemplate, values, { items }));
  zip.file(`${safeBaseName}-packing-list.html`, renderTemplate(packingTemplate, values, { items }));
  zip.file(`${safeBaseName}-form-2.html`, renderTemplate(form2Template, values, { items }));
  zip.file(`${safeBaseName}-edf.html`, renderTemplate(edfTemplate, values, { items }));

  if (order.prescriptionStoredName) {
    try {
      const prescriptionBuffer = await readFile(
        getPrescriptionAbsolutePath(order.prescriptionStoredName)
      );
      const prescriptionName = order.prescriptionOriginalName
        ? sanitizeDownloadName(order.prescriptionOriginalName)
        : `prescription${path.extname(order.prescriptionStoredName)}`;

      zip.file(`${safeBaseName}-${prescriptionName}`, prescriptionBuffer);
    } catch {
      zip.file(
        `${safeBaseName}-prescription-missing.txt`,
        "A prescription was attached to this order, but the file could not be found on disk."
      );
    }
  }

  const buffer = await zip.generateAsync({ type: "nodebuffer" });

  return {
    buffer,
    fileName: `${safeBaseName}-documents.zip`,
  };
}
