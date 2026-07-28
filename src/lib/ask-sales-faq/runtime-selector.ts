import type { AskSalesFaqChatMessage } from "@/lib/ask-sales-faq/types";
import { runAskSalesFaq } from "@/lib/ask-sales-faq/runtime";
import { runAskSalesFaqV3 } from "@/lib/ask-sales-faq/v3/runtime";
import { runAskSalesFaqV514Production } from "@/lib/ask-sales-faq/v5-14/production";

export function selectedAskSalesFaqRuntimeVersion() {
  const configured = process.env.ASK_SALES_FAQ_RUNTIME_VERSION?.trim().toLowerCase();
  if (configured === "v5.14") return "v5.14" as const;
  if (configured === "v2") return "v2" as const;
  // V3 is the safe production fallback for an empty, misspelled, or unknown
  // selector. This prevents configuration drift from silently reviving V2.
  return "v3" as const;
}

export function runSelectedAskSalesFaq(question: string, messages: AskSalesFaqChatMessage[] = []) {
  // The selector chooses exactly one runtime. A selected runtime never falls
  // through to another runtime after retrieval, generation, or validation.
  // V3 is the operational rollback target; V2 remains explicit-only.
  const selected = selectedAskSalesFaqRuntimeVersion();
  if (selected === "v5.14") return runAskSalesFaqV514Production(question, messages);
  if (selected === "v2") return runAskSalesFaq(question, messages);
  return runAskSalesFaqV3(question, messages);
}
