import { prisma } from "../../../lib/prisma";   
import ClientForm from "./ClientForm";

export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const link = await prisma.clientFormLink.findUnique({
    where: { token },
    select: { token: true, isUsed: true, expiresAt: true, companyId: true },
  });

  if (!link) return <div>Invalid link.</div>;
  if (link.isUsed) return <div>This link has already been used.</div>;
  if (new Date(link.expiresAt) < new Date()) return <div>This link has expired.</div>;

  // Brand the form with the link's company (falls back to the primary company).
  const company = await prisma.companySetting.findUnique({
    where: { id: link.companyId ?? "1" },
    select: { name: true, logoB64: true },
  });
  const companyName = company?.name || "UNNATI PHARMAX";
  const companyLogo = company?.logoB64 && company.logoB64.startsWith("data:") ? company.logoB64 : null;

  return <ClientForm token={token} companyName={companyName} companyLogo={companyLogo} />;
}