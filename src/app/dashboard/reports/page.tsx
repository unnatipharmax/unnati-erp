import { getSession } from "../../../lib/auth";
import { redirect } from "next/navigation";
import ReportsClient from "./ReportsClient";

export default async function ReportsPage() {
  const session = await getSession();
  if (!session || !["ADMIN", "MANAGER", "ACCOUNTS"].includes(session.role)) {
    redirect("/dashboard");
  }
  const isAdmin = session.role === "ADMIN" || session.role === "MANAGER";
  return <ReportsClient isAdmin={isAdmin} />;
}
