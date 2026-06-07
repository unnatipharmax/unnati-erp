// POST /api/expenses/extract-bill
// Reads a vendor bill / receipt / invoice photo and extracts the fields needed
// for an expense entry (vendor, GSTIN, bill no, date, amount, GST split).
import { NextResponse } from "next/server";
import { getSession } from "../../../../lib/auth";

export const runtime = "nodejs";

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

const PROMPT = `You are reading a photo of a vendor BILL / INVOICE / RECEIPT for an expense (e.g. transport, rent, electricity, stationery, supplies).

Extract these fields:
- "vendorName": the name of the business / supplier / payee that ISSUED the bill (the seller, not the buyer/recipient). e.g. "Anjani Transport Co.".
- "vendorGstin": the supplier's 15-character GSTIN (e.g. "27ABCDE1234F1Z5"). Return the alphanumeric string exactly, uppercased. null if not printed.
- "billNo": the bill / invoice / receipt number printed on the document. null if none.
- "billDate": the bill date in strict YYYY-MM-DD format. null if not readable.
- "amount": the GRAND TOTAL amount payable (the final total including tax), as a number with no currency symbol or commas.
- "gstPercent": the GST rate applied as a number (e.g. 5, 12, 18, 28). If both CGST and SGST are shown, sum them for the total rate. null if no GST is shown.
- "gstAmount": the total GST rupee amount (CGST + SGST + IGST) as a number. null if not shown.
- "category": classify the expense as one of exactly: "PERSONAL", "STATIONARY", "MONTHLY", "YEARLY". Use "MONTHLY" for recurring bills like rent/electricity/transport, "STATIONARY" for office supplies, else "MONTHLY".
- "description": a short (max 6 words) description of what the bill is for.

Make your best reasonable reading. Use null for any field you genuinely cannot read.
Return ONLY valid JSON, no markdown, no code fences:
{ "vendorName": <string|null>, "vendorGstin": <string|null>, "billNo": <string|null>, "billDate": <string|null>, "amount": <number|null>, "gstPercent": <number|null>, "gstAmount": <number|null>, "category": <string|null>, "description": <string|null> }`;

const CATEGORIES = ["PERSONAL", "STATIONARY", "MONTHLY", "YEARLY"];

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || !["ADMIN", "MANAGER", "ACCOUNTS"].includes(session.role))
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
        { text: PROMPT },
        { inline_data: { mime_type: mimeType || "image/jpeg", data: imageBase64 } },
      ],
    }],
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 2048,
      thinkingConfig: { thinkingBudget: 0 },
    },
  };

  try {
    const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: `Gemini error: ${text.slice(0, 200)}` }, { status: 502 });
    }

    const data = await res.json();
    const parts: any[] = data?.candidates?.[0]?.content?.parts ?? [];
    const raw: string = parts.map((p) => p?.text ?? "").join("").trim();

    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
    } catch {
      parsed = {};
    }

    const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
    const numv = (v: unknown) => {
      if (typeof v === "number" && isFinite(v)) return v;
      if (typeof v === "string") { const n = parseFloat(v.replace(/[^0-9.]/g, "")); return isFinite(n) ? n : null; }
      return null;
    };

    const gstin = str(parsed.vendorGstin)?.toUpperCase() ?? null;
    let category = str(parsed.category)?.toUpperCase() ?? null;
    if (category && !CATEGORIES.includes(category)) category = null;

    return NextResponse.json({
      vendorName:  str(parsed.vendorName),
      vendorGstin: gstin,
      billNo:      str(parsed.billNo),
      billDate:    str(parsed.billDate),
      amount:      numv(parsed.amount),
      gstPercent:  numv(parsed.gstPercent),
      gstAmount:   numv(parsed.gstAmount),
      category,
      description: str(parsed.description),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Extraction failed" }, { status: 500 });
  }
}
