import { getSession } from "../../../lib/auth";
import { redirect } from "next/navigation";
import GstFilingClient from "./GstFilingClient";

export default async function GstFilingPage() {
  const session = await getSession();
  if (!session || !["ADMIN", "MANAGER", "ACCOUNTS"].includes(session.role))
    redirect("/dashboard");
  return <GstFilingClient />;
}
