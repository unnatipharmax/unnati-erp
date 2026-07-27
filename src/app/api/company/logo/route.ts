// GET /api/company/logo — serve the active company's logo image.
// Falls back to the static /logo.png when the company has no custom logo.
import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { prisma } from "../../../../lib/prisma";
import { getActiveCompanyId } from "../../../../lib/company";

export const runtime = "nodejs";

export async function GET() {
  let logoB64 = "";
  try {
    const id = await getActiveCompanyId();
    const co = await prisma.companySetting.findUnique({ where: { id }, select: { logoB64: true } });
    logoB64 = co?.logoB64 ?? "";
  } catch { /* fall through to static */ }

  // Custom logo stored as a data URL (data:image/...;base64,...)
  if (logoB64 && logoB64.startsWith("data:")) {
    const m = logoB64.match(/^data:([^;]+);base64,(.*)$/);
    if (m) {
      const buf = Buffer.from(m[2], "base64");
      return new NextResponse(new Uint8Array(buf), {
        status: 200,
        headers: { "Content-Type": m[1], "Cache-Control": "no-store" },
      });
    }
  }

  // Fallback: static public/logo.png
  try {
    const buf = await readFile(path.join(process.cwd(), "public", "logo.png"));
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: { "Content-Type": "image/png", "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ error: "No logo" }, { status: 404 });
  }
}
