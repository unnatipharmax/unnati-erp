// POST /api/packaging/extract-weight
// Accepts a base64 image of a parcel on a weighing scale.
// Uses Gemini Vision to read the weight display and return the value in kg.
import { NextResponse } from "next/server";
import { getSession } from "../../../../lib/auth";

export const runtime = "nodejs";

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

const PROMPT = `You are reading a weighing scale image.
Your only job is to read the weight value shown on the scale display.

Rules:
- If the display shows grams (g), convert to kg (divide by 1000).
- If the display shows kg already, use that value directly.
- Round to 3 decimal places.
- If you cannot read the weight clearly, return null.
- Return ONLY valid JSON. No explanation, no markdown, no code fences.

Return exactly:
{ "netWeight": <number in kg, or null> }`;

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || !["ADMIN", "MANAGER", "PACKAGING"].includes(session.role))
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
    generationConfig: { temperature: 0, maxOutputTokens: 64 },
  };

  const geminiRes = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!geminiRes.ok) {
    const text = await geminiRes.text();
    return NextResponse.json({ error: `Gemini error: ${text.slice(0, 200)}` }, { status: 502 });
  }

  const geminiData = await geminiRes.json();
  const raw = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  try {
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    const netWeight = typeof parsed.netWeight === "number" ? parsed.netWeight : null;
    return NextResponse.json({ netWeight });
  } catch {
    return NextResponse.json({ netWeight: null, raw });
  }
}
