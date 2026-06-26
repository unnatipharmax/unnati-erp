import { prisma } from "../../../lib/prisma";
import ClientMultiForm from "./ClientMultiForm";

export const runtime = "nodejs";

export default async function ClientMultiFormPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  // Next 16: params is a Promise
  const { token } = await params;

  const link = await prisma.clientAccountLink.findUnique({
    where: { token },
    include: {
      account: {
        select: {
          id: true,
          name: true,
          balance: true,
          isActive: true,
        },
      },
    },
  });

  // invalid token OR link disabled OR account disabled
  if (!link || !link.isActive || !link.account?.isActive) {
    return (
      <div style={{
        minHeight: "100vh", background: "var(--background)", color: "var(--text-primary)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem 1rem",
      }}>
        <div className="card" style={{ width: "100%", maxWidth: 520 }}>
          <h1 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700 }}>Invalid link</h1>
          <p style={{ marginTop: "0.5rem", fontSize: "0.875rem", color: "var(--text-secondary)" }}>
            This multi-order link is not active. Please contact the sales team.
          </p>
        </div>
      </div>
    );
  }

  const balanceNum = Number(link.account.balance);

  return (
    <ClientMultiForm
      token={token}
      accountId={link.account.id}
      accountName={link.account.name}
      balance={balanceNum}
    />
  );
}
