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
    "drugLicenseNumber": "the SELLER's drug license number (D.L. No. / DL No / Drug Lic). An Indian drug licence number almost ALWAYS starts with 20, 20B, 21, or 21B (20B = wholesale, 21B = retail) followed by state/area codes and digits, e.g. '20B-MH-NAG-474163' or '20B/21B'. Wholesale and retail licences are often printed together as a PAIR (e.g. '20B-MH-NAG-474163, 21B-MH-NAG-474164') — capture BOTH, joined with a comma. Look for it near the seller's name/GSTIN at the top even if the 'D.L. No.' label is faint, rotated, or missing: any code that begins with 20/20B/21/21B in the seller block IS the drug licence. Return the full number(s) exactly. null only if no such code appears anywhere in the seller block.",
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
      "manufacturer": "manufacturer name from the MFR / MFG / COMPANY column ONLY — usually a short alphabetic code like 'WINLI', 'HEALI', 'LUPIN', 'INT'. It is ALPHABETIC, not a batch/lot code with slashes or digits. Do NOT put a batch number (e.g. 'ST-5113', '3/28', '2504') here — that belongs in batchNo. If the MFR cell for this row is blank, return null.",
      "hsn": "HSN / HSN CODE / HSN-SAC number for this line — usually a 4 to 8 digit number (pharma is commonly 3003, 3004, or 30049099). Look in a column headed HSN / HSN CODE / HSN-SAC / TARIFF, or printed next to the product name. Read the digits exactly. null only if truly not on the bill.",
      "pack": "pack size e.g. 10TAB, 1VIAL, 30ML",
      "batchNo": "batch/lot number from the BATCH / LOT / B.NO column. This is a code like '092', '2504', 'DH250092B' — NOT the manufacturer and NOT the expiry. Read exactly.",
      "mfgDate": "manufacturing date as Mon-YY e.g. Jan-25, ONLY if the bill has a distinct MFG/MFG DATE/M.DATE column with a value. Most pharma purchase bills print ONLY an expiry and NO manufacturing date — then return null. NEVER invent, guess, or derive a mfg date from the expiry. If unsure, return null.",
      "expDate": "expiry as Mon-YY e.g. Feb-29, from the EXP / EXPIRY column. Bills usually print expiry as MM/YY or MM-YY (e.g. '2/29' means Feb-2029, '11/27' means Nov-2027, '3/28' means Mar-2028). Convert the printed value EXACTLY — do NOT shift the month or year. 2/29 -> Feb-29, 11/27 -> Nov-27, 3/28 -> Mar-28, 04-28 -> Apr-28. Read the digits carefully from THIS row's EXP cell.",
      "mrp": "numeric MRP (Maximum Retail Price) per unit from the MRP column, or null. The MRP column is usually the FIRST numeric column on the left (e.g. 522.00, 332.00, 464.00). Do NOT confuse it with RATE (the purchase price, far right). Read this row's MRP value.",
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
- COLUMN ALIGNMENT IS CRITICAL. The product table has fixed columns (typically: MRP, HSN, DESCRIPTION, PACK, MFR, BATCH, EXP, QTY, RATE, AMOUNT). First identify each column heading, then for EACH product row read straight ACROSS, taking each value from directly under its own heading. Do NOT shift a value into the wrong field. Common mistakes to avoid: putting the BATCH code into manufacturer; putting RATE into mrp; reading the EXP of a different row. If the bill photo is rotated/skewed, mentally straighten it and keep each row's cells aligned to their headings.
- Every product row must have its OWN batch, expiry, mrp, rate — do not copy one row's value to another. Re-read each row independently.
- DATE PARSING: bills print month/year as MM/YY or MM-YY. Month is FIRST, year SECOND. Convert to Mon-YY without changing the numbers: 1->Jan 2->Feb 3->Mar 4->Apr 5->May 6->Jun 7->Jul 8->Aug 9->Sep 10->Oct 11->Nov 12->Dec. E.g. 2/29->Feb-29, 11/27->Nov-27, 3/28->Mar-28. Never round or shift the month/year.
- CRITICAL — SELLER vs BUYER: "party" is ALWAYS the SELLER/SUPPLIER who issued and signed the bill (billed FROM / "For <seller>"), never the buyer/consignee (billed TO). A purchase bill has TWO businesses: the seller (top, with its GSTIN and bank details, and a "For <name>" signature at the bottom-right) and the buyer/recipient (labelled "To", "Consignee", "Bill To", "M/s", "Buyer", or "Ship To"). Extract ONLY the seller. If two GSTINs appear, the party.gstNumber is the seller's (top), NOT the buyer's. Ignore the buyer entirely.
- DRUG LICENCE: the seller's drug licence (starts with 20/20B/21/21B, often a wholesale+retail pair) is in the SELLER block at the top-left, near the seller name/GSTIN. Capture it even if the label is unclear. Do NOT take the buyer/consignee's drug licence (in the "To"/buyer block) — only the seller's. If both wholesale (20B...) and retail (21B...) are printed for the seller, return both joined by a comma.
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
      // Ask Gemini to process the image at high resolution so small, densely
      // packed table text (batch/expiry/MRP columns) is read accurately.
      mediaResolution: "MEDIA_RESOLUTION_HIGH",
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