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
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="w-full max-w-lg bg-slate-900/70 border border-slate-800 rounded-2xl p-6">
          <h1 className="text-xl font-semibold">Invalid link</h1>
          <p className="text-slate-400 mt-2">
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
