import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AskSalesV4Lab } from "@/components/ask-sales-faq/ask-sales-v4-lab";
import { isV4IsolatedRuntimeEnabled } from "@/lib/ask-sales-faq/v4/isolation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ask Sales V4.4 Hybrid Isolated Lab",
  robots: { index: false, follow: false, noarchive: true },
};

export default function AskSalesV4SystemicLabPage() {
  if (!isV4IsolatedRuntimeEnabled()) notFound();
  return (
    <AskSalesV4Lab
      apiPath="/api/ask-sales-faq/v4-systemic-isolated"
      eyebrow="V4.4 hybrid challenger evaluation"
      title="Ask Sales V4.4 hybrid lab"
      description="Atomic policy decisions plus hybrid lexical, structured, and deterministic vector retrieval, exact relationship binding, action-owner routing, and sentence-level validation. V3 remains untouched and this chat is not persisted."
    />
  );
}
