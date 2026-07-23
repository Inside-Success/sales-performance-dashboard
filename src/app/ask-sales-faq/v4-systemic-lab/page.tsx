import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AskSalesV4Lab } from "@/components/ask-sales-faq/ask-sales-v4-lab";
import { isV4IsolatedRuntimeEnabled } from "@/lib/ask-sales-faq/v4/isolation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ask Sales V4 Systemic Isolated Lab",
  robots: { index: false, follow: false, noarchive: true },
};

export default function AskSalesV4SystemicLabPage() {
  if (!isV4IsolatedRuntimeEnabled()) notFound();
  return (
    <AskSalesV4Lab
      apiPath="/api/ask-sales-faq/v4-systemic-isolated"
      eyebrow="Systemic challenger evaluation"
      title="Ask Sales V4 systemic lab"
      description="Generalized multi-need retrieval over governed policy plus the reviewed operational Q&A overlay, with sentence-level validation and frozen-V4 rescue. V3 remains untouched and this chat is not persisted."
    />
  );
}
