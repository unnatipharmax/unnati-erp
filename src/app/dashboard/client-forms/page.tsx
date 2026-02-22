// src/app/dashboard/client-forms/page.tsx
import CreateClientLinkCard      from "./CreateClientLinkCard";
import CreateClientMultiLinkCard from "./CreateClientMultiLinkCard";
import ClientAccountsList        from "./ClientAccountsList";

export default function ClientFormsPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Client Forms</h1>

      {/* Creation cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <CreateClientLinkCard />
        <CreateClientMultiLinkCard />
      </div>

      {/* ✅ Persistent list — download button always available here */}
      <ClientAccountsList />
    </div>
  );
}