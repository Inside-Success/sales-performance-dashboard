import { createHash } from "node:crypto";

import { getV58KnowledgeVersion, getV58OperationalPolicyCount } from "@/lib/ask-sales-faq/v5-8/knowledge";

export function getV59KnowledgeVersion() {
  const input = `${getV58KnowledgeVersion()}+v59_full_record_context_r1`;
  return `ask-sales-v59-${createHash("sha256").update(input).digest("hex").slice(0, 24)}`;
}

export function getV59OperationalPolicyCount() {
  return getV58OperationalPolicyCount();
}
