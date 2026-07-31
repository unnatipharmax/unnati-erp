// src/app/api/purchase/scan/route.ts
// POST — accepts base64 image, sends to Gemini, returns structured bill data
import { NextResponse } from "next/server";
import { getSession } from "../../../../lib/auth";

export const runtime = "nodejs";

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

const SYSTEM_PROMPT = `You are a pharmaceutical purchase bill OCR system.
Extract ALL data from the purchase bill image and return ONLY a valid JSON object.
No explanation, no markdown, no code blocks — raw JSON only.

Return exactly this structure:
{
  "party": {
    "name": "the SELLER / SUPPLIER who ISSUED this bill — the business at the TOP of the invoice that the goods are billed FROM, NOT the buyer/consignee the goods are billed TO. On a purchase bill the seller's name is usually the largest heading at the very top-left. Return the registered trade/company NAME ONLY — do NOT include shop number, room number, floor, street, area, city, or any location words (e.g. 'KT AGENCIES' not 'KT AGENCIES SHOP NO 412 4TH FLOOR'). If a city/location is appended with a dash or comma, strip it.",
    "address": "the SELLER's full address including shop/room/building/street/area/city/state/pincode",
    "gstNumber": "the SELLER's GST number (the one next to the seller's name/address at the top, NOT the buyer's)",
    "drugLicenseNumber": "the SELLER's drug license number if visible",
    "phone": "the SELLER's phone number if visible",
    "email": "the SELLER's email if visible"
  },
  "bill": {
    "invoiceNo": "invoice/bill number",
    "invoiceDate": "date in YYYY-MM-DD format",
    "totalAmount": numeric total amount or null
  },
  "products": [
    {
      "name": "the FULL product/brand name for this line, read left-to-right in the PRODUCT column exactly as printed — include EVERY word of the name, not just part of it (e.g. 'MORR F 5% SOLUTION', not 'F 5% SOLUTION'). Do not drop the first word or any leading brand word. Include strength/percentage if it is part of the printed name. Do NOT include composition/salt details.",
      "manufacturer": "manufacturing company / MFR name (often a short code in a column headed MFR / MFG / COMPANY, e.g. 'INT', 'LUPIN'). Read it exactly.",
      "hsn": "HSN / HSN CODE / HSN-SAC number for this line — usually a 4 to 8 digit number (pharma is commonly 3003, 3004, or 30049099). Look in a column headed HSN / HSN CODE / HSN-SAC / TARIFF, or printed next to the product name. Read the digits exactly. null only if truly not on the bill.",
      "pack": "pack size e.g. 10TAB, 1VIAL, 30ML",
      "batchNo": "batch number",
      "mfgDate": "manufacturing date as Mon-YY e.g. Jan-25, ONLY if the bill has a distinct MFG/MFG DATE/M.DATE column or value. Most pharma purchase bills print ONLY an expiry (EXP) and NO manufacturing date — in that case return null. NEVER invent, guess, or derive a mfg date from the expiry. If unsure, return null.",
      "expDate": "expiry date as Mon-YY e.g. Dec-27, from the EXP / EXPIRY column. This is the ONLY date column on most bills.",
      "mrp": numeric MRP per unit or null,
      "gstPercent": numeric total GST percentage or null (e.g. 5 or 18),
      "cgstPercent": numeric CGST percentage or null (e.g. 2.5 or 9),
      "sgstPercent": numeric SGST percentage or null (e.g. 2.5 or 9),
      "igstPercent": numeric IGST percentage or null (for interstate bills),
      "taxableAmount": numeric taxable amount before GST for this line or null,
      "cgstAmount": numeric CGST rupee amount for this line or null,
      "sgstAmount": numeric SGST rupee amount for this line or null,
      "igstAmount": numeric IGST rupee amount for this line or null,
      "quantity": numeric quantity ordered,
      "rate": numeric purchase rate per unit (excluding GST),
      "discount": "numeric discount PERCENTAGE for this line or null. Look in a column headed DISC / DISC% / DISCOUNT / SCHEME / DIS. IMPORTANT: if the bill shows the discount as a RUPEE AMOUNT (not a %), convert it to a percentage: discount% = round(discountAmount / grossLineAmount * 100, 2). If the discount is a bill-level total (in the summary/footer, e.g. a DISC total next to GROSS), and there is only one product line, apply that same discount to that line. Return the numeric percentage only, e.g. 4 or 10. null only if there is genuinely no discount anywhere on the bill.",
      "discountAmount": "numeric discount RUPEE amount for this line if the bill prints one, else null"
    }
  ]
}

Rules:
- If a field is not visible, use null
- CRITICAL — SELLER vs BUYER: "party" is ALWAYS the SELLER/SUPPLIER who issued and signed the bill (billed FROM / "For <seller>"), never the buyer/consignee (billed TO). A purchase bill has TWO businesses: the seller (top, with its GSTIN and bank details, and a "For <name>" signature at the bottom-right) and the buyer/recipient (labelled "To", "Consignee", "Bill To", "M/s", "Buyer", or "Ship To"). Extract ONLY the seller. If two GSTINs appear, the party.gstNumber is the seller's (top), NOT the buyer's. Ignore the buyer entirely.
- party.name: ONLY the registered company/business name. Never include shop numbers, room numbers, building names, street names, area, city, state or pincode in the name. Those belong in party.address. If you see "ABC MEDICALS - NAGPUR" use "ABC MEDICALS". If you see "XYZ PHARMA SHOP NO 5 MAIN ROAD" use "XYZ PHARMA".
- product name should be the brand/trade name only
- do NOT extract composition — leave it out entirely
- rate is the purchase price per unit (excluding GST, used for INR unit calculation)
- dates must be Mon-YY format (e.g. "Jul-25", "Jun-27")
- invoiceDate must be YYYY-MM-DD
- Extract every product line on the bill, even if partial info
- For GST: if bill shows CGST 2.5% + SGST 2.5%, set gstPercent=5, cgstPercent=2.5, sgstPercent=2.5
- If bill shows IGST 5%, set gstPercent=5, igstPercent=5, cgstPercent=null, sgstPercent=null
- Always extract the actual GST rupee amounts (cgstAmount, sgstAmount, igstAmount) from the bill
- taxableAmount is the line amount before any GST is added
- DISCOUNT: never leave discount null when the bill shows any DISC/DISCOUNT value. If it is a rupee amount, convert to a percentage of the gross line amount. A discount printed only in the summary/footer still applies — if there is a single product line, use it for that line.
- Fill every field you can actually READ on the bill. Read carefully before giving up on a field.
- NEVER INVENT DATA. If a value is not printed on the bill, return null — do NOT guess, estimate, or derive it from another field. This is critical for mfgDate: most bills have only an expiry date, so mfgDate must be null unless a real MFG date is printed.
- PRODUCT NAME: capture the WHOLE name in the product column including the first/leading word (e.g. "MORR F 5% SOLUTION", never just "F 5% SOLUTION"). Do not truncate.`;

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || !["ADMIN", "MANAGER", "ACCOUNTS", "PACKAGING"].includes(session.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey)
    return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });

  const { imageBase64, mimeType } = await req.json();
  if (!imageBase64)
    return NextResponse.json({ error: "imageBase64 required" }, { status: 400 });

  const body = {
    contents: [{
      parts: [
        { text: SYSTEM_PROMPT },
        {
          inline_data: {
            mime_type: mimeType || "image/jpeg",
            data: imageBase64,
          },
        },
      ],
    }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 4096,
    },
  };

  try {
    const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: `Gemini error: ${err}` }, { status: 500 });
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    // Strip any accidental markdown fences
    const clean = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    let parsed: any;
    try {
      parsed = JSON.parse(clean);
    } catch {
      return NextResponse.json(
        { error: "Gemini returned invalid JSON", raw: text },
        { status: 422 }
      );
    }

    return NextResponse.json({ data: parsed });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Scan failed" }, { status: 500 });
  }
}