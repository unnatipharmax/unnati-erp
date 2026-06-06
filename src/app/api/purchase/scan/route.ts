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
    "name": "supplier COMPANY/BUSINESS NAME ONLY — do NOT include shop number, room number, floor, street, area, city, or any location words. Extract only the registered trade/company name e.g. 'SHRIRAM HEALTHCARE' not 'SHRIRAM HEALTHCARE ROOM NO 1 HASHMI T'. If city or location is appended to the name with a dash or comma, strip it.",
    "address": "full address including shop/room/building/street/area/city/state/pincode",
    "gstNumber": "GST number if visible",
    "drugLicenseNumber": "drug license number if visible",
    "phone": "phone number if visible",
    "email": "email if visible"
  },
  "bill": {
    "invoiceNo": "invoice/bill number",
    "invoiceDate": "date in YYYY-MM-DD format",
    "totalAmount": numeric total amount or null
  },
  "products": [
    {
      "name": "product/medicine name (brand name only, no composition here)",
      "manufacturer": "manufacturing company name",
      "hsn": "HSN code if visible",
      "pack": "pack size e.g. 10TAB, 1VIAL, 30ML",
      "batchNo": "batch number",
      "mfgDate": "mfg date as Mon-YY e.g. Jan-25",
      "expDate": "expiry date as Mon-YY e.g. Dec-27",
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
      "discount": numeric discount percentage or null
    }
  ]
}

Rules:
- If a field is not visible, use null
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
- taxableAmount is the line amount before any GST is added`;

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