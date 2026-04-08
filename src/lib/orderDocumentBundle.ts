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
  netWeight: number | null;
  grossWeight: number | null;
  trackingNo?: string | null;
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
  if (order.shipmentMode === "DHL") {
    return buildDHLDocumentBundle(order);
  }
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

// ── DHL Document Bundle ────────────────────────────────────────────────────────
async function buildDHLDocumentBundle(order: DocumentBundleOrder) {
  const invoiceDate = order.invoiceGeneratedAt ?? order.createdAt;
  const dateSlash   = formatDateSlash(invoiceDate);        // DD/MM/YYYY
  const dateShort   = formatDateShort(invoiceDate);        // DD-Mon-YY
  const dateLong    = formatDateLongIN(invoiceDate);       // DD Month YYYY
  const totalUsd    = order.dollarAmount ?? 0;
  const netWt       = order.netWeight   != null ? String(order.netWeight)   : "";
  const grossWt     = order.grossWeight != null ? String(order.grossWeight) : "";
  const safeBaseName = sanitizeDownloadName(order.invoiceNo || order.id);
  const invoiceNo   = order.invoiceNo ?? order.id;

  const consigneeBlock = [
    order.fullName,
    order.address,
    [order.city, order.state].filter(Boolean).join(", "),
    `${order.postalCode} ${order.country}`.trim(),
  ].filter(Boolean).join("\n");

  const awb = order.trackingNo ?? "";
  const iec = "FNXPP3883B";
  const gstin = "27FNXPP3883B1ZA";
  const pan = "FNXPP3883B";

  // ── 1. EXPORTS INVOICE ────────────────────────────────────────────────────
  const itemRows = order.items.map((item, i) => {
    const usdUnit  = totalUsd > 0 && order.items.length > 0
      ? (totalUsd / order.items.reduce((s, it) => s + it.quantity, 0))
      : 0;
    const lineUsd  = item.inrUnit != null
      ? (item.inrUnit * item.quantity / (order.exchangeRate || 84))
      : (usdUnit * item.quantity);
    return `<tr>
      <td style="border:1px solid #000;padding:3px 6px;text-align:center">${i + 1}</td>
      <td style="border:1px solid #000;padding:3px 6px">${escapeHtml(item.productName)}</td>
      <td style="border:1px solid #000;padding:3px 6px">${escapeHtml(item.composition ?? "")}</td>
      <td style="border:1px solid #000;padding:3px 6px;text-align:center">${escapeHtml(item.hsn ?? "")}</td>
      <td style="border:1px solid #000;padding:3px 6px;text-align:center">${escapeHtml(item.pack ?? "")}</td>
      <td style="border:1px solid #000;padding:3px 6px;text-align:center">${escapeHtml(item.mfgDate ?? "")}</td>
      <td style="border:1px solid #000;padding:3px 6px;text-align:center">${escapeHtml(item.expDate ?? "")}</td>
      <td style="border:1px solid #000;padding:3px 6px;text-align:center">${escapeHtml(item.batchNo ?? "")}</td>
      <td style="border:1px solid #000;padding:3px 6px;text-align:center">${item.quantity}</td>
      <td style="border:1px solid #000;padding:3px 6px;text-align:right">${lineUsd > 0 ? (lineUsd / item.quantity).toFixed(6) : ""}</td>
      <td style="border:1px solid #000;padding:3px 6px;text-align:right">${lineUsd > 0 ? lineUsd.toFixed(1) : ""}</td>
    </tr>`;
  }).join("");

  const exportsInvoice = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Exports Invoice - ${invoiceNo}</title>
<style>body{font-family:Arial,sans-serif;font-size:8.5pt;margin:10mm}table{border-collapse:collapse;width:100%}th{background:#f0f0f0}</style>
</head><body>
<h2 style="text-align:center;font-size:11pt;margin:0 0 4px">EXPORTS INVOICE</h2>
<table style="margin-bottom:8px;font-size:8pt">
  <tr>
    <td style="width:50%;vertical-align:top">
      <strong>UNNATI PHARMAX</strong><br>
      Ground Floor House No 307/4,<br>
      Guru Vandana Apartment, Kakasaheb Cholkar Marg,<br>
      Lakadganj, Nagpur, MAHARASHTRA, 440008<br>
      IEC NO: ${iec} &nbsp;|&nbsp; GSTIN: ${gstin}
    </td>
    <td style="width:50%;vertical-align:top;text-align:right">
      <strong>INVOICE NO:</strong> ${invoiceNo}<br>
      <strong>DATE:</strong> ${dateSlash}<br>
      <strong>WAY BILL:</strong> ${awb}
    </td>
  </tr>
</table>
<table style="margin-bottom:8px;font-size:8pt">
  <tr>
    <td style="width:50%;border:1px solid #000;padding:5px;vertical-align:top">
      <strong>Consignee:</strong><br>${escapeHtml(consigneeBlock).replace(/\n/g,"<br>")}
    </td>
    <td style="width:50%;border:1px solid #000;padding:5px;vertical-align:top">
      <strong>BUYER:</strong> ${escapeHtml(order.remitterName)}<br>
      <strong>ORIGIN COUNTRY:</strong> INDIA<br>
      <strong>DESTINATION COUNTRY:</strong> ${escapeHtml(order.country)}<br>
      <strong>DELIVERY TERMS:</strong> C&amp;F &nbsp;|&nbsp; <strong>PAYMENT TERM:</strong> AD<br>
      <strong>LUT ARN NO.:</strong> AD271023037544C<br>
      <strong>DL NO.:</strong> MH-NG2-526038, MH-NG2-526039
    </td>
  </tr>
</table>
<table style="font-size:7.5pt;margin-bottom:6px">
  <thead>
    <tr style="background:#eee">
      <th style="border:1px solid #000;padding:3px;text-align:center">SR.</th>
      <th style="border:1px solid #000;padding:3px">PARTICULARS</th>
      <th style="border:1px solid #000;padding:3px">DRUG CONTENT</th>
      <th style="border:1px solid #000;padding:3px;text-align:center">HSN</th>
      <th style="border:1px solid #000;padding:3px;text-align:center">PACK SIZE</th>
      <th style="border:1px solid #000;padding:3px;text-align:center">MFG DATE</th>
      <th style="border:1px solid #000;padding:3px;text-align:center">EXPIRY DATE</th>
      <th style="border:1px solid #000;padding:3px;text-align:center">BATCH NO</th>
      <th style="border:1px solid #000;padding:3px;text-align:center">QTY</th>
      <th style="border:1px solid #000;padding:3px;text-align:right">UNIT PRICE USD</th>
      <th style="border:1px solid #000;padding:3px;text-align:right">TOTAL USD</th>
    </tr>
  </thead>
  <tbody>${itemRows}</tbody>
  <tfoot>
    <tr>
      <td colspan="10" style="border:1px solid #000;padding:3px;text-align:right;font-weight:700">TOTAL FOB VALUE</td>
      <td style="border:1px solid #000;padding:3px;text-align:right;font-weight:700">${totalUsd.toFixed(0)}</td>
    </tr>
    <tr>
      <td colspan="10" style="border:1px solid #000;padding:3px;text-align:right">FREIGHT</td>
      <td style="border:1px solid #000;padding:3px;text-align:right">0</td>
    </tr>
    <tr>
      <td colspan="10" style="border:1px solid #000;padding:3px;text-align:right;font-weight:700">TOTAL VALUE WITH FREIGHT</td>
      <td style="border:1px solid #000;padding:3px;text-align:right;font-weight:700">${totalUsd.toFixed(0)}</td>
    </tr>
  </tfoot>
</table>
<p style="font-size:8pt"><strong>USD IN WORD:</strong> ${dollarsToWords(totalUsd)}</p>
<p style="font-size:7.5pt">Net Weight: <strong>${netWt} kg</strong> &nbsp;|&nbsp; Gross Weight: <strong>${grossWt} kg</strong></p>
<p style="font-size:7.5pt">Declaration: We Intend To Claim Rewards Under Merchandise Export From India Scheme (MEIS)<br>
I/WE UNDERTAKE TO ABIDE BY THE PROVISIONS OF EXCHANGE MANAGEMENT ACT, 1999.</p>
<p style="font-size:8pt;text-align:right;margin-top:20px"><strong>AUTHORISED SIGNATORY FOR UNNATI PHARMAX</strong></p>
</body></html>`;

  // ── 2. DHL PACKING LIST ───────────────────────────────────────────────────
  const packingRows = order.items.map((item, i) => `<tr>
    <td style="border:1px solid #000;padding:3px 6px;text-align:center">${i + 1}</td>
    <td style="border:1px solid #000;padding:3px 6px">${escapeHtml(order.fullName)}</td>
    <td style="border:1px solid #000;padding:3px 6px;font-weight:700">${escapeHtml(item.productName)}</td>
    <td style="border:1px solid #000;padding:3px 6px;text-align:center">${escapeHtml(item.pack ?? "")}</td>
    <td style="border:1px solid #000;padding:3px 6px">${escapeHtml(item.manufacturer ?? "")}</td>
    <td style="border:1px solid #000;padding:3px 6px;text-align:center;font-family:monospace">${escapeHtml(item.batchNo ?? "")}</td>
    <td style="border:1px solid #000;padding:3px 6px;text-align:center">${escapeHtml(item.expDate ?? "")}</td>
    <td style="border:1px solid #000;padding:3px 6px;text-align:center;font-weight:700">${item.quantity}.00</td>
    <td style="border:1px solid #000;padding:3px 6px;text-align:center">DHL</td>
    <td style="border:1px solid #000;padding:3px 6px;text-align:center">${escapeHtml(order.country)}</td>
  </tr>`).join("");

  const packingList = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Packing List - ${invoiceNo}</title>
<style>body{font-family:Arial,sans-serif;font-size:8.5pt;margin:10mm}table{border-collapse:collapse;width:100%}th{background:#ffff00;font-weight:700}</style>
</head><body>
<h2 style="text-align:center;font-size:12pt;margin:0 0 8px">Packing List</h2>
<table style="margin-bottom:8px;font-size:8.5pt">
  <tr><td style="width:30%;font-weight:700">Invoice No.</td><td style="background:#ffff00;font-weight:700">${invoiceNo}</td></tr>
  <tr><td style="font-weight:700">Date :-</td><td style="background:#ffff00;font-weight:700">${dateSlash}</td></tr>
</table>
<table style="font-size:8pt">
  <thead>
    <tr>
      <th style="border:1px solid #000;padding:4px;text-align:center">SR.NO</th>
      <th style="border:1px solid #000;padding:4px">CUSTOMER NAME</th>
      <th style="border:1px solid #000;padding:4px">Product Name</th>
      <th style="border:1px solid #000;padding:4px;text-align:center">packing</th>
      <th style="border:1px solid #000;padding:4px">Manufacturer</th>
      <th style="border:1px solid #000;padding:4px;text-align:center">Batch No</th>
      <th style="border:1px solid #000;padding:4px;text-align:center">Exp date</th>
      <th style="border:1px solid #000;padding:4px;text-align:center">QTY</th>
      <th style="border:1px solid #000;padding:4px;text-align:center">Shipping</th>
      <th style="border:1px solid #000;padding:4px;text-align:center">country</th>
    </tr>
  </thead>
  <tbody>${packingRows}</tbody>
</table>
<p style="margin-top:10px;font-size:8pt"><strong>Consignee:</strong><br>${escapeHtml(consigneeBlock).replace(/\n/g,"<br>")}</p>
</body></html>`;

  // ── 3. ADC SHEET ──────────────────────────────────────────────────────────
  const adcRows = order.items.map((item, i) => `<tr>
    <td style="border:1px solid #000;padding:3px 6px;text-align:center">${i + 1}</td>
    <td style="border:1px solid #000;padding:3px 6px">${i === 1 ? `${invoiceNo} &amp; ${dateSlash}` : ""}</td>
    <td style="border:1px solid #000;padding:3px 6px;font-weight:700;color:#ff8c00">${escapeHtml(item.productName)}</td>
    <td style="border:1px solid #000;padding:3px 6px;text-align:center;font-family:monospace">${escapeHtml(item.batchNo ?? "")}</td>
    <td style="border:1px solid #000;padding:3px 6px;text-align:center">${escapeHtml(item.mfgDate ?? "")}</td>
    <td style="border:1px solid #000;padding:3px 6px;text-align:center">${escapeHtml(item.expDate ?? "")}</td>
    <td style="border:1px solid #000;padding:3px 6px;text-align:center;font-weight:700">${item.quantity}</td>
    <td style="border:1px solid #000;padding:3px 6px"></td>
    <td style="border:1px solid #000;padding:3px 6px"></td>
    <td style="border:1px solid #000;padding:3px 6px;text-align:right">${i === 1 ? totalUsd.toLocaleString("en-IN") : ""}</td>
    <td style="border:1px solid #000;padding:3px 6px"></td>
  </tr>`).join("");

  const adcSheet = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>ADC Sheet - ${invoiceNo}</title>
<style>body{font-family:Arial,sans-serif;font-size:8pt;margin:8mm}table{border-collapse:collapse;width:100%}</style>
</head><body>
<p style="text-align:center;font-size:8pt;margin:0">Government of India<br>
Ministry of Health &amp; Family Welfare, Directorate General of Health Services,<br>
O/o Asst. Drugs Controller, Central Drugs Standard Control Organization<br>
<strong>PORT OFFICE</strong><br>
International Air Cargo Complex, Sahar Village, Andheri, Mumbai - 400 099.</p>
<h3 style="text-align:center;margin:6px 0">ADC (I) SHEET FOR EXPORT</h3>
<table style="font-size:7.5pt;margin-bottom:6px">
  <tr><td style="width:30%"><strong>ADC Entry No.</strong></td><td></td><td style="width:30%"><strong>Shipping Bill No &amp; Date</strong></td><td style="color:#00f;font-weight:700">${awb} &amp; ${dateSlash}</td></tr>
  <tr><td><strong>IEC Number</strong></td><td style="font-weight:700">${iec}</td><td></td><td></td></tr>
</table>
<table style="font-size:7.5pt;margin-bottom:6px">
  <tr>
    <td style="width:20%;vertical-align:top"><strong>Port of Loading</strong><br>AIR CARGO SHARA MUMBAI</td>
    <td style="width:40%;vertical-align:top"><strong>Name &amp; Address of Exporter:</strong><br>
      UNNATI PHARMAX<br>Ground Floor House No 307/4,<br>Guru Vandana Apartment, Kakasaheb Cholkar Marg,<br>Lakadganj, Nagpur, NAGPUR, MAHARASHTRA, 440008
    </td>
    <td style="width:40%;vertical-align:top;border:1px solid #000;padding:4px"><strong>Name &amp; Address of Consignee:</strong><br>${escapeHtml(consigneeBlock).replace(/\n/g,"<br>")}</td>
  </tr>
</table>
<table style="font-size:7.5pt">
  <thead>
    <tr style="background:#eee">
      <th style="border:1px solid #000;padding:3px;text-align:center">S.No.</th>
      <th style="border:1px solid #000;padding:3px">Invoice No/ Date</th>
      <th style="border:1px solid #000;padding:3px">Name of the Product</th>
      <th style="border:1px solid #000;padding:3px;text-align:center">Batch No</th>
      <th style="border:1px solid #000;padding:3px;text-align:center">Mfg. Date</th>
      <th style="border:1px solid #000;padding:3px;text-align:center">Exp. Date</th>
      <th style="border:1px solid #000;padding:3px;text-align:center">Total Export Qty</th>
      <th style="border:1px solid #000;padding:3px;text-align:center">ADC Sample Qty</th>
      <th style="border:1px solid #000;padding:3px;text-align:center">DSL/DML No</th>
      <th style="border:1px solid #000;padding:3px;text-align:right">FOB Value INR</th>
      <th style="border:1px solid #000;padding:3px">Remarks/CHA Details</th>
    </tr>
  </thead>
  <tbody>${adcRows}</tbody>
</table>
<table style="margin-top:10px;font-size:7.5pt">
  <tr>
    <td style="width:50%;vertical-align:top">
      <strong>Enclosures</strong><br>
      M/S KAUSHIK PATEL<br>
      1. Shipping Bill :<br>2. Invoice :<br>3. Packing List :<br>
      4. Certificate of Analysis :<br>5. Sample :<br>6. Drug Licence :
    </td>
    <td style="width:50%;vertical-align:top;text-align:right">
      <strong>AUTHORISED SIGNATORY</strong><br><br>
      1 Receiving Time<br>2 Verified. Time<br>3 Released Time<br>4 Out Time
    </td>
  </tr>
</table>
</body></html>`;

  // ── 4. SHIPPER'S LETTER OF INSTRUCTIONS ──────────────────────────────────
  const shipperLetter = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Shipper's Letter - ${invoiceNo}</title>
<style>body{font-family:Arial,sans-serif;font-size:8pt;margin:10mm}table{border-collapse:collapse;width:100%}td,th{padding:2px 5px}.hl{background:#ffff00;font-weight:700}</style>
</head><body>
<h3 style="text-align:center;background:#ffff00;padding:4px;margin:0 0 6px">SHIPPER'S LETTER OF INSTRUCTIONS</h3>
<table style="margin-bottom:6px">
  <tr><td style="width:30%"><strong>Shipper Name:</strong></td><td class="hl">UNNATI PHARMAX</td><td style="width:20%"><strong>Invoice No.:</strong></td><td class="hl">${invoiceNo}</td></tr>
  <tr><td><strong>Consignee Name:</strong></td><td class="hl">${escapeHtml(order.fullName)}</td><td><strong>Invoice Date:</strong></td><td class="hl">${dateSlash}</td></tr>
</table>
<table style="margin-bottom:6px">
  <tr><td style="width:40%"><strong>DHL AIR WAYBILL NUMBER (AWB):</strong></td><td class="hl" colspan="3">${awb}</td></tr>
  <tr><td><strong>IE CODE NO (10 DIGIT):</strong></td><td class="hl">${iec}</td><td><strong>PAN NUMBER:</strong></td><td class="hl">${pan}</td></tr>
  <tr><td><strong>GSTIN NUMBER:</strong></td><td class="hl" colspan="3">${gstin}</td></tr>
</table>
<table style="margin-bottom:6px;font-size:7.5pt">
  <tr><td colspan="4"><strong>IGST Payment Status:</strong></td></tr>
  <tr><td>A) NOT APPLICABLE</td><td></td><td>B) LUT - Export Under Bond</td><td class="hl">YES</td></tr>
  <tr><td colspan="4">C) Export Against Payment (in INR on export invoice)</td></tr>
</table>
<table style="margin-bottom:6px;font-size:7.5pt">
  <tr><td style="width:40%"><strong>INCOTERMS:</strong></td><td class="hl">C&amp;F</td><td style="width:20%"><strong>FOB VALUE</strong></td><td class="hl">${totalUsd}</td></tr>
  <tr><td><strong>NATURE OF PAYMENT:</strong></td><td class="hl">AD</td><td><strong>NO. OF PKGS.</strong></td><td class="hl">1</td></tr>
  <tr><td><strong>NET WT.</strong></td><td class="hl">${netWt}</td><td><strong>GROSS WT.</strong></td><td class="hl">${grossWt}</td></tr>
  <tr><td><strong>STATE OF ORIGIN</strong></td><td class="hl">MAHARASHTRA</td><td><strong>DISTRICT OF ORIGIN</strong></td><td class="hl">MAHARASHTRA</td></tr>
  <tr><td><strong>CATEGORY OF SHIPPER:</strong></td><td class="hl">Merchant</td><td><strong>Manufacturer:</strong></td><td class="hl">HETER PHARMA</td></tr>
</table>
<p style="font-size:7.5pt"><strong>Please TICK &amp; LIST the documents provided to DHL with the shipment:</strong></p>
<table style="font-size:7pt">
  <tr><td>1. INVOICE (4 COPIES)</td><td>5. MSDS</td></tr>
  <tr><td>2. PACKING LIST (4 COPIES)</td><td>6. PHYTOSANITARY CERT</td></tr>
  <tr><td>3. NON-DG DECLARATION</td><td>7. VISA/AEPC ENDORSEMENT</td></tr>
  <tr><td>4. LAB ANALYSIS REPORT</td><td>8. LETTER TO DC</td></tr>
</table>
<p style="margin-top:20px;font-size:8pt;text-align:right"><strong>SIGNATURE OF EXPORTER / STAMP</strong></p>
</body></html>`;

  // ── 5. EXPORT DECLARATION ─────────────────────────────────────────────────
  const exportDeclaration = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Export Declaration - ${invoiceNo}</title>
<style>body{font-family:Arial,sans-serif;font-size:10pt;margin:20mm}p{line-height:1.6}table{border-collapse:collapse;margin:10px 0}td,th{border:1px solid #000;padding:6px 10px}</style>
</head><body>
<h2 style="text-align:center">DECLARATION</h2>
<p>I/We declare that the particulars given herein above are true, correct and complete.<br>
I/We enclose herewith copies of the following documents*.</p>
<ol>
  <li>Duty Exemption Entitlement Certificate / Advance Authorisation / Duty Free Import Authorisation Declaration</li>
  <li>Invoice / Invoice cum packing list</li>
  <li>Quota / Inspection certificates</li>
  <li>Others (Specify)</li>
</ol>
<table>
  <tr><td>Name of the Exporter:</td><td><strong>UNNATI PHARMAX</strong></td><td>Name of Customs Broker:</td><td></td></tr>
  <tr><td>Designation</td><td><strong>KAUSHIK PATEL</strong></td><td>Designation</td><td></td></tr>
  <tr><td colspan="2"></td><td>Identity Card Number</td><td></td></tr>
</table>
<p>I/We undertake to abide by the provisions of Foreign Exchange Management Act, 1999, as amended from time to time, including realisation or repatriation of foreign exchange to or from India.</p>
<p style="font-size:8pt">* To be submitted with the exports goods in the warehouse.</p>
<br><br>
<p>Date <strong style="background:#ffff00">${dateSlash}</strong> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Signature:………………………..&quot;;</p>
</body></html>`;

  // ── 6. CUSTOM DECLARATION LETTER ─────────────────────────────────────────
  const productNames = order.items.map(i => i.productName).join(", ");
  const customDeclaration = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Custom Declaration - ${invoiceNo}</title>
<style>body{font-family:Arial,sans-serif;font-size:11pt;margin:20mm}p{line-height:1.8}.hl{background:#ffff00;font-weight:700}</style>
</head><body>
<p style="text-align:right" class="hl">Dt. ${dateSlash}</p>
<p><strong>To,</strong></p>
<p><strong>The Assistant Commissioner of Customs – Exports</strong></p>
<p>&nbsp;&nbsp;&nbsp;&nbsp;<strong>Sub:</strong> Declaration to Custom</p>
<p>&nbsp;&nbsp;&nbsp;&nbsp;<strong>Ref.:</strong> DHL AWB Inv ${awb} no. ${invoiceNo}</p>
<p>Respected Sir / Madam,</p>
<p>We are exporting <strong>${escapeHtml(productNames)}</strong> to our customer <strong>${escapeHtml(order.fullName)}</strong>
covered under <strong>${awb}</strong> DHL AWB &amp; these are used <strong>under Pharmaceutical Guidelines and License.</strong></p>
<p>The product is non-narcotic, non-psychotropic, and not prohibited for export from India</p>
<p>We hereby declare that these contents do not fall under SCOMET List (Special Chemicals, Organisms,
Materials, Equipment and Technologies).</p>
<p>Above mentioned details are true &amp; checked by technical expert.</p>
<p>You are request to allow the same for export.</p>
<br><br>
<p>UNNATI PHARMAX</p>
<p>( Owner : Kaushik Patel )</p>
<p>(Company Seal, Signing Authority Name &amp; Designation)</p>
</body></html>`;

  // ── 7. AUTHORIZATION LETTER TO DHL ───────────────────────────────────────
  const authorizationLetter = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Authorization Letter - ${invoiceNo}</title>
<style>body{font-family:Arial,sans-serif;font-size:11pt;margin:20mm}p{line-height:1.8}.hl{background:#ffff00;font-weight:700}</style>
</head><body>
<h2 style="text-align:center"><strong>Authorization Letter</strong></h2>
<h3 style="text-align:center"><strong>To whomsoever it may concern</strong></h3>
<p>This letter may be considered as our authorization to DHL Express (India) Pvt. Ltd. ('DHL'),
including its group companies and their customs brokers and agents, to act as our agent for the
purpose of arranging customs clearance at various customs airports within India for all our
Shipments, arriving into or departing from, India under the provisions of the various Acts, Rules,
regulations and procedure as laid down under the regulatory environment of India to enable
DHL to arrange clearance of Import / Export shipment on my/our behalf.</p>
<p>I/We also give our consent and authorize DHL to generate, sign, submit and file on our behalf,
in physical form or digitally, the various forms like e-way bill, Bill of Entry, Shipping Bill and
other forms, as and when required, under various statutes for undertaking the carriage,
clearance or delivery of Shipment. Further, I / we undertake to make all payments towards
duties and taxes paid on my behalf to DHL.</p>
<p>I/We further declare that our Importer Exporter Code ("IEC") number/ GSTIN and Know Your
Customer ("KYC") are valid and we authorize DHL to use the same while undertaking
transportation and clearance of our shipments on our behalf.</p>
<p>This authority letter shall hold good for all proceedings and can be produced before Customs
and/or any statutory authority to confirm the authorization hereby given to DHL. The above
authorization to DHL supersedes all previous authority letters issued in this behalf and shall
remain valid, subsisting and continues until revoked in writing.</p>
<p>Thanking you,<br>Yours sincerely,</p>
<br><br>
<p>Signature:<br>Designation:<br>Authorised Signatory</p>
<p><strong>Company Name:</strong> UNNATI PHARMAX &nbsp;&nbsp;&nbsp; Company Stamp:</p>
<p><strong>Stamp:</strong> IEC No / GSTIN / KYC document number</p>
<p class="hl">Date: ${dateSlash}</p>
</body></html>`;

  // ── 8. NON-DGR CERTIFICATE ────────────────────────────────────────────────
  const nonDgrRows = order.items.map(item => `<tr>
    <td style="border:1px solid #000;padding:3px 6px">${escapeHtml(item.productName)}</td>
    <td style="border:1px solid #000;padding:3px 6px;text-align:center">${item.quantity}</td>
  </tr>`).join("");

  const nonDgrCert = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Non-DGR Certificate - ${invoiceNo}</title>
<style>body{font-family:Arial,sans-serif;font-size:9pt;margin:10mm}table{border-collapse:collapse;width:100%}th{background:#eee}</style>
</head><body>
<h3 style="text-align:center">Shipper's Certification for Non - Hazardous Cargo</h3>
<table style="margin-bottom:8px">
  <tr><td style="width:30%"><strong>DHL/AWB no.</strong></td><td class="hl" style="background:#ffff00;font-weight:700">${awb}</td><td><strong>Airport of Dep.</strong></td><td>MUMBAI</td><td><strong>Airport of Dest.</strong></td><td>${escapeHtml(order.country)}</td></tr>
  <tr><td><strong>MAWB no.</strong></td><td></td><td><strong>INDIA</strong></td><td>MUMBAI</td><td></td><td></td></tr>
</table>
<p style="font-size:8.5pt">This is to certify that the articles / substances of this shipment are properly described by name
that they are not listed in the current edition of IATA / Dangerous Goods Regulations (DGR),
Alphabetical List of Dangerous Goods, nor do they correspond to any of the hazard classes
appearing in the DGR, Section 3, classification of Dangerous goods and that they are known not to be
dangerous, i.e., not restricted.<br><br>
Furthermore the shipper confirms that the goods are in proper condition for transportation on
passenger carrying aircraft (DGR, 8.1.23.) of International Air Transport Association (IATA)</p>
<table style="margin-bottom:8px">
  <thead>
    <tr>
      <th style="border:1px solid #000;padding:4px">Marks and Proper description of goods (Trade Names not Permitted)</th>
      <th style="border:1px solid #000;padding:4px;text-align:center">Net Quantity</th>
    </tr>
  </thead>
  <tbody>${nonDgrRows}</tbody>
</table>
<table style="font-size:8.5pt">
  <tr>
    <td style="width:50%;vertical-align:top">
      <strong>Shipper:</strong><br>
      UNNATI PHARMAX<br>
      GROUND FLOOR HOUSE NO 307/04<br>
      GURU VANDANA APARTMENT KAKASAHEB<br>
      CHOLKAR MARG, LAKADGANJ NAGPUR<br>
      NAGPUR MAHARASHTRA 440008<br><br>
      <strong>TOTAL NUMBER OF PACKAGES: 1</strong>
    </td>
    <td style="width:50%;vertical-align:top">
      <strong>NET WEIGHT:</strong> ${netWt} KGS<br>
      <strong>GROSS WEIGHT:</strong> ${grossWt} KGS<br><br>
      <strong>Consignee:</strong><br>${escapeHtml(consigneeBlock).replace(/\n/g,"<br>")}<br><br>
      <strong>NAME:</strong> KAUSHIK<br>
      <strong>DESIGNATION:</strong> OWNER<br>
      <strong>SIGNATURE &amp; COMPANY STAMP</strong>
    </td>
  </tr>
</table>
</body></html>`;

  // ── Build ZIP ─────────────────────────────────────────────────────────────
  const zip = new JSZip();
  zip.file(`${safeBaseName}-dhl-invoice.html`,         exportsInvoice);
  zip.file(`${safeBaseName}-dhl-packing-list.html`,    packingList);
  zip.file(`${safeBaseName}-dhl-adc-sheet.html`,       adcSheet);
  zip.file(`${safeBaseName}-dhl-shippers-letter.html`, shipperLetter);
  zip.file(`${safeBaseName}-dhl-export-declaration.html`, exportDeclaration);
  zip.file(`${safeBaseName}-dhl-custom-declaration.html`, customDeclaration);
  zip.file(`${safeBaseName}-dhl-authorization.html`,   authorizationLetter);
  zip.file(`${safeBaseName}-dhl-non-dgr-cert.html`,    nonDgrCert);

  if (order.prescriptionStoredName) {
    try {
      const buf = await readFile(getPrescriptionAbsolutePath(order.prescriptionStoredName));
      const name = order.prescriptionOriginalName
        ? sanitizeDownloadName(order.prescriptionOriginalName)
        : `prescription${path.extname(order.prescriptionStoredName)}`;
      zip.file(`${safeBaseName}-${name}`, buf);
    } catch {
      zip.file(`${safeBaseName}-prescription-missing.txt`,
        "A prescription was attached to this order, but the file could not be found on disk.");
    }
  }

  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  return { buffer, fileName: `${safeBaseName}-dhl-documents.zip` };
}
