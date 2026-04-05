import { getSession } from "../../../lib/auth";
import { redirect } from "next/navigation";
import PurchaseBillsClient from "./PurchaseBillsClient";

export default async function PurchaseBillsPage() {
  const session = await getSession();
  if (!session || !["ADMIN", "MANAGER", "ACCOUNTS", "PACKAGING"].includes(session.role))
    redirect("/dashboard");
  return (
    <div style={{ padding: "2rem" }}>
      <PurchaseBillsClient />
    </div>
  );
}
