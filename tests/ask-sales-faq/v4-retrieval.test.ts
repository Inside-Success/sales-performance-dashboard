import { describe, expect, it } from "vitest";
import { resolveV3Turn } from "@/lib/ask-sales-faq/v3/turn-resolver";
import { retrieveV4Policies } from "@/lib/ask-sales-faq/v4/retrieval";
import { getV4BlockedTopics } from "@/lib/ask-sales-faq/v4/corpus";
import { v4BlockedTopicDecisionMatch } from "@/lib/ask-sales-faq/v4/boundaries";

function topIds(question: string) {
  const turn = resolveV3Turn(question, []);
  return retrieveV4Policies(turn, 20).candidates.map((candidate) => candidate.policy.id);
}

describe("Ask Sales V4 reciprocal-rank retrieval", () => {
  it("retrieves the governed VIP one-platform boundary for an all-three paraphrase", () => {
    expect(topIds("For VIP, do I submit the client to one Tier-1 platform or all three?")).toContain("owner-vip-tier-one-platform-boundary");
  });

  it("retrieves the hospital-employed doctor qualification decision", () => {
    expect(topIds("Can a physician employed by a hospital qualify without owning a private practice?")).toContain("owner-hospital-employed-doctor-qualification");
  });

  it("retrieves the complete main ISTV price and payment-plan card for a basic pricing question", () => {
    const result = retrieveV4Policies(resolveV3Turn("What are the current main ISTV prices and payment plans?", []), 60);
    const diagnostic = result.candidates.map((candidate) => `${candidate.rank}:${candidate.policy.id}:${candidate.policy.title}`).join("\n");
    expect(result.candidates.slice(0, 20).map((candidate) => candidate.policy.id), diagnostic).toContain("claim_c9e50172a4cd057b");
  });

  it("retrieves the negative show-watchability boundary instead of relying only on the catalog", () => {
    expect(topIds("Is Mompreneurs currently on air and where can the prospect watch an episode?")).toContain("owner-current-show-list-watchability-boundary");
  });

  it("keeps product scope exclusions hard", () => {
    const turn = resolveV3Turn("For main ISTV, not Daymond John, what are the Standard payment options?", []);
    const result = retrieveV4Policies(turn, 30);
    expect(result.candidates.some((candidate) => candidate.policy.product_scopes.includes("dj_nlceo"))).toBe(false);
  });

  it("ports the V3 controlling-decision exclusion before V4 ranking", () => {
    const result = retrieveV4Policies(resolveV3Turn("The same prospect is on two reps' calendars. Who owns it and what should the reps do?", []), 60);
    expect(result.candidates.map((candidate) => candidate.policy.id)).toContain("v3src_two_calendar_engagement");
    expect(result.candidates.some((candidate) => candidate.policy.blocked_for_decision_keys.includes("lead_ownership.same_prospect.two_calendars"))).toBe(false);
  });

  it("does not let paused/casting blocker wording suppress the approved active show list", () => {
    const result = retrieveV4Policies(resolveV3Turn("What is the current approved active show list?", []), 60);
    const diagnostic = result.candidates
      .filter((candidate) => /show|catalog|casting/i.test(`${candidate.policy.title} ${candidate.policy.decision_key}`))
      .map((candidate) => `${candidate.rank}:${candidate.policy.id}:${candidate.policy.decision_key}`)
      .join("\n");
    expect(result.candidates.map((candidate) => candidate.policy.decision_key), diagnostic).toContain("current-show-source-latest-approved-show-list-1");
    expect(result.blocked.map((candidate) => candidate.topic.id)).not.toContain("blocked_a64c7c206c741940");
  });

  it("does not treat current DJ offers as the cohort-deadline or crossover-discount decision", () => {
    const result = retrieveV4Policies(resolveV3Turn("What are the current Daymond John / NLCEO offers and listed payment options?", []), 30);
    expect(result.candidates.map((candidate) => candidate.policy.id)).toContain("owner-dj-nlceo-current-offer-overview");
    expect(result.blocked.map((candidate) => candidate.topic.id)).not.toEqual(expect.arrayContaining([
      "blocked_913ac98aba6b4bca",
      "blocked_67afbfba9c7cd399",
    ]));
  });

  it("still matches a blocker when scope, action, and the specific decision object agree", () => {
    const topic = getV4BlockedTopics().find((candidate) => candidate.id === "blocked_67afbfba9c7cd399");
    expect(topic).toBeDefined();
    const match = v4BlockedTopicDecisionMatch(
      topic!,
      "Can a Daymond John prospect get a two-show crossover package with America's Best Doctors at a discount?",
      { productScope: "comparison" },
    );
    expect(match.matches, match.reason).toBe(true);
    expect(match.matchedActions).toContain("price");
    expect(match.matchedSubjects.length).toBeGreaterThan(0);
  });

  it("does not let a cross-product discount conflict suppress the ordinary 20% process", () => {
    const result = retrieveV4Policies(resolveV3Turn("When can I offer the 20% discount, and what process do I need to follow?", []), 40);
    expect(result.blocked.map((candidate) => candidate.topic.id)).not.toContain("blocked_67afbfba9c7cd399");
  });

  it("does not treat contract review as a request for revised contract terms", () => {
    const result = retrieveV4Policies(resolveV3Turn("Can I send the license contract to their legal team to review before Call 2?", []), 40);
    expect(result.blocked.map((candidate) => candidate.topic.id)).not.toContain("blocked_2b3b76627b5986e5");
    expect(result.blocked.map((candidate) => candidate.topic.id)).not.toContain("blocked_c709bc9eb8678e91");
    expect(result.candidates.map((candidate) => candidate.policy.id)).toContain("claim_6b3311cee0cd4b18__a2");
  });

  it("compares complete numeric amounts instead of matching the generic 000 suffix", () => {
    const result = retrieveV4Policies(resolveV3Turn("Fact-check this email: the $15,000 package guarantees Amazon visibility.", []), 40);
    expect(result.blocked.map((candidate) => candidate.topic.id)).not.toContain("blocked_124fa40092e59cc3");
  });

  it("does not treat VIP package rank as an NLCEO-to-ISTV crossover question", () => {
    const result = retrieveV4Policies(resolveV3Turn("For main ISTV, is the VIP license the highest package?", []), 40);
    expect(result.blocked.map((candidate) => candidate.topic.id)).not.toContain("blocked_a831b31bb88c5f4b");
  });

  it("prioritizes the canonical cards for the two audited named-guidance requests", () => {
    expect(topIds("What is the approved guidance for Call 1 Flow?")).toContain("claim_33cdaf41e66bed31__a1");
    expect(topIds("What is the approved guidance for Post-Sale Handoff After Close?")).toContain("claim_f7b4aee82f52ce49");
  });
});
