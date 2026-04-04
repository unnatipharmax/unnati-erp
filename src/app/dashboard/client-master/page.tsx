import { getSession } from "../../../lib/auth";
import { redirect } from "next/navigation";
import ClientMasterClient from "./ClientMasterClient";

export default async function ClientMasterPage() {
  const session = await getSession();
  if (!session || !["ADMIN", "MANAGER"].includes(session.role))
    redirect("/dashboard");
  return <div style={{ padding: "2rem" }}><ClientMasterClient /></div>;
}
