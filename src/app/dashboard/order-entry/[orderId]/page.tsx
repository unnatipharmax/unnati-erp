import { prisma } from "../../../../lib/prisma";
import OrderEntryForm from "./OrderEntryForm";

export default async function OrderEntryPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;

  const [order, products] = await Promise.all([
    prisma.orderInitiation.findUnique({
      where: { id: orderId },
      include: {
        orderEntry: {
          include: {
            items: {
              include: {
                product: { select: { id: true, name: true } }, // ✅ get product name
              },
            },
          },
        },
      },
    }),
    prisma.product.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  // Build last-used selling price map for this client (by email)
  // Find previous orders from same client that have order entries, sorted newest first
  const lastPrices: Record<string, string> = {};
  if (order?.email) {
    const prevOrders = await prisma.orderInitiation.findMany({
      where: {
        email: order.email,
        id: { not: orderId },
        orderEntry: { isNot: null },
      },
      orderBy: { createdAt: "desc" },
      select: {
        orderEntry: {
          select: {
            items: {
              select: { productId: true, sellingPrice: true },
            },
          },
        },
      },
    });

    // Iterate newest → oldest; only keep first (most recent) price per product
    for (const prev of prevOrders) {
      for (const item of prev.orderEntry?.items ?? []) {
        if (!lastPrices[item.productId]) {
          lastPrices[item.productId] = item.sellingPrice.toString();
        }
      }
    }
  }

  if (!order) {
    return (
      <div className="p-6 text-slate-100">
        Order not found: <span className="text-slate-400">{orderId}</span>
      </div>
    );
  }

  // ✅ Convert Prisma types (Decimal etc.) into UI-friendly strings + include productName
  const existingEntry = order.orderEntry
    ? {
        id: order.orderEntry.id,
        orderId: order.orderEntry.orderId,
        shipmentMode: order.orderEntry.shipmentMode,
        shippingPrice: order.orderEntry.shippingPrice?.toString?.() ?? "0",
        notes: order.orderEntry.notes ?? null,
        items: order.orderEntry.items.map((it) => ({
          id: it.id,
          productId: it.productId,
          productName: it.product?.name ?? "", // ✅ now available
          quantity: it.quantity,
          sellingPrice: it.sellingPrice?.toString?.() ?? "0",
        })),
      }
    : null;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-slate-100">Add Order Entry</h1>
      <p className="text-slate-400 mt-1">
        Order: <span className="text-slate-300 font-semibold">{order.fullName}</span> •{" "}
        {order.id}
      </p>

      <div className="mt-6">
        <OrderEntryForm
          orderId={order.id}
          products={products}
          existingEntry={existingEntry}
          lastPrices={lastPrices}
          initialDosage={{
            dosagePerDay: order.dosagePerDay ?? null,
            totalDosages: order.totalDosages ?? null,
            dosageStartDate: order.dosageStartDate?.toISOString().split("T")[0] ?? null,
            dosageReminderDate: order.dosageReminderDate?.toISOString().split("T")[0] ?? null,
          }}
        />
      </div>
    </div>
  );
}
