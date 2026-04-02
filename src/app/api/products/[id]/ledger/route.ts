import { PurchaseDocumentType } from "@prisma/client";
import { NextResponse } from "next/server";
import { getSession } from "../../../../../lib/auth";
import {
  getCreditNoteLineAmount,
  roundMoney,
} from "../../../../../lib/purchaseAccounting";
import { prisma } from "../../../../../lib/prisma";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const url = new URL(req.url);

  const now = new Date();
  const fyStart = now.getMonth() >= 3
    ? new Date(now.getFullYear(), 3, 1)
    : new Date(now.getFullYear() - 1, 3, 1);
  const fyEnd = new Date(fyStart.getFullYear() + 1, 2, 31, 23, 59, 59);

  const fromParam = url.searchParams.get("from");
  const toParam = url.searchParams.get("to");
  const from = fromParam ? new Date(fromParam) : fyStart;
  const to = toParam ? new Date(`${toParam}T23:59:59`) : fyEnd;

  const product = await prisma.product.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      composition: true,
      manufacturer: true,
      pack: true,
      mrp: true,
      hsn: true,
    },
  });

  if (!product) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const allPurchases = await prisma.purchaseItem.findMany({
    where: { productId: id },
    select: {
      id: true,
      quantity: true,
      rate: true,
      taxableAmount: true,
      cgstAmount: true,
      sgstAmount: true,
      igstAmount: true,
      purchase: {
        select: {
          id: true,
          invoiceNo: true,
          invoiceDate: true,
          createdAt: true,
          documentType: true,
          party: { select: { name: true } },
        },
      },
    },
  });

  const allSales = await prisma.orderEntryItem.findMany({
    where: { productId: id },
    select: {
      id: true,
      quantity: true,
      sellingPrice: true,
      orderEntry: {
        select: {
          order: {
            select: {
              id: true,
              invoiceNo: true,
              invoiceGeneratedAt: true,
              createdAt: true,
              fullName: true,
              status: true,
            },
          },
        },
      },
    },
  });

  type Entry = {
    id: string;
    date: Date;
    billNo: string;
    particulars: string;
    type: "purchase" | "purchase_return" | "sale";
    quantity: number;
    rate: number;
    amount: number;
  };

  const allEntries: Entry[] = [
    ...allPurchases.map((purchaseItem) => {
      const type = purchaseItem.purchase.documentType === PurchaseDocumentType.CREDIT_NOTE
        ? "purchase_return" as const
        : "purchase" as const;

      return {
        id: purchaseItem.id,
        date: purchaseItem.purchase.invoiceDate ?? purchaseItem.purchase.createdAt,
        billNo: purchaseItem.purchase.invoiceNo ?? purchaseItem.purchase.id.slice(0, 8).toUpperCase(),
        particulars: purchaseItem.purchase.documentType === PurchaseDocumentType.CREDIT_NOTE
          ? `${purchaseItem.purchase.party.name} (Return)`
          : purchaseItem.purchase.party.name,
        type,
        quantity: purchaseItem.quantity,
        rate: Number(purchaseItem.rate),
        amount: purchaseItem.purchase.documentType === PurchaseDocumentType.CREDIT_NOTE
          ? getCreditNoteLineAmount(purchaseItem)
          : roundMoney(Number(purchaseItem.rate) * purchaseItem.quantity),
      };
    }),
    ...allSales
      .filter((sale) => sale.orderEntry.order.status !== "INITIATED")
      .map((sale) => ({
        id: sale.id,
        date: sale.orderEntry.order.invoiceGeneratedAt ?? sale.orderEntry.order.createdAt,
        billNo: sale.orderEntry.order.invoiceNo ?? sale.orderEntry.order.id.slice(0, 8).toUpperCase(),
        particulars: sale.orderEntry.order.fullName,
        type: "sale" as const,
        quantity: sale.quantity,
        rate: Number(sale.sellingPrice),
        amount: roundMoney(Number(sale.sellingPrice) * sale.quantity),
      })),
  ].sort((left, right) => left.date.getTime() - right.date.getTime());

  const quantityDelta = (entry: Entry) => entry.type === "purchase" ? entry.quantity : -entry.quantity;
  const valueDelta = (entry: Entry) => entry.type === "purchase" ? entry.amount : -entry.amount;

  const beforeFrom = allEntries.filter((entry) => entry.date < from);
  const openingQty = beforeFrom.reduce((sum, entry) => sum + quantityDelta(entry), 0);
  const openingVal = roundMoney(beforeFrom.reduce((sum, entry) => sum + valueDelta(entry), 0));

  const inRange = allEntries.filter((entry) => entry.date >= from && entry.date <= to);

  let balance = openingQty;
  const entries = inRange.map((entry) => {
    balance += quantityDelta(entry);

    return {
      id: entry.id,
      date: entry.date.toISOString().split("T")[0],
      billNo: entry.billNo,
      particulars: entry.particulars,
      type: entry.type,
      receive: entry.type === "purchase" ? entry.quantity : null,
      issue: entry.type !== "purchase" ? entry.quantity : null,
      balance,
      rate: entry.rate,
      amount: entry.amount,
    };
  });

  const purchasesInRange = inRange.filter((entry) => entry.type === "purchase");
  const returnsInRange = inRange.filter((entry) => entry.type === "purchase_return");
  const salesInRange = inRange.filter((entry) => entry.type === "sale");

  const totalReceiveQty = purchasesInRange.reduce((sum, entry) => sum + entry.quantity, 0);
  const totalReceiveVal = roundMoney(purchasesInRange.reduce((sum, entry) => sum + entry.amount, 0));
  const totalReturnQty = returnsInRange.reduce((sum, entry) => sum + entry.quantity, 0);
  const totalReturnVal = roundMoney(returnsInRange.reduce((sum, entry) => sum + entry.amount, 0));
  const totalSaleQty = salesInRange.reduce((sum, entry) => sum + entry.quantity, 0);
  const totalSaleVal = roundMoney(salesInRange.reduce((sum, entry) => sum + entry.amount, 0));
  const totalIssueQty = totalReturnQty + totalSaleQty;
  const totalIssueVal = roundMoney(totalReturnVal + totalSaleVal);
  const closingQty = openingQty + totalReceiveQty - totalIssueQty;
  const closingVal = roundMoney(openingVal + totalReceiveVal - totalIssueVal);

  return NextResponse.json({
    product,
    from: from.toISOString().split("T")[0],
    to: to.toISOString().split("T")[0],
    entries,
    summary: {
      openingQty,
      openingVal,
      totalReceiveQty,
      totalReceiveVal,
      totalReturnQty,
      totalReturnVal,
      totalSaleQty,
      totalSaleVal,
      totalIssueQty,
      totalIssueVal,
      closingQty,
      closingVal,
    },
  });
}
