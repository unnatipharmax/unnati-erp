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
        <OrderEntryForm orderId={order.id} products={products} existingEntry={existingEntry} />
      </div>
    </div>
  );
}
