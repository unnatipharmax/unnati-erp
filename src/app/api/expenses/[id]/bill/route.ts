// GET /api/expenses/[id]/bill — serve the attached bill image (audit proof)
import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { prisma } from "../../../../../lib/prisma";
import { getSession } from "../../../../../lib/auth";
import { getExpenseBillAbsolutePath } from "../../../../../lib/expenseBills";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || !["ADMIN", "MANAGER", "ACCOUNTS"].includes(session.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const rows = await prisma.$queryRawUnsafe<{
    billStoredName: string | null; billMimeType: string | null; billOriginalName: string | null;
  }[]>(
    `SELECT "billStoredName","billMimeType","billOriginalName" FROM "Expense" WHERE id = $1`, id
  );
  const rec = rows[0];
  if (!rec?.billStoredName)
    return NextResponse.json({ error: "No bill attached" }, { status: 404 });

  try {
    const buf = await readFile(getExpenseBillAbsolutePath(rec.billStoredName));
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": rec.billMimeType || "application/octet-stream",
        "Content-Disposition": `inline; filename="${rec.billOriginalName || "bill"}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Bill file not found on disk" }, { status: 404 });
  }
}
