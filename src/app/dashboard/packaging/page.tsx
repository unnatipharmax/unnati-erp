import { getSession } from "../../../lib/auth";
import { redirect } from "next/navigation";
import PackagingClient from "./PackagingClient";

export default async function PackagingPage() {
  const session = await getSession();
  if (!session || !["ADMIN","MANAGER","PACKAGING"].includes(session.role))
    redirect("/dashboard");
  return <div style={{ padding: "2rem" }}><PackagingClient /></div>;
}