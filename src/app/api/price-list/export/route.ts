// GET /api/price-list/export?group=<name|ALL>&q=<search>
// Returns the price list as an .xlsx with composition / group / manufacturer
// in separate columns. Company-scoped, mirrors the price-list price logic.
import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { getSession } from "../../../../lib/auth";
import { getActiveCompanyId } from "../../../../lib/company";
import ExcelJS from "exceljs";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const companyId = await getActiveCompanyId();

  const url = new URL(req.url);
  const groupFilter = (url.searchParams.get("group") || "ALL").trim();
  const q = (url.searchParams.get("q") || "").toLowerCase().trim();

  const products = await prisma.product.findMany({
    where: { isActive: true, companyId },
    orderBy: { name: "asc" },
    select: {
      id: true, name: true, composition: true, manufacturer: true,
      pack: true, hsn: true, mrp: true, minMargin: true, maxMargin: true,
      group: { select: { id: true, name: true } },
    },
  });

  const grpRows = await prisma.$queryRawUnsafe<{ id: string; dmin: number | null; dmax: number | null }[]>(
    `SELECT id, "defaultMinMargin" AS dmin, "defaultMaxMargin" AS dmax FROM "ProductGroup"`
  );
  const grpDefaults = new Map(grpRows.map((g) => [g.id, { dmin: g.dmin, dmax: g.dmax }]));

  const rows = products
    .map((p) => {
      const mrp = p.mrp ?? null;
      const gd  = p.group ? grpDefaults.get(p.group.id) : undefined;
      const effMin = p.minMargin ?? gd?.dmin ?? null;
      const effMax = p.maxMargin ?? gd?.dmax ?? null;
      const minPrice =
        mrp != null && effMin != null ? parseFloat((mrp * (1 + effMin / 100)).toFixed(2))
        : mrp != null ? mrp : null;
      const maxPrice =
        mrp != null && effMax != null ? parseFloat((mrp * (1 + effMax / 100)).toFixed(2))
        : mrp != null ? mrp : null;
      return {
        name: p.name,
        composition: p.composition ?? "",
        group: p.group?.name ?? "",
        manufacturer: p.manufacturer ?? "",
        pack: p.pack ?? "",
        hsn: p.hsn ?? "",
        minPrice, maxPrice,
      };
    })
    // Apply the same filter the user has on screen so the export matches the view
    .filter((r) => {
      if (groupFilter !== "ALL" && r.group !== groupFilter) return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        r.composition.toLowerCase().includes(q) ||
        r.manufacturer.toLowerCase().includes(q) ||
        r.pack.toLowerCase().includes(q)
      );
    });

  const wb = new ExcelJS.Workbook();
  wb.creator = "Unnati Pharmax ERP";
  wb.created = new Date();
  const ws = wb.addWorksheet("Price List");

  const HEADERS = ["#", "Product", "Composition", "Group", "Manufacturer", "Pack", "HSN", "Min Price (₹)", "Max Price (₹)"];
  const headerRow = ws.getRow(1);
  HEADERS.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5981A" } };
    cell.alignment = { vertical: "middle" };
  });
  headerRow.height = 20;

  const widths = [5, 32, 30, 20, 22, 12, 14, 14, 14];
  widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

  rows.forEach((r, idx) => {
    const row = ws.getRow(idx + 2);
    row.getCell(1).value = idx + 1;
    row.getCell(2).value = r.name;
    row.getCell(3).value = r.composition;
    row.getCell(4).value = r.group;
    row.getCell(5).value = r.manufacturer;
    row.getCell(6).value = r.pack;
    row.getCell(7).value = r.hsn;
    row.getCell(8).value = r.minPrice ?? "";
    row.getCell(9).value = r.maxPrice ?? "";
    row.getCell(8).numFmt = "#,##0.00";
    row.getCell(9).numFmt = "#,##0.00";
  });

  ws.views = [{ state: "frozen", ySplit: 1 }];

  const buf = await wb.xlsx.writeBuffer();
  const stamp = new Date().toISOString().slice(0, 10);
  const suffix = groupFilter !== "ALL" ? ` - ${groupFilter}` : "";
  const fname = `Price List${suffix} ${stamp}.xlsx`;
  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fname}"`,
    },
  });
}
