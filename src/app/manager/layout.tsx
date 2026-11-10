import type { ReactNode } from "react";
import { requireRepScoringAdmin } from "@/lib/rep-scoring/access";

export default async function ManagerLayout({ children }: { children: ReactNode }) {
  await requireRepScoringAdmin();
  return <>{children}</>;
}
