// src/app/api/dashboard/expiry/route.ts
import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { getSession } from "../../../../lib/auth";

export const runtime = "nodejs";

const MONTHS: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

/** Parse "Jun-27" or "Jun-2027" → last day of that month */
function parseExpDate(s: string): Date | null {
  const parts = s.trim().split("-");
  if (parts.length !== 2) return null;
  const [mon, yr] = parts;
  const m = MONTHS[mon];
  if (m === undefined) return null;
  const y = parseInt(yr);
  if (isNaN(y)) return null;
  const year = y < 100 ? 2000 + y : y;
  return new Date(year, m + 1, 0, 23, 59, 59); // last day of the month
}

type ProductRow = {
  id: string;
  name: string;
  pack: string | null;
  batchNo: string | null;
  expDate: string;
  manufacturer: string | null;
  qty: number | null;
};

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const products = await prisma.product.findMany({
    where: { isActive: true, expDate: { not: null } },
    select: {
      id: true,
      name: true,
      pack: true,
      batchNo: true,
      expDate: true,
      manufacturer: true,
      qty: true,
    },
    orderBy: { name: "asc" },
  });

  const now = new Date();
  const mo = (n: number) => new Date(now.getFullYear(), now.getMonth() + n, now.getDate(), 23, 59, 59);
  const cutoff2 = mo(2);
  const cutoff5 = mo(5);
  const cutoff7 = mo(7);

  const expired: ProductRow[] = [];
  const within2: ProductRow[] = [];
  const within5: ProductRow[] = [];
  const within7: ProductRow[] = [];

  for (const p of products) {
    if (!p.expDate) continue;
    const exp = parseExpDate(p.expDate);
    if (!exp) continue;

    const row: ProductRow = {
      id: p.id,
      name: p.name,
      pack: p.pack,
      batchNo: p.batchNo,
      expDate: p.expDate,
      manufacturer: p.manufacturer,
      qty: p.qty,
    };

    if (exp < now) expired.push(row);
    else if (exp <= cutoff2) within2.push(row);
    else if (exp <= cutoff5) within5.push(row);
    else if (exp <= cutoff7) within7.push(row);
  }

  // Sort each bucket by expDate ascending (soonest first)
  const sortByExp = (a: ProductRow, b: ProductRow) => {
    const da = parseExpDate(a.expDate)?.getTime() ?? 0;
    const db = parseExpDate(b.expDate)?.getTime() ?? 0;
    return da - db;
  };
  expired.sort(sortByExp);
  within2.sort(sortByExp);
  within5.sort(sortByExp);
  within7.sort(sortByExp);

  return NextResponse.json({ expired, within2, within5, within7 });
}
