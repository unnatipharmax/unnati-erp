// src/app/dashboard/product-master/page.tsx
import { prisma } from "../../../lib/prisma";
import ProductMasterClient from "./ProductMasterClient";

export default async function ProductMasterPage() {
  const products = await prisma.product.findMany({
    where:   { isActive: true },
    orderBy: { createdAt: "desc" },
    select: {
      id:           true,
      name:         true,
      manufacturer: true,
      hsn:          true,
      pack:         true,
      mrp:          true,
      gstPercent:   true,
      createdAt:    true,
    },
  });

  const serialized = products.map(p => ({
    ...p,
    mrp:        p.mrp        ? Number(p.mrp)        : null,
    gstPercent: p.gstPercent ? Number(p.gstPercent) : null,
    createdAt:  p.createdAt.toISOString(),
  }));

  return (
    <div style={{ padding: "2rem" }}>
      <div style={{ marginBottom: "1.5rem" }}>
        <h1>Product Master</h1>
        <p>All products in the system — add new or manage existing ones.</p>
      </div>
      <ProductMasterClient initialProducts={serialized} />
    </div>
  );
}