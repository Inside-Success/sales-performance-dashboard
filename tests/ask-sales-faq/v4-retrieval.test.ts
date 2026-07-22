import { describe, expect, it } from "vitest";
import { getMaterializedV3Registry } from "@/lib/ask-sales-faq/v3/admin-approved-releases";
import { resolveV3Turn } from "@/lib/ask-sales-faq/v3/turn-resolver";
import { retrieveV4Policies } from "@/lib/ask-sales-faq/v4/retrieval";
import { getV4BlockedTopics, getV4Corpus, getV4MainShowNames, getV4RouteCatalog } from "@/lib/ask-sales-faq/v4/corpus";
import { v4BlockedTopicDecisionMatch } from "@/lib/ask-sales-faq/v4/boundaries";
import { resolveV4Turn } from "@/lib/ask-sales-faq/v4/turn";

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

  it("reserves the exact franchise-owner eligibility evidence", () => {
    const result = retrieveV4Policies(resolveV3Turn("Is a franchise owner eligible for Next Level CEO?", []), 32);
    expect(result.candidates.map((candidate) => candidate.policy.id)).toContain("claim_c068cf9ac8f5d089");
  });

  it("reserves the governing existing-customer cross-show policy", () => {
    const result = retrieveV4Policies(resolveV3Turn("If someone is already an ISTV customer but applies for a different ISTV show, should I proceed with the new application or skip the call?", []), 32);
    expect(result.candidates.map((candidate) => candidate.policy.id)).toContain("claim_606e9d59e3cd964f");
  });

  it("adds the fulfillment destination only to the isolated V4 route overlay", () => {
    expect(getV4RouteCatalog().fulfillment).toEqual(expect.objectContaining({ channel: "the fulfillment hotline" }));
    expect(getMaterializedV3Registry().route_catalog.fulfillment).toBeUndefined();
  });

  it("parses only active show names from the governed catalog section", () => {
    const names = getV4MainShowNames();
    expect(names).toContain("Operation CEO");
    expect(names).toContain("Internet Masters TV");
    expect(names).not.toContain("Americas Top Trainers");
    expect(names).not.toContain("Live Longer");
    expect(names.some((name) => /approved ISTV|list membership|inactive/i.test(name))).toBe(false);
  });

  it("retrieves the complete main ISTV price and payment-plan card for a basic pricing question", () => {
    const result = retrieveV4Policies(resolveV3Turn("What are the current main ISTV prices and payment plans?", []), 60);
    const diagnostic = result.candidates.map((candidate) => `${candidate.rank}:${candidate.policy.id}:${candidate.policy.title}`).join("\n");
    expect(result.candidates.slice(0, 20).map((candidate) => candidate.policy.id), diagnostic).toContain("claim_c9e50172a4cd057b");
  });

  it("retrieves the negative show-watchability boundary instead of relying only on the catalog", () => {
    expect(topIds("Is Mompreneurs currently on air and where can the prospect watch an episode?")).toContain("owner-current-show-list-watchability-boundary");
  });

  it("reserves both exact governed families for a compound Tier-1 and app-device request", () => {
    const result = retrieveV4Policies(resolveV3Turn("For main ISTV, what does VIP cover and which devices support the app?", []), 32);
    const ids = result.candidates.map((candidate) => candidate.policy.id);
    expect(ids, result.candidates.map((candidate) => `${candidate.rank}:${candidate.policy.id}`).join("\n")).toEqual(expect.arrayContaining([
      "owner-vip-tier-one-platform-boundary",
      "owner-istv-app-download-devices",
    ]));
  });

  it("keeps product scope exclusions hard", () => {
    const turn = resolveV3Turn("For main ISTV, not Daymond John, what are the Standard payment options?", []);
    const result = retrieveV4Policies(turn, 30);
    expect(result.candidates.some((candidate) => candidate.policy.product_scopes.includes("dj_nlceo"))).toBe(false);
  });

  it.each([
    "Moving from Daymond John to Inside Success TV: offers?",
    "Moving from Daymond John to Inside Success TV: prices?",
    "Switching from Daymond John to main ISTV: payments?",
  ])("reserves main ISTV pricing evidence for a terse directional switch: %s", (question) => {
    const turn = resolveV4Turn(question, []);
    const ids = retrieveV4Policies(turn, 60).candidates.map((candidate) => candidate.policy.id);
    expect(ids).toEqual(expect.arrayContaining(["claim_c9e50172a4cd057b", "claim_28235f97538aac88"]));
  });

  it("keeps the V4-only scoped pricing slices out of the production registry", () => {
    expect(getV4Corpus().find((policy) => policy.id === "claim_c9e50172a4cd057b")?.product_scopes).toEqual(["main_istv"]);
    expect(getMaterializedV3Registry().policies.find((policy) => policy.id === "claim_c9e50172a4cd057b")?.product_scopes).toEqual(["main_istv", "dj_nlceo"]);
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

  it("does not bind unrelated production blockers to the studio-tour guest-limit question", () => {
    const result = retrieveV4Policies(resolveV4Turn("Can a prospect's friends tour the studio before the shoot, and how many guests may attend filming?", []), 60);
    expect(result.blocked.map((candidate) => candidate.topic.id)).not.toEqual(expect.arrayContaining([
      "blocked_6dc994230a3978d4",
      "blocked_db1d02a35bb6dd88",
      "blocked_2bcda4f6f7563510",
      "blocked_3087001020998efa",
    ]));
  });

  it("binds the Operation CEO non-veteran and veteran-partner qualification edge case", () => {
    const question = "Should a non-veteran be auditioning for Operation CEO if their business partner is a veteran and they have five employees?";
    const result = retrieveV4Policies(resolveV4Turn(question, []), 60);
    expect(result.blocked.find((candidate) => candidate.topic.id === "blocked_65d2e70d14703b7e")).toEqual(
      expect.objectContaining({ matchKind: "legacy_anchor" }),
    );
  });

  it("does not bind the veteran-partner anchor when the partner condition is negated", () => {
    const topic = getV4BlockedTopics().find((candidate) => candidate.id === "blocked_65d2e70d14703b7e");
    expect(topic).toBeDefined();
    const match = v4BlockedTopicDecisionMatch(
      topic!,
      "Should a non-veteran audition for Operation CEO when their business partner is not a veteran?",
    );
    expect(match.matches, JSON.stringify(match)).toBe(false);
  });

  it("requires exact legacy subjects for conflict, 20-percent notes, and calendar blockers", () => {
    const cases = [
      ["blocked_0b56158b1d22eb99", "Can I send a live nonprofit episode to a potential cast member?", "Is joining 60 Day Hustle a casting conflict?"],
      ["blocked_6d6852cffbebeb4e", "My previous question was about main ISTV.", "Is prior involvement with a company speaking promotion a casting conflict?"],
      ["blocked_1350b414e9d4ba38", "What email and text wording should I use for a 20% lead?", "For 20% post-call notes, should reps report in the spreadsheet, Keap, or both?"],
      ["blocked_6522ba21e9d254b6", "The client's show name is no longer on my calendar.", "Which calendar should reps use for bookings and rebookings?"],
    ] as const;

    for (const [id, unrelated, exactSubject] of cases) {
      const topic = getV4BlockedTopics().find((candidate) => candidate.id === id);
      expect(topic).toBeDefined();
      expect(v4BlockedTopicDecisionMatch(topic!, unrelated).matches, `${id} false positive`).toBe(false);
      expect(v4BlockedTopicDecisionMatch(topic!, exactSubject).matches, `${id} exact subject`).toBe(true);
    }
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

  it("self-binds every canonical open-blocker question family", () => {
    const failures = getV4BlockedTopics().flatMap((topic) => (topic.question_families || []).flatMap((question) => {
      const match = v4BlockedTopicDecisionMatch(topic, question);
      return match.matches && match.matchKind === "canonical_family"
        ? []
        : [`${topic.id}: ${question}: ${match.matchKind}: ${match.reason}`];
    }));
    expect(failures).toEqual([]);
  });

  it("keeps canonical open-blocker families collision-free after normalization", () => {
    const normalizedFamilies = getV4BlockedTopics().flatMap((topic) => (topic.question_families || []).map((question) => ({
      topicId: topic.id,
      normalized: question.toLowerCase()
        .replace(/call\s*1\b/g, "call1")
        .replace(/call\s*2\b/g, "call2")
        .replace(/(\d+(?:\.\d+)?)\s*%/g, "$1percent")
        .replace(/[^a-z0-9]+/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
    })));
    const collisions = normalizedFamilies.filter((family, index) =>
      normalizedFamilies.some((other, otherIndex) => otherIndex !== index && other.normalized === family.normalized && other.topicId !== family.topicId),
    );
    expect(normalizedFamilies).toHaveLength(72);
    expect(collisions).toEqual([]);
  });

  it.each([
    { id: "bankruptcy-qualification", question: "Does bankruptcy disqualify an applicant from Call 2?" },
    { id: "dual-product-opportunity-ownership", question: "Who owns the opportunity when a prospect is considering both main ISTV and Daymond John?" },
    { id: "accessibility-accommodations", question: "Can we promise audio-description accessibility accommodations?" },
  ])("binds the explicit probe for a legacy questionless blocker: $id", ({ id, question }) => {
    const topic = getV4BlockedTopics().find((candidate) => candidate.id === id);
    expect(topic).toBeDefined();
    expect(v4BlockedTopicDecisionMatch(topic!, question)).toEqual(expect.objectContaining({ matches: true, matchKind: "legacy_anchor" }));
  });

  it("keeps the reviewed legacy questionless set explicit", () => {
    expect(getV4BlockedTopics().filter((topic) => !(topic.question_families || []).length).map((topic) => topic.id).sort()).toEqual([
      "accessibility-accommodations",
      "bankruptcy-qualification",
      "dual-product-opportunity-ownership",
    ]);
  });

  it("uses the narrow Call 1 minimum-investment legacy anchor", () => {
    const topic = getV4BlockedTopics().find((candidate) => candidate.id === "blocked_5bd0a1e1f41418c9");
    expect(topic).toBeDefined();
    expect(v4BlockedTopicDecisionMatch(topic!, "Can reps mention the minimum investment on Call 1 when vetting a prospect?")).toEqual(
      expect.objectContaining({ matches: true, matchKind: "legacy_anchor" }),
    );
  });

  it.each([
    { question: "The applicant works for a bankruptcy law firm. Can they qualify?", excluded: ["bankruptcy-qualification"] },
    { question: "The applicant is not bankrupt. Can they qualify?", excluded: ["bankruptcy-qualification"] },
    { question: "How should I qualify this applicant without using bankruptcy as a factor?", excluded: ["bankruptcy-qualification"] },
    { question: "Does the app support closed captions?", excluded: ["accessibility-accommodations"] },
    { question: "I am not asking for audio descriptions; which devices support the app?", excluded: ["accessibility-accommodations"] },
    { question: "Can I send the ordinary media pack?", excluded: ["accessibility-accommodations"] },
    { question: "What are the main ISTV and Daymond John prices?", excluded: ["dual-product-opportunity-ownership"] },
    { question: "For Top Lawyers only, which rep handles this applicant?", excluded: ["dual-product-opportunity-ownership"] },
  ])("does not broaden reviewed blocker anchors: $question", ({ question, excluded }) => {
    const result = retrieveV4Policies(resolveV4Turn(question, []), 60);
    expect(result.blocked.map((candidate) => candidate.topic.id)).not.toEqual(expect.arrayContaining(excluded));
  });

  it.each([
    { id: "blocked_5bd0a1e1f41418c9", question: "Can reps mention the minimum investment on Call 1 when vetting a prospect?" },
    { id: "blocked_a64c7c206c741940", question: "Which shows are paused or still casting?" },
  ])("retrieves a known exact open conflict before answer planning: $id", ({ id, question }) => {
    const result = retrieveV4Policies(resolveV3Turn(question, []), 60);
    expect(result.blocked.map((candidate) => candidate.topic.id)).toContain(id);
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

  it("does not let a shared package amount suppress an ordinary Lite price question", () => {
    const result = retrieveV4Policies(resolveV3Turn("Can I tell a Lite prospect the $3,000 price?", []), 40);
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

  it("reserves the exact freelancer qualification policy", () => {
    expect(topIds("Should freelancers move to Call 2, or do they need an established business to qualify?")).toContain("claim_59be9c344b9359a4");
  });

  it("reserves both governed public-calendar fallback policies", () => {
    const ids = topIds("If my public calendar only allows bookings within two days but an outbound lead is available next week, what is the correct booking process?");
    expect(ids).toEqual(expect.arrayContaining(["claim_d93982445e426907", "claim_5af708598311071c"]));
  });

  it("reserves the previously claimed 20 percent lead procedure", () => {
    expect(topIds("If a dial-out lead no-showed Call 1 with another rep, may I rebook it or should I contact the original rep?")).toContain("v3src_previously_claimed_twenty_percent_lead");
  });

  it.each([
    "Are we still running Kingdom Creators?",
    "Are we currently casting Mompreneurs?",
    "Is Operation CEO still offered?",
  ])("reserves the approved show catalog for a named active-show status question: %s", (question) => {
    expect(topIds(question)).toContain("kr_7ace400fcdf68db9");
  });

  it("uses the main ISTV price card for the distinctive promotional-view package question", () => {
    expect(topIds("Are the pre-promo views in the $20K package limited to Facebook?")).toContain("claim_c9e50172a4cd057b");
  });

  it("reserves both internal-material boundaries for a stats-slide screenshot request", () => {
    const ids = topIds("May I send a client a screenshot of the internal statistics slide with our social reach?");
    expect(ids).toEqual(expect.arrayContaining(["claim_49827b5abfa86d45", "claim_848ba0ca58988282__a2"]));
  });

  it.each([
    "The applicant is pre-launch. Should I still conduct Call 1, or are they disqualified?",
    "Can this business be greenlit if it officially launches in three months?",
  ])("reserves the early-stage decision for a future-launch qualification question: %s", (question) => {
    expect(topIds(question)).toContain("claim_aa93466af64a3cdd");
  });

  it.each([
    "What discount applies when a VIP client purchases a second VIP ISTV episode?",
    "Does a VIP client receive 50% on a second VIP episode?",
  ])("reserves the exact VIP-to-VIP repeat-episode discount decision: %s", (question) => {
    expect(topIds(question)).toContain("claim_313aa422c956e5c1");
  });

  it("reserves the governed scripting process, definition, and fulfillment route together", () => {
    const ids = topIds("Are clients still paired with a scriptwriter, and when will someone filming in August receive the script?");
    expect(ids).toEqual(expect.arrayContaining([
      "claim_5996647e28cf3b69",
      "claim_9829630199781d19",
      "owner-scriptwriter-scheduling-fulfillment-route",
    ]));
  });

  it("reserves event inclusion, onboarding ownership, and drifting-logistics boundaries together", () => {
    const ids = topIds("Should event access be explained during Call 2 sales or during onboarding after the sale?");
    expect(ids).toEqual(expect.arrayContaining([
      "claim_e35c3076026455e6",
      "claim_d33f7f1813b3f7a5",
      "claim_9e04ab861ce2702f",
    ]));
  });

  it("reserves the recording-and-disclosure rule for 20 percent outbound calls", () => {
    expect(topIds("For a 20% list dial-out, must I record the call and tell the prospect?")).toContain("owner-twenty-percent-recording-and-disclosure");
  });

  it("reserves both the approved-template and calendar-day timing decisions for 20 percent bookings", () => {
    const ids = topIds("Which email and SMS template should I use the night before a 20% list call?");
    expect(ids).toEqual(expect.arrayContaining(["claim_3585b16e8ef643a9", "v3src_confirmation_calendar_day_before"]));
  });

  it("does not bypass a hard product exclusion for the promotional-view fingerprint", () => {
    const turn = resolveV3Turn("For Daymond John, not main ISTV, are promotional views included in the $20K package?", []);
    const result = retrieveV4Policies(turn, 30);
    expect(result.candidates.map((candidate) => candidate.policy.id)).not.toContain("claim_c9e50172a4cd057b");
  });

  it("does not confuse the ordinary 20 percent discount with outbound-call recording", () => {
    const result = retrieveV4Policies(resolveV3Turn("When can I offer the 20% discount, and what approval do I need?", []), 12);
    expect(result.candidates.map((candidate) => candidate.policy.id)).not.toContain("owner-twenty-percent-recording-and-disclosure");
  });

  it("does not match a ticket-system blocker from pronouns and the word still", () => {
    const topic = getV4BlockedTopics().find((candidate) => candidate.id === "blocked_c0f6ed2628b0fae0");
    expect(topic).toBeDefined();
    const match = v4BlockedTopicDecisionMatch(topic!, "If a prospect already read the greenlight letter, do we still walk them through it on the call?");
    expect(match.matches, JSON.stringify(match)).toBe(false);
  });
});
