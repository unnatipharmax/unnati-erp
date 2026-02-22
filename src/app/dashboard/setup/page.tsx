import { getSession } from "../../../lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "../../../lib/prisma";
import SetupClient from "./SetupClient";

export default async function SetupPage() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") redirect("/dashboard");

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, username: true, email: true, name: true, role: true, isActive: true, createdAt: true },
  });

  return (
    <div style={{ padding: "2rem" }}>
      <div style={{ marginBottom: "1.5rem" }}>
        <h1>Setup</h1>
        <p>Manage users and their roles. Only admins can access this page.</p>
      </div>
      <SetupClient
        initialUsers={users.map(u => ({ ...u, createdAt: u.createdAt.toISOString() }))}
        currentUserId={session.id}
      />
    </div>
  );
}