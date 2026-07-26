import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AskSalesV4Lab } from "@/components/ask-sales-faq/ask-sales-v4-lab";
import { isV4IsolatedRuntimeEnabled } from "@/lib/ask-sales-faq/v4/isolation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ask Sales V5.5 Evidence Entailment Lab",
  robots: { index: false, follow: false, noarchive: true },
};

export default function AskSalesV5LabPage() {
  if (!isV4IsolatedRuntimeEnabled()) notFound();
  return (
    <AskSalesV4Lab
      apiPath="/api/ask-sales-faq/v5-isolated"
      eyebrow="V5.5 raw-record entailment evaluation"
      title="Ask Sales V5.5 isolated lab"
      description="A version-locked governed knowledge snapshot with publish-time conflict blocking, direct raw question-to-record entailment, measured action ownership, and qualifier-preserving grounding. V3 production remains untouched and this chat is not persisted."
      versionLabel="V5.5"
    />
  );
}
