import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.user.findUnique({ where: { username: "admin" } });
  if (existing) { console.log("✅ Admin already exists"); return; }

  const hashed = await bcrypt.hash("admin123", 12);
  await prisma.user.create({
    data: { username: "admin", email: "admin@unnatipharmax.com", password: hashed, name: "Admin", role: "ADMIN" },
  });
  console.log("✅ Admin created — username: admin / password: admin123");
  console.log("⚠️  Change the password after first login!");
}

main().catch(console.error).finally(() => prisma.$disconnect());