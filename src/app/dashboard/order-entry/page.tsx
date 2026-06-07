import Link from "next/link";
import { prisma } from "../../../lib/prisma";

const PAGE_SIZE = 9;

export default async function OrderEntryHomePage({
  searchParams,
}: {
  searchParams?: Promise<{ page?: string; error?: string; q?: string }>;
}) {
  const params = await searchParams;
  const page       = Math.max(1, parseInt(params?.page || "1", 10));
  const notFound   = params?.error === "not-found";
  const searchedQ  = params?.q ?? "";

  // Left panel: only INITIATED orders, desc
  const initiatedOrders = await prisma.orderInitiation.findMany({
    where: { status: "INITIATED" },
    orderBy: { createdAt: "desc" },
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

  // Right panel: all orders paginated
  const [allOrders, totalCount] = await Promise.all([
    prisma.orderInitiation.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        status: true,
        createdAt: true,
        orderEntry: { select: { id: true } },
      },
    }),
    prisma.orderInitiation.count(),
  ]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  // All orders for datalist
  const allOrdersForDatalist = await prisma.orderInitiation.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { id: true, fullName: true, status: true, orderEntry: { select: { id: true } } },
  });

  const statusColor: Record<string, string> = {
    INITIATED:        "text-amber-600",
    SALES_UPDATED:    "text-sky-600",
    PACKING:          "text-orange-600",
    PAYMENT_VERIFIED: "text-teal-600",
    COMPLETED:        "text-slate-500",
  };

  const cardCls    = "bg-white border border-slate-200 rounded-2xl p-5 shadow-sm";
  const itemCls    = "flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 hover:bg-slate-100 transition-colors";
  const primaryBtn = "flex-shrink-0 px-3 py-1.5 rounded-xl bg-[#e5981a] hover:bg-[#cf870f] font-semibold text-[#1c1503] text-sm transition-colors";
  const pageBtn    = "px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-sm text-slate-700 transition-colors";

  return (
    <div className="p-6">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-slate-900">Order Entry</h1>
        <p className="text-slate-500 mt-1">
          Select an order and add Sales Entry (items + shipping).
        </p>
      </div>

      <div className="flex flex-col xl:flex-row gap-6">
        {/* ── Left panel ── */}
        <div className="flex-shrink-0 w-full xl:w-[480px] space-y-5">
          {/* Search / navigate */}
          <div className={cardCls}>
            <form action="/dashboard/order-entry/go">
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide">Search Order</label>
              <input
                name="orderId"
                list="orders-datalist"
                defaultValue={notFound ? searchedQ : ""}
                placeholder="Order ID, name, email or phone…"
                className={`w-full mt-1.5 rounded-xl border bg-white px-3 py-2.5 text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 ${notFound ? "border-red-400" : "border-slate-300"}`}
                required
                autoComplete="off"
              />
              <datalist id="orders-datalist">
                {allOrdersForDatalist.map((o) => (
                  <option
                    key={o.id}
                    value={o.id}
                    label={`${o.fullName} • ${o.status}${o.orderEntry ? " • (Entry exists)" : ""}`}
                  />
                ))}
              </datalist>

              {notFound && (
                <p className="text-xs text-red-600 mt-1.5">
                  No order found for <span className="font-semibold">&quot;{searchedQ}&quot;</span>. Try the full Order ID, name, email or phone.
                </p>
              )}

              <div className="mt-3 flex gap-3">
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#e5981a] hover:bg-[#cf870f] font-semibold text-[#1c1503] transition-colors"
                >
                  Add / Edit Entry
                </button>
                <Link
                  href="/dashboard"
                  className="px-5 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 font-semibold text-slate-700 transition-colors"
                >
                  Back
                </Link>
              </div>

              <p className="text-xs text-slate-400 mt-2">
                Tip: Search by Order ID, customer name, email or phone number.
              </p>
            </form>
          </div>

          {/* Initiated orders */}
          <div className={cardCls}>
            <h2 className="text-sm font-semibold text-slate-700 mb-3">
              Pending Orders{" "}
              <span className="text-amber-600">({initiatedOrders.length})</span>
            </h2>
            {initiatedOrders.length === 0 ? (
              <p className="text-xs text-slate-400">No pending initiated orders.</p>
            ) : (
              <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                {initiatedOrders.map((o) => (
                  <div key={o.id} className={itemCls}>
                    <div className="min-w-0">
                      <div className="text-slate-900 font-semibold truncate">
                        {o.fullName}{" "}
                        <span className={`font-normal text-sm ${statusColor[o.status] ?? "text-slate-500"}`}>
                          ({o.status})
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 truncate">
                        {o.email} • {o.phone}
                      </div>
                      <div className="text-xs text-slate-400 truncate">{o.id}</div>
                    </div>
                    <Link href={`/dashboard/order-entry/${o.id}`} className={primaryBtn}>
                      Add Entry
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Right panel: all orders with pagination ── */}
        <div className={`flex-1 ${cardCls}`}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-700">
              All Orders{" "}
              <span className="text-slate-400 font-normal">({totalCount})</span>
            </h2>
            <span className="text-xs text-slate-400">
              Page {page} of {totalPages}
            </span>
          </div>

          <div className="space-y-2">
            {allOrders.map((o) => (
              <div key={o.id} className={itemCls}>
                <div className="min-w-0">
                  <div className="text-slate-900 font-semibold truncate">
                    {o.fullName}{" "}
                    <span className={`font-normal text-sm ${statusColor[o.status] ?? "text-slate-500"}`}>
                      ({o.status})
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 truncate">
                    {o.email} • {o.phone}
                  </div>
                  <div className="text-xs text-slate-400 truncate">{o.id}</div>
                </div>
                <Link href={`/dashboard/order-entry/${o.id}`} className={primaryBtn}>
                  {o.orderEntry ? "Edit Entry" : "Add Entry"}
                </Link>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center gap-2 justify-center flex-wrap">
              {page > 1 && (
                <Link href={`?page=${page - 1}`} className={pageBtn}>← Prev</Link>
              )}

              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                .reduce<(number | "...")[]>((acc, p, idx, arr) => {
                  if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("...");
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, i) =>
                  p === "..." ? (
                    <span key={`ellipsis-${i}`} className="text-slate-400 text-sm px-1">…</span>
                  ) : (
                    <Link
                      key={p}
                      href={`?page=${p}`}
                      className={`px-3 py-1.5 rounded-xl text-sm font-semibold transition-colors ${
                        p === page
                          ? "bg-[#e5981a] text-[#1c1503]"
                          : "border border-slate-300 bg-white hover:bg-slate-100 text-slate-700"
                      }`}
                    >
                      {p}
                    </Link>
                  )
                )}

              {page < totalPages && (
                <Link href={`?page=${page + 1}`} className={pageBtn}>Next →</Link>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
