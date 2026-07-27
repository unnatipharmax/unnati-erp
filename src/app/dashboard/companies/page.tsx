import { getSession } from "../../../lib/auth";
import { redirect } from "next/navigation";
import CompaniesClient from "./CompaniesClient";

export default async function CompaniesPage() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") redirect("/dashboard");
  return <CompaniesClient />;
}
