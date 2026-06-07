import { getSession } from "../../../lib/auth";
import { redirect } from "next/navigation";
import AnjaniCourierClient from "./AnjaniCourierClient";

export default async function AnjaniCourierPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return (
    <div className="p-6">
      <AnjaniCourierClient />
    </div>
  );
}
