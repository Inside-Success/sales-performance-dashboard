import { describe, expect, it } from "vitest";

import type { V4SystemicSourcePlan } from "@/lib/ask-sales-faq/v4/systemic/runtime";
import type { V4SystemicCandidate, V4SystemicNeed, V4SystemicPolicy, V4SystemicQueryPlan, V4SystemicRetrieval } from "@/lib/ask-sales-faq/v4/systemic/types";
import { v513DecisionContractErrors } from "@/lib/ask-sales-faq/v5-13/decision-contract";
import { enforceV513DecisionContract } from "@/lib/ask-sales-faq/v5-13/entailment";
import { V513_CURRENT_STUDIO_ADDRESS_POLICY } from "@/lib/ask-sales-faq/v5-13/knowledge";
import { isV513CurrentStudioAddressNeed, retrieveV513Policies } from "@/lib/ask-sales-faq/v5-13/retrieval";
import { resolveV512Turn } from "@/lib/ask-sales-faq/v5-12/runtime";

function need(text: string, relation: V4SystemicNeed["relation"] = "other"): V4SystemicNeed {
  return {
    id: "N1", text, authorityText: text, originalRequestText: text, retrievalQueries: [text],
    productScope: "unknown", domains: [], actions: [], entities: [], relation,
    requestKind: "knowledge", ambiguity: "none", clarificationQuestion: "",
  };
}

function policy(id: string, title: string, decision: string): V4SystemicPolicy {
  return {
    ...V513_CURRENT_STUDIO_ADDRESS_POLICY,
    id, policy_key: id, decision_key: id, title, decision,
    question_families: [title], domains: [], actions: [], entities: [], search_text: `${title} ${decision}`,
  };
}

function retrievalFor(item: V4SystemicNeed, selected: V4SystemicPolicy): V4SystemicRetrieval {
  const candidate: V4SystemicCandidate = {
    policy: selected, rank: 1, score: 100, matchedQueries: [item.text], matchedTerms: [],
    lexicalScore: 100, familyScore: 0, characterScore: 0, structuredScore: 0,
    authorityScore: 0, relationScore: 20, needScores: { [item.id]: {
      score: 100, rank: 1, lexicalScore: 100, familyScore: 0, characterScore: 0,
      structuredScore: 0, semanticVectorScore: 0, relationScore: 20,
      matchedDecisionId: selected.id, matchedDecisionText: selected.decision,
    } },
  };
  return { query: item.text, turn: resolveV512Turn(item.text), corpusSize: 1, candidates: [candidate], blockedTopicIds: [], blockedMatches: [], stageTimings: {} };
}

function sourcePlan(item: V4SystemicNeed, selected: V4SystemicPolicy): V4SystemicSourcePlan {
  return { needs: [{
    needId: item.id, lane: "answer", directPolicyIds: [selected.id], preferredPolicyIds: [selected.id],
    excludedConflictPolicyIds: [], reason: "selected",
  }], reasoningSummary: "test" };
}

describe("V5.13 immutable final decision contract", () => {
  it("rejects a VIP platform-boundary record for a benefits question", () => {
    const item = need("What else does VIP include besides Amazon Prime submission?", "inclusion");
    const wrong = policy("vip-boundary", "VIP platform submission boundary", "VIP primarily adds Amazon Prime submission and placement is not guaranteed.");
    expect(v513DecisionContractErrors(item, wrong)).toContain("focus_mismatch:package_benefits");
    expect(enforceV513DecisionContract(sourcePlan(item, wrong), { needs: [item], conversationIntent: "answer", reasoningSummary: "test" }, retrievalFor(item, wrong)).sourcePlan.needs[0].lane).toBe("route");
  });

  it("rejects a contract-amendment record for automatic contract delivery", () => {
    const item = need("Do we need to send them the contract or does it come up automatically?", "requirement");
    const wrong = policy("amendments", "No contract amendments", "We do not make contract changes on the sales call.");
    expect(v513DecisionContractErrors(item, wrong)).toContain("focus_mismatch:contract_delivery");
    const misleadingMetadata = { ...wrong, title: "Should reps send the contract automatically?", question_families: ["Does the contract send automatically?"] };
    expect(v513DecisionContractErrors(item, misleadingMetadata)).toContain("focus_mismatch:contract_delivery");
  });

  it("separates Amazon publication timing from platform duration", () => {
    const item = need("How long until the episode goes live on Amazon Prime?", "timing_start");
    const wrong = policy("duration", "Amazon duration", "The episode remains on Amazon Prime for a minimum term and extensions are not promised.");
    expect(v513DecisionContractErrors(item, wrong)).toContain("relationship_mismatch:publication_timing_vs_duration");
  });

  it("does not bind studio visits as address requests", () => {
    expect(isV513CurrentStudioAddressNeed(need("What is the current Inside Success studio address?"))).toBe(true);
    expect(isV513CurrentStudioAddressNeed(need("Can a prospect visit the studio before signing?"))).toBe(false);
    const visit = need("A prospect wants to stop by the Miami studio before deciding. Can I arrange an informal pop-in?", "permission");
    const visitPolicy = policy("visit", "Prospect studio visit", "Do not arrange an unplanned studio visit. Send the virtual studio walkthrough instead.");
    expect(v513DecisionContractErrors(visit, visitPolicy)).toEqual([]);
  });

  it("injects only the owner-confirmed current address for an address need", () => {
    const item = need("Where is the current Inside Success studio located?", "location");
    const plan: V4SystemicQueryPlan = { needs: [item], conversationIntent: "answer", reasoningSummary: "test" };
    const result = retrieveV513Policies(resolveV512Turn(item.text), plan);
    const selected = result.candidates.filter((candidate) => candidate.needScores?.N1);
    expect(selected.map((candidate) => candidate.policy.id)).toEqual([V513_CURRENT_STUDIO_ADDRESS_POLICY.id]);
    expect(selected[0].policy.decision).toContain("751 Collins Avenue, Miami Beach, FL 33139");
    expect(isV513CurrentStudioAddressNeed(need("Where can customers download the ISTV app?"))).toBe(false);
  });

  it("allows a source that answers the same content-rights relationship", () => {
    const item = need("Can the client post and share the chopped reels on social media?", "permission");
    const right = policy("rights", "Social content rights", "The client may post and share the provided social assets and chopped reels on social media.");
    expect(v513DecisionContractErrors(item, right)).toEqual([]);
  });

  it("does not reuse broad permission-vs-requirement vetoes after the exact object contract passes", () => {
    const item = need("Do we need to send the contract manually?", "requirement");
    const right = policy("delivery", "Contract delivery", "The rep may send the approved contract PDF manually by email.");
    expect(v513DecisionContractErrors(item, right)).toEqual([]);
  });

  it("keeps payment-before-contract sequencing separate from contract delivery automation", () => {
    const item = need("Do I send the payment link or contract link first, or both at the same time?", "procedure");
    const right = policy("sequence", "Standard payment before contract", "Collect payment first and then have the client sign the contract. Do not have a client sign tonight when payment will arrive tomorrow.");
    expect(v513DecisionContractErrors(item, right)).toEqual([]);
  });

  it("rejects a later reschedule rule for the immediate Call 1 waiting SOP", () => {
    const item = need("What is the SOP when I join Call 1 and the client is not there yet?", "procedure");
    const wrong = policy("reapply", "Call 1 rescheduling", "If the first audition never happened, reschedule for next week without a 90-day wait.");
    expect(v513DecisionContractErrors(item, wrong)).toContain("focus_mismatch:call_waiting_no_show_sop");
  });

  it("rejects generic Call 2 timing as a price-objection response", () => {
    const item = need("price objection", "procedure");
    const wrong = policy("call2", "Call 2 pricing", "Price is discussed only on Call 2.");
    expect(v513DecisionContractErrors(item, wrong)).toContain("focus_mismatch:price_objection");
    const right = policy("objection", "Price objection handling", "Keep the response short; do not over-argue, and point only to approved public proof.");
    expect(v513DecisionContractErrors(item, right)).toEqual([]);
  });

  it("rejects a Keap note as the full outbound booking communication sequence", () => {
    const item = need("What communications do I have to send when someone books from outbound dialing?", "procedure");
    const wrong = policy("keap", "Update Keap", "Update Keap and leave a note about communication with the outbound lead.");
    expect(v513DecisionContractErrors(item, wrong)).toContain("focus_mismatch:outbound_booking_communications");
  });

  it("keeps the 20-percent offer discount separate from the 20-percent dialing recording SOP", () => {
    const item = need("When can I offer the 20% discount, and what process do I follow?", "procedure");
    const wrong = policy("recording", "20-percent outbound recording", "Record 20 percent outbound calls through Zoom and disclose that the call is recorded for training and quality.");
    const right = policy("discount", "Same-day discount", "The $2,000 discount is available only on the day of Call 2 until 11:59 PM.");
    expect(v513DecisionContractErrors(item, wrong)).toContain("relationship_mismatch:discount_vs_outbound_recording");
    expect(v513DecisionContractErrors(item, right)).toEqual([]);
  });

  it("does not use a payer-only rule to approve a different contract signer", () => {
    const item = need("If one business owner pays but the other owner signs the contract, is that allowed?", "permission");
    const wrong = policy("payer", "Partner payment", "Either the business owner or a partner can make the payment when contact information is assigned correctly.");
    const right = policy("payer-signer", "Owner payer and signer", "One business owner may make the payment while the other business owner signs the contract.");
    expect(v513DecisionContractErrors(item, wrong)).toContain("relationship_mismatch:payer_vs_signer");
    expect(v513DecisionContractErrors(item, right)).toEqual([]);
  });
});
