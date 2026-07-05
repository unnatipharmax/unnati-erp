import { getSession } from "../../lib/auth";
import { getActiveCompanyId } from "../../lib/company";
import { redirect } from "next/navigation";
import Sidebar from "../../components/Sidebar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const activeCompanyId = await getActiveCompanyId();

  return (
    <div style={{ display: "flex", minHeight: "100vh", marginTop: 20 }}>
      <Sidebar userName={session.name} userRole={session.role as any} activeCompanyId={activeCompanyId} />
      <main style={{ flex: 1, overflow: "auto" }}>
        {children}
      </main>
    </div>
  );
}