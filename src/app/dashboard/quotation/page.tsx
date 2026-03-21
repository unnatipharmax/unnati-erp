import { getSession } from "../../../lib/auth";
import { redirect } from "next/navigation";
import QuotationClient from "./QuotationClient";

export default async function QuotationPage() {
  const session = await getSession();
  if (!session || !["ADMIN", "MANAGER", "SALES"].includes(session.role))
    redirect("/dashboard");
  return (
    <div style={{ padding: "2rem" }}>
      <QuotationClient />
    </div>
  );
}
