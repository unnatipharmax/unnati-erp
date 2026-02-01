import { prisma } from "../../../../lib/prisma";
import OrderEntryForm from "./OrderEntryForm";

export default async function OrderEntryPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  // ✅ Next 16: params is a Promise
  const { orderId } = await params;

  const [order, products] = await Promise.all([
    prisma.orderInitiation.findUnique({
      where: { id: orderId },
      include: {
        orderEntry: {
          include: { items: true },
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

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-slate-100">Add Order Entry</h1>
      <p className="text-slate-400 mt-1">
        Order: <span className="text-slate-300 font-semibold">{order.fullName}</span> • {order.id}
      </p>

      <div className="mt-6">
        <OrderEntryForm
          orderId={order.id}
          products={products}
          existingEntry={order.orderEntry}
        />
      </div>
    </div>
  );
}
