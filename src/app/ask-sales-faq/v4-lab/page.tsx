import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AskSalesV4Lab } from "@/components/ask-sales-faq/ask-sales-v4-lab";
import { isV4IsolatedRuntimeEnabled } from "@/lib/ask-sales-faq/v4/isolation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ask Sales V4 Isolated Lab",
  robots: { index: false, follow: false, noarchive: true },
};

export default function AskSalesV4LabPage() {
  if (!isV4IsolatedRuntimeEnabled()) notFound();
  return <AskSalesV4Lab />;
}
