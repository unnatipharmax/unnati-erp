// POST /api/anjani/extract
// Reads a courier/parcel label photo and extracts party name, tracking no, weight.
import { NextResponse } from "next/server";
import { getSession } from "../../../../lib/auth";

export const runtime = "nodejs";

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

const PROMPT = `You are reading a courier / parcel shipping label photo (e.g. Anjani Courier, EMS Speed Post, India Post). The parcel may also be sitting on a weighing scale.

Extract these fields:
- "partyName": the consignee / addressee name the parcel is sent TO (the "To" / "Name" party). If both a FROM (sender) and TO (consignee) appear, return the TO/consignee name. It may be an agency name like "SUPREME INTERNATIONAL".
- "trackingNo": the tracking / docket / consignment / AWB number, usually printed near a barcode (e.g. "EM870966534IN" or a long numeric docket). Return the alphanumeric string exactly.
- "weight": the parcel weight. If a weighing-scale display shows it, read that. If the label prints a weight, use it. Convert grams to kg (divide by 1000). If shown in kg, use as-is. Round to 3 decimal places. Use null if no weight is visible.

Make your best reasonable reading. Use null for any field you genuinely cannot read.
Return ONLY valid JSON, no markdown, no code fences:
{ "partyName": <string or null>, "trackingNo": <string or null>, "weight": <number in kg or null> }`;

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || !["ADMIN", "MANAGER", "PACKAGING", "ACCOUNTS"].includes(session.role))
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

    let parsed: { partyName?: string | null; trackingNo?: string | null; weight?: number | null } = {};
    try {
      parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
    } catch {
      // best-effort regex fallback
      const w = raw.match(/"?weight"?\s*[:=]\s*(-?\d+(?:\.\d+)?)/i);
      const t = raw.match(/"?trackingNo"?\s*[:=]\s*"([^"]+)"/i);
      const p = raw.match(/"?partyName"?\s*[:=]\s*"([^"]+)"/i);
      parsed = {
        weight: w ? parseFloat(w[1]) : null,
        trackingNo: t ? t[1] : null,
        partyName: p ? p[1] : null,
      };
    }

    return NextResponse.json({
      partyName:  typeof parsed.partyName === "string" ? parsed.partyName : null,
      trackingNo: typeof parsed.trackingNo === "string" ? parsed.trackingNo : null,
      weight:     typeof parsed.weight === "number" ? Math.round(parsed.weight * 1000) / 1000 : null,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Extraction failed" }, { status: 500 });
  }
}
