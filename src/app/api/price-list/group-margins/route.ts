import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { getSession } from "../../../../lib/auth";

export const runtime = "nodejs";

// Group default margins live on ProductGroup.defaultMinMargin / defaultMaxMargin.
// We read/write them via raw SQL so this works without regenerating the Prisma
// client (the columns were added by migration).

type GroupDefaultRow = { id: string; name: string; defaultMinMargin: number | null; defaultMaxMargin: number | null };

// GET — groups with their default margins + product counts (+ override counts).
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const groups = await prisma.$queryRawUnsafe<GroupDefaultRow[]>(
    `SELECT id, name, "defaultMinMargin", "defaultMaxMargin" FROM "ProductGroup" ORDER BY name ASC`
  );

  const rows = await Promise.all(
    groups.map(async (g) => {
      const total     = await prisma.product.count({ where: { isActive: true, groupId: g.id } });
      const overrides = await prisma.product.count({ where: { isActive: true, groupId: g.id, NOT: { maxMargin: null } } });
      return {
        id: g.id, name: g.name, total, overrides,
        defaultMinMargin: g.defaultMinMargin, defaultMaxMargin: g.defaultMaxMargin,
      };
    })
  );

  const ungTotal = await prisma.product.count({ where: { isActive: true, groupId: null } });

  return NextResponse.json({ groups: rows, ungrouped: { total: ungTotal } });
}

// POST — set a group's DEFAULT margins (inherited by every product in the group
// that has no per-product override). For the "UNGROUPED" bucket there is no group
// entity, so we fill product margins directly (only where currently null).
export async function POST(req: Request) {
  const session = await getSession();
  if (!session || !["ADMIN", "MANAGER"].includes(session.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { groupId } = body as { groupId: string };
  const minMargin = body.minMargin != null && body.minMargin !== "" ? Number(body.minMargin) : null;
  const maxMargin = body.maxMargin != null && body.maxMargin !== "" ? Number(body.maxMargin) : null;

  if (!groupId) return NextResponse.json({ error: "Group required" }, { status: 400 });
  if (minMargin == null && maxMargin == null)
    return NextResponse.json({ error: "Enter a min or max %" }, { status: 400 });
  if ((minMargin != null && isNaN(minMargin)) || (maxMargin != null && isNaN(maxMargin)))
    return NextResponse.json({ error: "Invalid %" }, { status: 400 });

  if (groupId === "UNGROUPED") {
    let count = 0;
    if (minMargin != null) {
      const r = await prisma.product.updateMany({ where: { isActive: true, groupId: null, minMargin: null }, data: { minMargin } });
      count = Math.max(count, r.count);
    }
    if (maxMargin != null) {
      const r = await prisma.product.updateMany({ where: { isActive: true, groupId: null, maxMargin: null }, data: { maxMargin } });
      count = Math.max(count, r.count);
    }
    return NextResponse.json({ ok: true, applied: count });
  }

  // Merge with existing defaults (so a partial update keeps the other value)
  const cur = await prisma.$queryRawUnsafe<{ a: number | null; b: number | null }[]>(
    `SELECT "defaultMinMargin" AS a, "defaultMaxMargin" AS b FROM "ProductGroup" WHERE id = $1`, groupId
  );
  if (!cur.length) return NextResponse.json({ error: "Group not found" }, { status: 404 });

  const newMin = minMargin != null ? minMargin : cur[0].a;
  const newMax = maxMargin != null ? maxMargin : cur[0].b;

  await prisma.$executeRawUnsafe(
    `UPDATE "ProductGroup" SET "defaultMinMargin" = $1, "defaultMaxMargin" = $2 WHERE id = $3`,
    newMin, newMax, groupId
  );

  return NextResponse.json({ ok: true });
}
