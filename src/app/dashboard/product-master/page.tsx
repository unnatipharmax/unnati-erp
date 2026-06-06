import { getSession } from "../../../lib/auth";
import { redirect } from "next/navigation";
import ProductMasterClient from "./ProductMasterClient";

export default async function ProductMasterPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  // Sales users have no access to the product master — they use the Price List instead.
  if (session.role === "SALES") redirect("/dashboard/price-list");
  return <div style={{ padding: "2rem" }}><ProductMasterClient role={session.role} /></div>;
}