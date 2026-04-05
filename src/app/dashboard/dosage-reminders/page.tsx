import { getSession } from "../../../lib/auth";
import { redirect } from "next/navigation";
import DosageRemindersClient from "./DosageRemindersClient";

export default async function DosageRemindersPage() {
  const session = await getSession();
  if (!session || !["ADMIN", "MANAGER"].includes(session.role))
    redirect("/dashboard");
  return <div style={{ padding: "2rem" }}><DosageRemindersClient /></div>;
}
