import "server-only";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isRepScoringAdmin } from "@/lib/rep-scoring/admin-allowlist";

export { getRepScoringAdminEmails, isRepScoringAdmin } from "@/lib/rep-scoring/admin-allowlist";

export async function requireRepScoringAdmin() {
  const session = await auth();
  if (!isRepScoringAdmin(session?.user?.email)) redirect("/coaching");
  return session;
}
