import { describe, expect, it } from "vitest";
import { getV4Corpus } from "@/lib/ask-sales-faq/v4/corpus";
import { runAskSalesFaqV4 } from "@/lib/ask-sales-faq/v4/runtime";
import type { AskSalesFaqV4Result } from "@/lib/ask-sales-faq/v4/types";
import type { V3Provider } from "@/lib/ask-sales-faq/v3/types";

const unavailableProvider: V3Provider = async () => {
  throw new Error("No model credential is configured in this isolated deterministic test");
};

async function runGoverned(question: string) {
  return runAskSalesFaqV4(question, [], {
    provider: unavailableProvider,
    validatorProvider: unavailableProvider,
  });
}

function expectDeterministicGoverned(result: AskSalesFaqV4Result) {
  expect(result.provider).toBeNull();
  expect(result.model).toBeNull();
  expect(result.runtimeMetadata.executionMode).toMatchObject({
    planning: "deterministic_governed",
    composition: "exact_evidence",
    validation: "deterministic_exact_evidence",
  });
}

function expectPolicies(result: AskSalesFaqV4Result, policyIds: string[]) {
  expect(result.selectedPolicyIds).toEqual(expect.arrayContaining(policyIds));
}

describe("Ask Sales V4 retained governed families", () => {
  it("materializes the repeat-episode claim without its source-question-dependent opening", () => {
    const policy = getV4Corpus().find((candidate) => candidate.id === "claim_313aa422c956e5c1");

    expect(policy).toMatchObject({
      id: "claim_313aa422c956e5c1",
      authority: 90,
      source: {
        kind: "trusted_slack_summary",
        ids: ["slack:#sales-questions-requests:1781811288.064259"],
        approved_by: ["Madeline Cary"],
      },
    });
    expect(policy?.decision).toContain("A VIP ISTV client buying another VIP ISTV episode is eligible for 50% off the second VIP episode.");
    expect(policy?.decision).toContain("A Lite license does not qualify for the 50% repeat-episode discount unless the client completes the qualifying VIP upgrade path.");
    expect(policy?.decision).not.toMatch(/Decision evidence:\s*No\b/i);
    expect(policy?.quality_flags).not.toContain("context_dependent_opening");
  });

  it("answers a VIP-to-VIP repeat purchase positively without injecting the Lite scenario", async () => {
    const result = await runGoverned(
      "What discount applies when a VIP ISTV client buys another VIP ISTV episode?",
    );

    expect(result.lane, JSON.stringify(result.runtimeMetadata.plan)).toBe("answer");
    expect(result.routeChannels).toEqual([]);
    expectPolicies(result, ["claim_313aa422c956e5c1"]);
    expect(result.answer).toMatch(/eligible for 50% off the second VIP episode/i);
    expect(result.answer).not.toMatch(/^No\b/i);
    expect(result.answer).not.toMatch(/\bLite\b/i);
    expectDeterministicGoverned(result);
  });

  it("applies the separate Lite predicate without reversing the VIP-to-VIP rule", async () => {
    const result = await runGoverned(
      "Does a main ISTV Lite license client get the 50% discount on another episode without upgrading?",
    );

    expect(result.lane, JSON.stringify(result.runtimeMetadata.plan)).toBe("answer");
    expect(result.routeChannels).toEqual([]);
    expectPolicies(result, ["claim_313aa422c956e5c1"]);
    expect(result.answer).toMatch(/Lite license does not qualify.*VIP upgrade path/i);
    expect(result.answer).not.toMatch(/Lite license.*eligible for 50%/i);
    expectDeterministicGoverned(result);
  });

  it("materializes the cross-show and studio boundaries without raw discourse fragments", () => {
    const corpus = getV4Corpus();
    const crossShow = corpus.find((candidate) => candidate.id === "claim_606e9d59e3cd964f");
    const studio = corpus.find((candidate) => candidate.id === "claim_4d14d445a904a4af");

    expect(crossShow).toMatchObject({
      authority: 90,
      source: {
        kind: "trusted_slack_summary",
        ids: ["slack:#sales-questions-requests:1779894992.644399"],
        approved_by: ["Madeline Cary"],
      },
    });
    expect(crossShow?.decision).toContain("An existing ISTV client may purchase another show; do not automatically skip the new application or call.");
    expect(crossShow?.decision).toContain("If the original rep is inactive, the current rep may take the opportunity.");
    expect(crossShow?.quality_flags).not.toContain("context_dependent_opening");

    expect(studio).toMatchObject({
      authority: 90,
      source: {
        kind: "trusted_slack_summary",
        ids: ["slack:#sales-questions-requests:1782942171.674249"],
        approved_by: ["Madeline Cary"],
      },
    });
    expect(studio?.decision).toContain("Prospects and their friends should not receive an in-person studio tour before signing or filming");
    expect(studio?.decision).toContain("A client may bring up to three guests into the studio for filming.");
    expect(studio?.quality_flags).not.toContain("context_dependent_opening");
  });

  it("answers the existing-client cross-show application and assignment boundary directly", async () => {
    const result = await runGoverned(
      "If someone is already an ISTV customer but applies for a different ISTV show, should I proceed with the new application or skip the call?",
    );

    expect(result.lane, JSON.stringify(result.runtimeMetadata.plan)).toBe("answer");
    expect(result.routeChannels).toEqual([]);
    expectPolicies(result, ["claim_606e9d59e3cd964f"]);
    expect(result.answer).toMatch(/may purchase another show.*do not automatically skip/i);
    expect(result.answer).toMatch(/Check Keap scheduled appointments.*original assignment/i);
    expect(result.answer).not.toMatch(/^Yes\b/i);
    expectDeterministicGoverned(result);
  });

  it("answers both the pre-shoot studio-tour boundary and filming guest limit", async () => {
    const result = await runGoverned(
      "Can a prospect's friends tour the studio before the shoot, and how many guests may attend filming?",
    );

    expect(result.lane, JSON.stringify(result.runtimeMetadata.plan)).toBe("answer");
    expect(result.routeChannels).toEqual([]);
    expectPolicies(result, ["claim_4d14d445a904a4af"]);
    expect(result.answer).toMatch(/should not receive an in-person studio tour.*virtual studio walkthrough/i);
    expect(result.answer).toMatch(/up to three guests/i);
    expect(result.answer).not.toMatch(/^That\b/i);
    expectDeterministicGoverned(result);
  });

  it("answers the 20 percent recording and disclosure requirements", async () => {
    const result = await runGoverned(
      "When dialing out on Zoom for the 20% list, do we have to record the calls? If so, do we have to tell prospects they are being recorded?",
    );

    expect(result.lane, JSON.stringify(result.runtimeMetadata.plan)).toBe("answer");
    expect(result.routeChannels, JSON.stringify(result.runtimeMetadata.plan)).toEqual([]);
    expectPolicies(result, ["owner-twenty-percent-recording-and-disclosure"]);
    expect(result.answer).toMatch(/record.*Zoom/i);
    expect(result.answer).toMatch(/tell the prospect|acknowledgment/i);
    expectDeterministicGoverned(result);
  });

  it("answers the NLCEO no-cohort boundary and routes only the template edit", async () => {
    const result = await runGoverned(
      "For Next Level CEO, our morning confirmation text says we cannot rebook because the cohort closes Sunday, but DJ has no cohort. Can I change that wording myself, or should I leave it unchanged until the team updates it?",
    );

    expect(result.lane, JSON.stringify(result.runtimeMetadata.plan)).toBe("partial");
    expect(result.routeChannels).toEqual(["#sales-questions-requests"]);
    expectPolicies(result, ["claim_bb04a794e0a74ea5__a4"]);
    expect(result.answer).toMatch(/do not apply.*cohort|no cohort/i);
    expect(result.answer).toContain("#sales-questions-requests");
    expectDeterministicGoverned(result);
  });

  it("keeps the internal statistics slide private and routes current public wording", async () => {
    const result = await runGoverned(
      "A potential cast member asked whether I can send the 2025 Inside Success statistics slide, including the social reach and combined following. Can I send a screenshot, or should I only reference the information in a message?",
    );

    expect(result.lane, JSON.stringify(result.runtimeMetadata.plan)).toBe("partial");
    expect(result.routeChannels).toEqual(["#sales-questions-requests"]);
    expectPolicies(result, ["claim_49827b5abfa86d45", "claim_848ba0ca58988282__a2"]);
    expect(result.answer).toMatch(/(?:deck|slide|screenshot).*(?:not|do not|should not).*(?:share|send)|(?:not|do not|should not).*(?:share|send).*(?:deck|slide|screenshot)/i);
    expect(result.answer).not.toMatch(/\bShe also said\b|^Not to email\b/i);
    expect(result.answer).toContain("#sales-questions-requests");
    expectDeterministicGoverned(result);
  });

  it("answers the governed podcast purpose and current format without promising leads", async () => {
    const result = await runGoverned(
      "Are the podcast questions designed for lead generation? What is the podcast episode structure, and how is it intelligently designed?",
    );

    expect(result.lane, JSON.stringify(result.runtimeMetadata.plan)).toBe("answer");
    expect(result.routeChannels).toEqual([]);
    expectPolicies(result, ["owner-podcast-purpose-and-current-format"]);
    expect(result.answer).toMatch(/do not promise.*generate leads/i);
    expect(result.answer).toMatch(/live in the studio|authority|credibility|story|trust|education/i);
    expectDeterministicGoverned(result);
  });

  it("answers the governed scripting process and routes exact delivery timing to fulfillment", async () => {
    const result = await runGoverned(
      "On the fulfillment side, are cast members still paired with a scriptwriter? If a cast member is filming in August, when will they receive the script?",
    );

    expect(result.lane, JSON.stringify(result.runtimeMetadata.plan)).toBe("partial");
    expect(result.routeChannels).toEqual(["the fulfillment hotline"]);
    expectPolicies(result, ["claim_5996647e28cf3b69", "claim_9829630199781d19"]);
    expect(result.answer).toMatch(/production.*script|scripting call/i);
    expect(result.answer).toContain("the fulfillment hotline");
    expectDeterministicGoverned(result);
  });

  it("answers the general early-stage Call 1 qualification question", async () => {
    const result = await runGoverned(
      "A lead says their website, social media, and company have not launched yet and they are in the very early stages. Should I still conduct Call 1 or tell them now that they are not a fit?",
    );

    expect(result.lane, JSON.stringify(result.runtimeMetadata.plan)).toBe("answer");
    expect(result.routeChannels).toEqual([]);
    expectPolicies(result, ["claim_aa93466af64a3cdd"]);
    expect(result.answer).toMatch(/not automatic(?:ally)? (?:DQ|disqualif)/i);
    expect(result.answer).toMatch(/social proof|active website|ability to invest/i);
    expectDeterministicGoverned(result);
  });

  it("answers the future-launch boundary but asks for the missing greenlight facts", async () => {
    const result = await runGoverned(
      "Can a Next Level CEO applicant be greenlit if the business officially launches in three months but they already have a website, a strong story, and the ability to invest?",
    );

    expect(result.lane, JSON.stringify(result.runtimeMetadata.plan)).toBe("partial");
    expect(result.routeChannels, JSON.stringify(result.runtimeMetadata.plan)).toEqual(["#sales-questions-requests"]);
    expect(result.needsRoute).toBe(true);
    expectPolicies(result, ["claim_aa93466af64a3cdd"]);
    expect(result.answer).toMatch(/not automatic(?:ally)? (?:DQ|disqualif)/i);
    expect(result.runtimeMetadata.plan.needs.some((need) => need.lane === "clarify")).toBe(true);
    expect(result.answer).toMatch(/clarify|confirm|what|which|complete qualification facts/i);
    expect(result.answer).toContain("#sales-questions-requests");
    expectDeterministicGoverned(result);
  });

  it("answers partner-payment eligibility and routes payment matching plus contract recovery", async () => {
    const result = await runGoverned(
      "If a business partner who is not in Keap pays on behalf of the cast member, how should I confirm the payment and get the contract signed if it does not populate automatically?",
    );

    expect(result.lane, JSON.stringify(result.runtimeMetadata.plan)).toBe("partial");
    expect(result.routeChannels).toHaveLength(2);
    expect(result.routeChannels).toEqual(expect.arrayContaining(["#sales-finance-requests", "#sales-tech-requests"]));
    expectPolicies(result, ["claim_51695e7c59d2608a"]);
    expect(result.answer).toMatch(/business owner or partner.*(?:make|payment)|payment.*correct client/i);
    expect(result.answer).not.toMatch(/\bPeer guidance said\b/i);
    expect(result.answer).toContain("#sales-finance-requests");
    expect(result.answer).toContain("#sales-tech-requests");
    expectDeterministicGoverned(result);
  });

  it("answers recurring client invoices, ledger tracking, and rep commission invoicing", async () => {
    const result = await runGoverned(
      "Do reps send invoices for recurring client payments, or is that automated? Should those payments appear in the sales ledger?",
    );

    expect(result.lane, JSON.stringify(result.runtimeMetadata.plan)).toBe("answer");
    expect(result.routeChannels).toEqual([]);
    expectPolicies(result, ["claim_754c01ed0089dc82"]);
    expect(result.answer).toMatch(/client invoices are automated/i);
    expect(result.answer).not.toMatch(/^That\b/i);
    expect(result.answer).toMatch(/appear in the ledger/i);
    expect(result.answer).toMatch(/invoice ISTV.*commission|commission.*approved commission process/i);
    expectDeterministicGoverned(result);
  });

  it("answers the VIP repeat discount and requests the current media-outlet asset", async () => {
    const result = await runGoverned(
      "What discount is currently available to a VIP client who purchases a second VIP ISTV episode, and where can I find the list of included media outlets?",
    );

    expect(result.lane, JSON.stringify(result.runtimeMetadata.plan)).toBe("partial");
    expect(result.routeChannels).toEqual(["#sales-questions-requests"]);
    expectPolicies(result, ["claim_313aa422c956e5c1"]);
    expect(result.answer).toMatch(/50%|50 percent/i);
    expect(result.answer).toMatch(/current controlled resource or file/i);
    expect(result.answer).toContain("#sales-questions-requests");
    expectDeterministicGoverned(result);
  });

  it("answers the disqualification wait and official tech opt-out process", async () => {
    const result = await runGoverned(
      "Can I cancel an audition for someone I recently disqualified who keeps applying again, and how should I stop repeat bookings?",
    );

    expect(result.lane, JSON.stringify(result.runtimeMetadata.plan)).toBe("answer");
    expect(result.routeChannels).toEqual([]);
    expectPolicies(result, ["claim_a5945bc4fd156d47", "claim_4c5932f5c97e68ed"]);
    expect(result.answer).toMatch(/90 days/i);
    expect(result.answer).not.toMatch(/\bhe cannot reapply\b/i);
    expect(result.answer).toMatch(/tech channel|unsubscribed|blocked|official opt-out/i);
    expectDeterministicGoverned(result);
  });

  it("answers the 20 percent template and day-before timing while requesting exact live copy", async () => {
    const result = await runGoverned(
      "What email and text wording should I use the night before and the morning of a call booked from the 20% list?",
    );

    expect(result.lane, JSON.stringify(result.runtimeMetadata.plan)).toBe("partial");
    expect(result.routeChannels).toEqual(["#sales-questions-requests"]);
    expectPolicies(result, ["claim_3585b16e8ef643a9", "v3src_confirmation_calendar_day_before"]);
    expect(result.answer).toMatch(/mandatory email\/SMS templates/i);
    expect(result.answer).toMatch(/calendar day before/i);
    expect(result.answer).toMatch(/current controlled resource or file/i);
    expectDeterministicGoverned(result);
  });

  it("answers 20 percent confirmation timing without routing when exact copy was not requested", async () => {
    const result = await runGoverned(
      "When should I send the confirmation email and text for a call booked from the 20% list?",
    );

    expect(result.lane, JSON.stringify(result.runtimeMetadata.plan)).toBe("answer");
    expect(result.routeChannels).toEqual([]);
    expectPolicies(result, ["claim_3585b16e8ef643a9", "v3src_confirmation_calendar_day_before"]);
    expect(result.answer).toMatch(/calendar day before/i);
    expect(result.runtimeMetadata.plan.needs.some((need) => need.lane === "artifact")).toBe(false);
    expectDeterministicGoverned(result);
  });

  it("answers the Call 2 versus onboarding event-access boundary", async () => {
    const result = await runGoverned(
      "Should details about event access be explained during Call 2 or during onboarding after the sale?",
    );

    expect(result.lane, JSON.stringify(result.runtimeMetadata.plan)).toBe("answer");
    expect(result.routeChannels).toEqual([]);
    expectPolicies(result, ["claim_e35c3076026455e6", "claim_d33f7f1813b3f7a5", "claim_9e04ab861ce2702f"]);
    expect(result.answer).toMatch(/included in all packages/i);
    expect(result.answer).toMatch(/onboarding|studio executive team/i);
    expect(result.answer).toMatch(/event dates|venue|logistics|travel|guest rules/i);
    expectDeterministicGoverned(result);
  });

  it("answers the event-access handoff while routing a requested current event date", async () => {
    const result = await runGoverned(
      "When is the next Mastermind, and should event access be explained during Call 2 or during onboarding after the sale?",
    );

    expect(result.lane, JSON.stringify(result.runtimeMetadata.plan)).toBe("partial");
    expect(result.routeChannels).toEqual(["#sales-questions-requests"]);
    expectPolicies(result, ["claim_e35c3076026455e6", "claim_d33f7f1813b3f7a5", "claim_9e04ab861ce2702f"]);
    expect(result.answer).toMatch(/onboarding|studio executive team/i);
    expect(result.runtimeMetadata.plan.needs).toEqual(expect.arrayContaining([
      expect.objectContaining({ lane: "route", text: expect.stringMatching(/current date|schedule/i) }),
    ]));
    expectDeterministicGoverned(result);
  });

  it("answers the uniquely identified $20K promo-view package and routes only the Facebook restriction", async () => {
    const result = await runGoverned("Are the promotional views included in the $20K package for Facebook only?");

    expect(result.lane, JSON.stringify(result.runtimeMetadata.plan)).toBe("partial");
    expectPolicies(result, ["claim_c9e50172a4cd057b"]);
    expect(result.answer).toMatch(/\$20,000.*100,000 pre-promo views|100,000 pre-promo views.*\$20,000/i);
    expect(result.answer).not.toMatch(/Main ISTV program:\s*Package|Lite;\s*\$12,000|VIP \/ Premium;\s*\$30,000/i);
    expect(result.answer).toContain("#sales-questions-requests");
    expect(result.runtimeMetadata.plan.needs).toEqual(expect.arrayContaining([
      expect.objectContaining({ lane: "route", text: expect.stringMatching(/social platform|Facebook|promotional views/i) }),
    ]));
    expectDeterministicGoverned(result);
  });
});
