import { createHash } from "node:crypto";

import { getV59KnowledgeVersion, getV59OperationalPolicyCount } from "@/lib/ask-sales-faq/v5-9/knowledge";

export function getV510KnowledgeVersion() {
  const input = `${getV59KnowledgeVersion()}+v510_decision_family_evidence_control_r1`;
  return `ask-sales-v510-${createHash("sha256").update(input).digest("hex").slice(0, 24)}`;
}

export function getV510OperationalPolicyCount() {
  return getV59OperationalPolicyCount();
}
