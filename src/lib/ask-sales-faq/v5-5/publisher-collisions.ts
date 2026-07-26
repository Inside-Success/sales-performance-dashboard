import type { V4SystemicPolicy } from "@/lib/ask-sales-faq/v4/systemic/types";
import { v54MaterialEffectsConflict } from "@/lib/ask-sales-faq/v5/consensus";

export type V55PublishCollision = {
  decisionKey: string;
  policyIds: string[];
  answerEvidencePolicyIds: string[];
  reason: string;
};

function primaryDecision(value: string) {
  return value.split(/\b(?:Conditions?|Boundaries):/i)[0].replace(/\s+/g, " ").trim();
}

/**
 * Builds the request-independent collision registry that a publisher should
 * clear through explicit supersession or scoped coexistence. Runtime is not
 * allowed to choose a winner from one of these same-key material conflicts.
 */
export function findV55PublishCollisions(policies: readonly V4SystemicPolicy[]) {
  const groups = new Map<string, V4SystemicPolicy[]>();
  for (const policy of policies) {
    if (!policy.decision_key) continue;
    groups.set(policy.decision_key, [...(groups.get(policy.decision_key) || []), policy]);
  }
  const collisions: V55PublishCollision[] = [];
  for (const [decisionKey, group] of groups) {
    const answerEvidence = group.filter((policy) => policy.answerability === "answer_evidence");
    if (!answerEvidence.length || group.length < 2) continue;
    const conflicting = new Set<string>();
    for (let leftIndex = 0; leftIndex < group.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < group.length; rightIndex += 1) {
        const left = group[leftIndex];
        const right = group[rightIndex];
        if (!v54MaterialEffectsConflict(primaryDecision(left.decision), primaryDecision(right.decision))) continue;
        conflicting.add(left.id);
        conflicting.add(right.id);
      }
    }
    if (!conflicting.size || !answerEvidence.some((policy) => conflicting.has(policy.id))) continue;
    collisions.push({
      decisionKey,
      policyIds: [...conflicting].sort(),
      answerEvidencePolicyIds: answerEvidence.filter((policy) => conflicting.has(policy.id)).map((policy) => policy.id).sort(),
      reason: "Same decision key contains materially incompatible active records and needs explicit publisher supersession or scoped coexistence.",
    });
  }
  return collisions.sort((left, right) => left.decisionKey.localeCompare(right.decisionKey));
}

export function v55BlockedDecisionKeys(policies: readonly V4SystemicPolicy[]) {
  return new Set(findV55PublishCollisions(policies).map((collision) => collision.decisionKey));
}
