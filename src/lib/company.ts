// Active-company resolution for the multi-company feature.
// The active company is stored in the `unnati_company` cookie. If missing or
// invalid, we fall back to the first active company (Company #1 for existing data).
import { cookies } from "next/headers";
import { prisma } from "./prisma";

export const COMPANY_COOKIE = "unnati_company";

// Resolve the active company id from the cookie, validating it against the DB.
// Falls back to the first active company. Returns "1" as a last resort so
// callers always get a usable id even on a cold/empty DB.
export async function getActiveCompanyId(): Promise<string> {
  let cookieId: string | undefined;
  try {
    const store = await cookies();
    cookieId = store.get(COMPANY_COOKIE)?.value;
  } catch {
    // cookies() unavailable (e.g. outside a request) — fall through to default
  }

  try {
    if (cookieId) {
      const found = await prisma.companySetting.findFirst({
        where: { id: cookieId, isActive: true },
        select: { id: true },
      });
      if (found) return found.id;
    }
    const first = await prisma.companySetting.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (first) return first.id;
  } catch {
    // DB not reachable / table missing — fall through
  }
  return "1";
}

// Full active-company record (for branding on documents, etc.).
export async function getActiveCompany() {
  const id = await getActiveCompanyId();
  try {
    return await prisma.companySetting.findUnique({ where: { id } });
  } catch {
    return null;
  }
}
