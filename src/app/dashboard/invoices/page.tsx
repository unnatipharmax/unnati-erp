import { getSession } from "../../../lib/auth";
import { redirect } from "next/navigation";
import InvoicesClient from "./InvoicesClient";

export default async function InvoicesPage() {
  const session = await getSession();
  if (!session || !["ADMIN", "MANAGER"].includes(session.role))
    redirect("/dashboard");
  return <div style={{ padding: "2rem" }}><InvoicesClient /></div>;
}
