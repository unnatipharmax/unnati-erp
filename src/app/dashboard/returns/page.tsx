import { getSession } from "../../../lib/auth";
import { redirect }   from "next/navigation";
import ReturnsClient  from "./ReturnsClient";

export default async function ReturnsPage() {
  const session = await getSession();
  if (!session || !["ADMIN", "MANAGER", "ACCOUNTS"].includes(session.role))
    redirect("/dashboard");
  return (
    <div style={{ padding: "2rem" }}>
      <ReturnsClient />
    </div>
  );
}
