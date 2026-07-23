import { describe, expect, it } from "vitest";
import { runAskSalesFaqV4 } from "@/lib/ask-sales-faq/v4/runtime";
import type { AskSalesFaqV4Result } from "@/lib/ask-sales-faq/v4/types";
import type { V3Provider } from "@/lib/ask-sales-faq/v3/types";

const unavailableProvider: V3Provider = async () => {
  throw new Error("No model credential is configured in this isolated compound-safety test");
};

async function runWithoutModel(question: string) {
  return runAskSalesFaqV4(question, [], {
    provider: unavailableProvider,
    validatorProvider: unavailableProvider,
  });
}

function expectIndependentClausePreserved(result: AskSalesFaqV4Result, unrelatedDecision: RegExp) {
  const diagnostic = JSON.stringify({
    lane: result.lane,
    answer: result.answer,
    planning: result.runtimeMetadata.executionMode.planning,
    needs: result.runtimeMetadata.plan.needs,
  });
  const answerNeeds = result.runtimeMetadata.plan.needs.filter((need) => need.lane === "answer");
  const nonAnswerNeeds = result.runtimeMetadata.plan.needs.filter((need) => need.lane !== "answer");
  const matchingNonAnswerNeeds = nonAnswerNeeds.filter((need) => unrelatedDecision.test(need.text));

  expect(result.lane, diagnostic).not.toBe("answer");
  expect(matchingNonAnswerNeeds.length, diagnostic).toBeGreaterThan(0);
  for (const need of matchingNonAnswerNeeds) {
    expect(need.evidence_refs, diagnostic).toEqual([]);
    expect(need.supported_claim, diagnostic).toBe("");
  }
  for (const need of answerNeeds) {
    expect(need.text, diagnostic).not.toMatch(unrelatedDecision);
    expect(need.supported_claim, diagnostic).not.toMatch(unrelatedDecision);
  }
}

const governedCompoundCases: Array<{
  family: string;
  question: string;
  unrelatedDecision: RegExp;
}> = [
  {
    family: "20 percent recording and disclosure",
    question: "When dialing out on Zoom for the 20% list, must I record the call and tell the prospect? Separately, may I promise a full refund if the prospect later objects?",
    unrelatedDecision: /refund/i,
  },
  {
    family: "NLCEO no-cohort template boundary",
    question: "For Next Level CEO, the confirmation text says the cohort closes Sunday even though DJ has no cohort. May I edit that wording myself? Separately, may the applicant bring a guest to the Mastermind?",
    unrelatedDecision: /guest|mastermind/i,
  },
  {
    family: "internal statistics sharing boundary",
    question: "May I send a prospect a screenshot of the 2025 Inside Success statistics slide with the social reach and combined following? Separately, may I promise a full refund if their episode does not generate leads?",
    unrelatedDecision: /refund/i,
  },
  {
    family: "podcast purpose and current format",
    question: "Are the podcast questions designed for lead generation, and what is the current episode format? Separately, may I promise a full refund if the episode generates no leads?",
    unrelatedDecision: /refund/i,
  },
  {
    family: "early-stage and future-launch qualification",
    question: "A lead's website, social media, and company have not launched yet. Should I still conduct Call 1 instead of automatically disqualifying them? Separately, may they bring two guests to the red-carpet event?",
    unrelatedDecision: /guests?|red[- ]carpet/i,
  },
  {
    family: "VIP-to-VIP repeat-episode discount",
    question: "What discount is available when a VIP client buys a second VIP ISTV episode? Separately, is that second purchase refundable if the client cancels after signing?",
    unrelatedDecision: /refund|cancel/i,
  },
  {
    family: "scriptwriter process",
    question: "Are cast members still paired with a scriptwriter and given a scripting call? Separately, may a client cancel the contract for a full refund after the script is drafted?",
    unrelatedDecision: /refund|cancel(?: the)? contract/i,
  },
  {
    family: "event-access sales-to-onboarding handoff",
    question: "Should event access be explained during Call 2 or during onboarding after the sale? Separately, may the client cancel the signed contract for a full refund?",
    unrelatedDecision: /refund|cancel(?: the)? signed contract/i,
  },
  {
    family: "partner payment eligibility",
    question: "Is a business partner who is not in Keap allowed to pay on behalf of the correct client? Separately, may that payer bring a guest to the red-carpet event?",
    unrelatedDecision: /guest|red[- ]carpet/i,
  },
  {
    family: "recurring invoice and ledger process",
    question: "Are recurring client installment invoices automated, and should the payments appear in the sales ledger? Separately, may a rep record the client without disclosing it?",
    unrelatedDecision: /record(?: the client)? without disclos/i,
  },
  {
    family: "recently disqualified repeat-applicant process",
    question: "May I cancel an audition for someone I recently disqualified who keeps applying again, and how do I stop repeat bookings? Separately, may I promise a legal exception to the 90-day wait if they sign a contract?",
    unrelatedDecision: /legal exception|sign a contract/i,
  },
  {
    family: "20 percent confirmation templates and timing",
    question: "What email and text templates apply the night before and the morning of a call booked from the 20% list? Separately, may I promise a refund if the prospect dislikes the wording?",
    unrelatedDecision: /refund/i,
  },
  {
    family: "$20K promotional-view package fingerprint",
    question: "Does the $20K package include 100,000 pre-promo views? Separately, does that package guarantee entry for two guests at the red carpet?",
    unrelatedDecision: /guests?|red carpet/i,
  },
];

describe("Ask Sales V4 deterministic governed compound safety", () => {
  it.each(governedCompoundCases)(
    "does not let $family evidence absorb an unrelated decision",
    async ({ question, unrelatedDecision }) => {
      const result = await runWithoutModel(question);

      expect(result.provider).toBeNull();
      expect(result.model).toBeNull();
      expectIndependentClausePreserved(result, unrelatedDecision);
    },
  );

  it("lets a canonical bankruptcy blocker override an otherwise safe podcast family", async () => {
    const result = await runWithoutModel(
      "Are the podcast questions designed for lead generation, and what is the current episode format? Separately, does bankruptcy disqualify an applicant from Call 2?",
    );

    expect(result.runtimeMetadata.retrieval.blockedTopicIds).toContain("bankruptcy-qualification");
    expectIndependentClausePreserved(result, /bankruptcy.*disqualif|disqualif.*bankruptcy/i);
    expect(result.runtimeMetadata.plan.needs.filter((need) => need.lane === "answer")).toEqual([]);
  });
});

const falsePositiveCases: Array<{
  family: string;
  question: string;
  forbiddenPolicyIds: string[];
}> = [
  {
    family: "recurring invoice",
    question: "May I refund a client's recurring payment?",
    forbiddenPolicyIds: ["claim_754c01ed0089dc82"],
  },
  {
    family: "partner payment",
    question: "May I refund a client payment to their business partner?",
    forbiddenPolicyIds: ["claim_51695e7c59d2608a"],
  },
  {
    family: "internal statistics sharing",
    question: "May I screenshot a client's statistics slide for internal use only?",
    forbiddenPolicyIds: ["claim_49827b5abfa86d45", "claim_848ba0ca58988282__a2"],
  },
  {
    family: "podcast purpose and format",
    question: "A client records an external podcast interview. What recording format should they use?",
    forbiddenPolicyIds: ["owner-podcast-purpose-and-current-format"],
  },
  {
    family: "20 percent recording and disclosure",
    question: "Should I record card-payment details while calling a lead from the 20% list?",
    forbiddenPolicyIds: ["owner-twenty-percent-recording-and-disclosure"],
  },
  {
    family: "recently disqualified repeat-applicant process",
    question: "Why was this recently disqualified applicant rejected?",
    forbiddenPolicyIds: ["claim_a5945bc4fd156d47", "claim_4c5932f5c97e68ed"],
  },
];

describe("Ask Sales V4 governed-family predicate precision", () => {
  it.each(falsePositiveCases)(
    "does not use the $family family for a different decision object",
    async ({ question, forbiddenPolicyIds }) => {
      const result = await runWithoutModel(question);
      const diagnostic = JSON.stringify({
        lane: result.lane,
        selectedPolicyIds: result.selectedPolicyIds,
        planning: result.runtimeMetadata.executionMode.planning,
        needs: result.runtimeMetadata.plan.needs,
      });

      expect(result.lane, diagnostic).not.toBe("answer");
      expect(result.runtimeMetadata.executionMode.planning, diagnostic).not.toBe("deterministic_governed");
      expect(result.selectedPolicyIds, diagnostic).not.toEqual(expect.arrayContaining(forbiddenPolicyIds));
      for (const need of result.runtimeMetadata.plan.needs.filter((candidate) => candidate.lane === "answer")) {
        expect(need.evidence_refs, diagnostic).not.toEqual(expect.arrayContaining(forbiddenPolicyIds));
      }
    },
  );
});
