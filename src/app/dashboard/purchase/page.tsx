import { getSession } from "../../../lib/auth";
import { redirect } from "next/navigation";
import PurchaseBillClient from "./PurchaseBillClient";

export default async function PurchaseBillPage() {
  const session = await getSession();
  if (!session || !["ADMIN","MANAGER","ACCOUNTS","PACKAGING"].includes(session.role))
    redirect("/dashboard");
  return <div style={{ padding: "2rem" }}><PurchaseBillClient /></div>;
}