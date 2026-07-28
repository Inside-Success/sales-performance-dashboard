import { getV57KnowledgeVersion, getV57OperationalPolicyCount } from "@/lib/ask-sales-faq/v5-7/knowledge";

export function getV58KnowledgeVersion() {
  return `${getV57KnowledgeVersion()}+v58_relationship_owner_context_r1`;
}

export function getV58OperationalPolicyCount() {
  return getV57OperationalPolicyCount();
}
