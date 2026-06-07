import { prisma } from "../../../lib/prisma";
import { getSession } from "../../../lib/auth";
import { redirect } from "next/navigation";
import CourierBillClient from "./CourierBillClient";

export default async function CourierBillPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  // Processed orders = those that have an invoice generated
  const orders = await prisma.orderInitiation.findMany({
    where: { invoiceNo: { not: null } },
    orderBy: [{ invoiceGeneratedAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      fullName: true,
      trackingNo: true,
      invoiceNo: true,
      invoiceGeneratedAt: true,
      createdAt: true,
      city: true,
      country: true,
    },
  });

  // Weights live on OrderInitiation but aren't in the Prisma schema → raw SQL
  const ids = orders.map((o) => o.id);
  const weightMap: Record<string, number | null> = {};
  if (ids.length) {
    const rows = await prisma.$queryRaw<{ id: string; netWeight: number | null; grossWeight: number | null }[]>`
      SELECT id, "netWeight", "grossWeight" FROM "OrderInitiation" WHERE id = ANY(${ids}::text[])
    `;
    for (const r of rows) weightMap[r.id] = r.grossWeight ?? r.netWeight ?? null;
  }

  const data = orders.map((o) => ({
    id: o.id,
    date: (o.invoiceGeneratedAt ?? o.createdAt).toISOString(),
    invoiceNo: o.invoiceNo ?? "",
    trackingNo: o.trackingNo ?? "",
    party: o.fullName,
    center: o.country || o.city || "",
    weight: weightMap[o.id] ?? null,
  }));

  return (
    <div className="p-6">
      <CourierBillClient rows={data} />
    </div>
  );
}
