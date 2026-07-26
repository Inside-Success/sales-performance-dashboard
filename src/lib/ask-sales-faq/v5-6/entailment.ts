import type { V3Provider, V3TurnResolution } from "@/lib/ask-sales-faq/v3/types";
import type { V4SystemicSourcePlan } from "@/lib/ask-sales-faq/v4/systemic/runtime";
import type { V4SystemicQueryPlan, V4SystemicRetrieval } from "@/lib/ask-sales-faq/v4/systemic/types";
import { refineSourcePlanWithRawEntailment } from "@/lib/ask-sales-faq/v5-5/entailment";

export function refineV56SourcePlanWithRawEntailment(input: {
  turn: V3TurnResolution;
  plan: V4SystemicQueryPlan;
  retrieval: V4SystemicRetrieval;
  sourcePlan: V4SystemicSourcePlan;
  provider: V3Provider;
}) {
  return refineSourcePlanWithRawEntailment(input, {
    purpose: "v5_6_bounded_raw_record_entailment_validation",
    maxCandidatesPerNeed: 20,
    maxTokens: 5200,
    applyAuthorityResolutions: true,
    exactQualifierBoundaries: true,
    exactRelationshipContexts: true,
    compactDifferentQuestionRecords: true,
    enforceControllingAuthorityWhenAvailable: true,
    enforceRequiredAuthorityComposition: true,
    versionLabel: "V5.6",
  });
}
