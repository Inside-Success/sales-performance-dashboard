import { headers } from "next/headers";
import { auth } from "@/auth";
import { HeaderVisibility } from "@/components/dashboard/header-visibility";

export async function AppHeader() {
  const requestHeaders = await headers();
  if (requestHeaders.get("x-ask-sales-v4-lab-request") === "1") return null;

  const session = await auth();
  const userName = session?.user?.name?.trim() || "Signed-in user";
  const userEmail = session?.user?.email?.trim() || "Google account";

  return <HeaderVisibility userName={userName} userEmail={userEmail} />;
}
