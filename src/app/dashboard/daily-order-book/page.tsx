import { getSession } from "../../../lib/auth";
import { redirect } from "next/navigation";
import DailyOrderBookClient from "./DailyOrderBookClient";

export default async function DailyOrderBookPage() {
  const session = await getSession();
  if (!session || !["ADMIN", "MANAGER", "PACKAGING", "ACCOUNTS"].includes(session.role))
    redirect("/dashboard");
  return <DailyOrderBookClient />;
}
