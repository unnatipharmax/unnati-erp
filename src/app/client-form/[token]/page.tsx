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
    select: { token: true, isUsed: true, expiresAt: true },
  });

  if (!link) return <div>Invalid link.</div>;
  if (link.isUsed) return <div>This link has already been used.</div>;
  if (new Date(link.expiresAt) < new Date()) return <div>This link has expired.</div>;

  return <ClientForm token={token} />;
}