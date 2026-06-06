// POST /api/packaging/extract-weight
// Accepts a base64 image of a parcel on a weighing scale.
// Uses Gemini Vision to read the weight display and return the value in kg.
import { NextResponse } from "next/server";
import { getSession } from "../../../../lib/auth";

export const runtime = "nodejs";

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

const PROMPT = `You are reading the number shown on a digital weighing scale's display in the photo.

The display is usually a red, green, or white SEVEN-SEGMENT / LED number (e.g. "6.200", "0.559", "1.245"). It may also show a unit label like "kg", "Kg", or "g" near it. Read the main weight number, ignoring the Max/Min/d= specification text printed on the scale body.

Rules:
- Read the digits exactly as shown on the lit display, including the decimal point. e.g. a display reading "6.200" with a "Kg" indicator means 6.2 kg.
- If the unit shown is grams (g), convert to kg by dividing by 1000.
- If the unit shown is kg (or no unit but the value has a decimal like 6.200), treat the number as kilograms.
- Round to 3 decimal places.
- Make your best reasonable reading of the lit digits. Only return null if the display is completely unreadable, blank, or not visible.
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
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 2048,           // room so output isn't truncated
      thinkingConfig: { thinkingBudget: 0 }, // disable 2.5 "thinking" so it answers directly
    },
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
  // Concatenate every text part (thinking-disabled output may still split)
  const parts: any[] = geminiData?.candidates?.[0]?.content?.parts ?? [];
  const raw: string = parts.map((p) => p?.text ?? "").join("").trim();

  // Try strict JSON first
  let netWeight: number | null = null;
  try {
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    if (typeof parsed.netWeight === "number") netWeight = parsed.netWeight;
  } catch { /* fall through to regex */ }

  // Fallback: pull a "netWeight": <num> or the first decimal number out of the text
  if (netWeight == null && raw) {
    const m = raw.match(/"?netWeight"?\s*[:=]\s*(-?\d+(?:\.\d+)?)/i)
           ?? raw.match(/(-?\d+\.\d+)/);
    if (m) {
      const n = parseFloat(m[1]);
      if (!isNaN(n)) netWeight = Math.round(n * 1000) / 1000;
    }
  }

  if (netWeight == null) {
    const finishReason = geminiData?.candidates?.[0]?.finishReason ?? "unknown";
    return NextResponse.json({ netWeight: null, raw, finishReason });
  }
  return NextResponse.json({ netWeight });
}
