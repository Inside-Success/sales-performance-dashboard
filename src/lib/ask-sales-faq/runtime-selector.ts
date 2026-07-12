import type { AskSalesFaqChatMessage } from "@/lib/ask-sales-faq/types";
import { runAskSalesFaq } from "@/lib/ask-sales-faq/runtime";
import { runAskSalesFaqV3 } from "@/lib/ask-sales-faq/v3/runtime";

export function selectedAskSalesFaqRuntimeVersion() {
  return process.env.ASK_SALES_FAQ_RUNTIME_VERSION === "v3" ? "v3" : "v2";
}

export function runSelectedAskSalesFaq(question: string, messages: AskSalesFaqChatMessage[] = []) {
  // The selector chooses exactly one runtime. V3 never falls through to V2 on
  // retrieval, generation, or validation failure; V2 remains rollback-only.
  return selectedAskSalesFaqRuntimeVersion() === "v3"
    ? runAskSalesFaqV3(question, messages)
    : runAskSalesFaq(question, messages);
}
