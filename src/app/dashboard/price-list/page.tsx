import { getSession } from "../../../lib/auth";
import { redirect } from "next/navigation";
import PriceListClient from "./PriceListClient";

export default async function PriceListPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return (
    <div className="p-6">
      <PriceListClient />
    </div>
  );
}
