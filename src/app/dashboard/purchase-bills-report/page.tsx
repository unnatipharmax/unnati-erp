import { getSession } from "../../../lib/auth";
import { redirect } from "next/navigation";
import PurchaseBillsReport from "./PurchaseBillsReport";

export default async function PurchaseBillsReportPage() {
  const session = await getSession();
  if (!session || !["ADMIN", "MANAGER", "ACCOUNTS"].includes(session.role))
    redirect("/dashboard");
  return <div style={{ padding: "2rem" }}><PurchaseBillsReport /></div>;
}
