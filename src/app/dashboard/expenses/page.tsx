import { getSession } from "../../../lib/auth";
import { redirect } from "next/navigation";
import ExpensesClient from "./ExpensesClient";

export default async function ExpensesPage() {
  const session = await getSession();
  if (!session || !["ADMIN", "MANAGER", "ACCOUNTS"].includes(session.role))
    redirect("/dashboard");
  return (
    <div style={{ padding: "2rem" }}>
      <ExpensesClient />
    </div>
  );
}
