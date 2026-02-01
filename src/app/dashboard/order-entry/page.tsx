import Link from "next/link";
import { prisma } from "../../../lib/prisma";

export default async function OrderEntryHomePage() {
  // show most recent initiated/sales_updated orders
  const orders = await prisma.orderInitiation.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      status: true,
      createdAt: true,
      orderEntry: { select: { id: true } },
    },
  });

  return (
    <div className="p-6">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-slate-100">Order Entry</h1>
        <p className="text-slate-400 mt-1">
          Select an order and add Sales Entry (items + shipping).
        </p>
      </div>

      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 max-w-4xl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* simple “dropdown” via datalist (no client JS needed) */}
          <form action="/dashboard/order-entry/go" className="md:col-span-3">
            <label className="block text-xs text-slate-400">Order</label>
            <input
              name="orderId"
              list="orders"
              placeholder="Paste/Select Order ID"
              className="w-full mt-1 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-slate-100 placeholder:text-slate-600 outline-none focus:ring-2 focus:ring-blue-600"
              required
            />
            <datalist id="orders">
              {orders.map((o) => (
                <option
                  key={o.id}
                  value={o.id}
                  label={`${o.fullName} • ${o.status}${o.orderEntry ? " • (Entry exists)" : ""}`}
                />
              ))}
            </datalist>

            <div className="mt-3 flex gap-3">
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 font-semibold text-white"
              >
                Add / Edit Entry
              </button>

              <Link
                href="/dashboard"
                className="px-5 py-2.5 rounded-xl border border-slate-800 bg-slate-950/40 hover:bg-slate-950/70 font-semibold text-slate-100"
              >
                Back
              </Link>
            </div>

            <p className="text-xs text-slate-500 mt-2">
              Tip: You can paste the Order ID that you got after client form submit.
            </p>
          </form>
        </div>

        <div className="mt-6 border-t border-slate-800 pt-4">
          <h2 className="text-sm font-semibold text-slate-200 mb-3">Recent Orders</h2>
          <div className="space-y-2">
            {orders.slice(0, 12).map((o) => (
              <div
                key={o.id}
                className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 rounded-xl border border-slate-800 bg-slate-950/40 p-3"
              >
                <div>
                  <div className="text-slate-100 font-semibold">
                    {o.fullName} <span className="text-slate-500 font-normal">({o.status})</span>
                  </div>
                  <div className="text-xs text-slate-400">
                    {o.email} • {o.phone}
                  </div>
                  <div className="text-xs text-slate-600">{o.id}</div>
                </div>

                <Link
                  href={`/dashboard/order-entry/${o.id}`}
                  className="self-start md:self-auto px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 font-semibold text-white"
                >
                  {o.orderEntry ? "Edit Entry" : "Add Entry"}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
