import { getSession } from "../../../lib/auth";
import { redirect } from "next/navigation";
import ProductMasterClient from "./ProductMasterClient";

export default async function ProductMasterPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <div style={{ padding: "2rem" }}><ProductMasterClient /></div>;
}