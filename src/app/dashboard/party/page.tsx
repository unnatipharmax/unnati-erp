import { getSession } from "../../../lib/auth";
import { redirect } from "next/navigation";
import PartyMasterClient from "./PartyMasterClient";

export default async function PartyPage() {
  const session = await getSession();
  if (!session || !["ADMIN","MANAGER"].includes(session.role))
    redirect("/dashboard");
  return <div style={{ padding: "2rem" }}><PartyMasterClient /></div>;
}