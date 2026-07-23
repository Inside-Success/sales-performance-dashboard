import { describe, expect, it } from "vitest";
import { runAskSalesFaqV4 } from "@/lib/ask-sales-faq/v4/runtime";
import type { AskSalesFaqChatMessage } from "@/lib/ask-sales-faq/types";
import type { AskSalesFaqV4Result } from "@/lib/ask-sales-faq/v4/types";
import type { V3Provider } from "@/lib/ask-sales-faq/v3/types";

const unavailableProvider: V3Provider = async () => {
  throw new Error("No model credential is configured in this isolated deterministic test");
};

function run(question: string, history: AskSalesFaqChatMessage[] = []) {
  return runAskSalesFaqV4(question, history, {
    provider: unavailableProvider,
    validatorProvider: unavailableProvider,
  });
}

function expectGoverned(result: AskSalesFaqV4Result) {
  expect(result.runtimeMetadata.executionMode.planning).toBe("deterministic_governed");
  expect(result.runtimeMetadata.executionMode.composition).toBe("exact_evidence");
  expect(result.runtimeMetadata.executionMode.validation).toBe("deterministic_exact_evidence");
  expect(result.provider).toBeNull();
}

describe("Ask Sales V4 post-launch retained-set regressions", () => {
  it("does not invent an employee-count rule for the unresolved Operation CEO veteran-partner case", async () => {
    const result = await run(
      "Should a non-veteran be auditioning for Operation CEO if their business partner is a veteran and they have five employees?",
    );

    expect(result.lane, JSON.stringify(result.runtimeMetadata.plan)).toBe("route");
    expect(result.answer).toContain("#sales-questions-requests");
    expect(result.answer).not.toMatch(/no (?:minimum|specific) employee|employee count does not|five employees does not/i);
    expect(result.selectedPolicyIds).not.toContain("claim_6e636dc287b976f5");
  });

  it("explains the reuse-license purpose and routes only declined-license rights", async () => {
    const result = await run(
      "Why is there a commercial reuse license? If a cast member declines the reuse license, does being greenlit mean we can use their segment but they cannot reuse the content?",
    );

    expect(result.lane, JSON.stringify(result.runtimeMetadata.plan)).toBe("partial");
    expect(result.answer).toMatch(/covers reuse of content produced by the company|time, energy, and deliverables/i);
    expect(result.answer).toContain("#sales-questions-requests");
    expect(result.selectedPolicyIds).toEqual(expect.arrayContaining(["claim_74f78173844719e2", "claim_b3d565ada1ff6fd8"]));
    expectGoverned(result);
  });

  it("answers the public viewing path without inventing a current nonprofit episode", async () => {
    const result = await run(
      "Do we have a live episode on the network featuring someone who owns or runs a charity or nonprofit that I can send to a potential cast member?",
    );

    expect(result.lane, JSON.stringify(result.runtimeMetadata.plan)).toBe("partial");
    expect(result.answer).toMatch(/Live episodes can be viewed on the website\/app platforms/i);
    expect(result.answer).toMatch(/currently live episode matching the requested guest category/i);
    expect(result.answer).toContain("#sales-questions-requests");
    expect(result.answer).not.toMatch(/implies (?:that )?such episodes exist/i);
    expect(result.selectedPolicyIds).toEqual(["claim_70baa6ddc112bd58"]);
    expectGoverned(result);
  });

  it("answers the Zoom Phone payment-link channel without a duplicate route", async () => {
    const result = await run(
      "Are we allowed to send the payment link through a Zoom Phone message if the lead had to leave Call 2 and wants to complete payment afterward?",
    );

    expect(result.lane, JSON.stringify(result.runtimeMetadata.plan)).toBe("answer");
    expect(result.needsRoute).toBe(false);
    expect(result.answer).toMatch(/email, not through a Zoom Phone message/i);
    expect(result.answer).not.toContain("#sales-");
    expect(result.selectedPolicyIds).toEqual(["owner-zoom-phone-payment-link-email-only"]);
    expectGoverned(result);
  });

  it("answers the full Fathom plus Zoom setup without routing a backup sub-clause", async () => {
    const result = await run(
      "Am I allowed to use Fathom and Zoom recording at the same time, using Zoom as the backup and Fathom for transcripts, summaries, coaching feedback, action items, and call review?",
    );

    expect(result.lane, JSON.stringify(result.runtimeMetadata.plan)).toBe("answer");
    expect(result.needsRoute).toBe(false);
    expect(result.answer).toMatch(/Do not use Fathom together with the required Zoom recording/i);
    expect(result.answer).not.toContain("#sales-");
    expect(result.selectedPolicyIds).toEqual(["owner-fathom-zoom-recording-prohibited"]);
    expectGoverned(result);
  });

  it("answers the cross-show waiting rule without routing the apply-now paraphrase", async () => {
    const result = await run(
      "A lead originally applied for Legacy Makers but canceled Call 2 because they could not make the investment. They are now asking about America’s Authors. Since it is a different show, must they wait three to six months, or can they apply now?",
    );

    expect(result.lane, JSON.stringify(result.runtimeMetadata.plan)).toBe("answer");
    expect(result.needsRoute).toBe(false);
    expect(result.answer).toMatch(/wait three months before reapplying/i);
    expect(result.answer).not.toContain("#sales-");
    expect(result.selectedPolicyIds).toEqual(["owner-main-istv-cross-show-reapply-wait"]);
    expectGoverned(result);
  });

  it("does not confuse one client's missing show name with the maintained show catalog", async () => {
    const result = await run(
      "Where can I find a client’s show name if it is missing from their Keap profile and is no longer on my calendar?",
    );

    expect(result.lane, JSON.stringify(result.runtimeMetadata.plan)).toBe("answer");
    expect(result.needsRoute).toBe(false);
    expect(result.answer).toMatch(/Keap profile.*ask which show|show name is missing/i);
    expect(result.answer).not.toMatch(/maintained active-show source|#sales-questions-requests/i);
    expect(result.selectedPolicyIds).toEqual(["owner-keap-missing-show-name-recovery"]);
    expectGoverned(result);
  });

  it("keeps the safe Tier-1 boundary while routing only platform selection authority", async () => {
    const result = await run("Can a cast member choose which Tier 1 streaming platform their show will be submitted to?");

    expect(result.lane, JSON.stringify(result.runtimeMetadata.plan)).toBe("partial");
    expect(result.answer).toMatch(/submission to one Tier-1 streaming platform/i);
    expect(result.answer).toMatch(/placement is not guaranteed/i);
    expect(result.answer).toContain("#sales-questions-requests");
    expect(result.selectedPolicyIds).toEqual(["owner-vip-tier-one-platform-boundary"]);
    expectGoverned(result);
  });

  it("routes the owner-dependent part of an individualized future-launch greenlight", async () => {
    const result = await run(
      "Can a Next Level CEO applicant be greenlit if the business officially launches in three months but they already have a website, a strong story, and the ability to invest?",
    );

    expect(result.lane, JSON.stringify(result.runtimeMetadata.plan)).toBe("partial");
    expect(result.answer).toMatch(/early-stage businesses are not automatic DQ/i);
    expect(result.answer).toContain("#sales-questions-requests");
    expect(result.needsRoute).toBe(true);
    expect(result.routeChannels).toEqual(["#sales-questions-requests"]);
    expectGoverned(result);
  });

  it("keeps podcast guidance scoped to podcast facts", async () => {
    const result = await run(
      "Are the podcast questions designed for lead generation? What is the podcast episode structure, and how is it intelligently designed?",
    );

    expect(result.lane, JSON.stringify(result.runtimeMetadata.plan)).toBe("answer");
    expect(result.answer).toMatch(/exposure, authority, credibility/i);
    expect(result.answer).toMatch(/recorded live in the studio/i);
    expect(result.answer).not.toMatch(/documentary|Hollywood-documentary/i);
    expectGoverned(result);
  });

  it("answers both existing-client cross-show needs without suppressing proceed", async () => {
    const result = await run(
      "If someone is already an ISTV customer but applies for a different ISTV show, should I proceed with the new application or skip the call?",
    );

    expect(result.lane, JSON.stringify(result.runtimeMetadata.plan)).toBe("answer");
    expect(result.needsRoute).toBe(false);
    expect(result.answer).toMatch(/may (?:purchase|apply|proceed)|do not automatically skip/i);
    expect(result.answer).toMatch(/Keap scheduled appointments|original assignment/i);
    expect(result.answer).not.toContain("#sales-");
    expect(result.selectedPolicyIds).toEqual(["claim_606e9d59e3cd964f"]);
    expectGoverned(result);
  });

  it("answers both studio-tour and guest-limit needs despite broad filming terminology", async () => {
    const result = await run(
      "Can a prospect’s friends tour the studio before the shoot, and how many guests may attend filming?",
    );

    expect(result.lane, JSON.stringify(result.runtimeMetadata.plan)).toBe("answer");
    expect(result.needsRoute).toBe(false);
    expect(result.answer).toMatch(/not receive an in-person studio tour|should not receive an in-person studio tour/i);
    expect(result.answer).toMatch(/up to three guests/i);
    expect(result.answer).not.toContain("#sales-");
    expect(result.runtimeMetadata.retrieval.blockedTopicIds).not.toEqual(expect.arrayContaining([
      "blocked_6dc994230a3978d4",
      "blocked_db1d02a35bb6dd88",
      "blocked_2bcda4f6f7563510",
      "blocked_3087001020998efa",
    ]));
    expect(result.selectedPolicyIds).toEqual(["claim_4d14d445a904a4af"]);
    expectGoverned(result);
  });

  it("renders normalized freelancer and calendar guidance without source-dialogue fragments", async () => {
    const freelancer = await run("Should freelancers move to Call 2, or do they need an established business to qualify?");
    const calendar = await run(
      "If my public calendar only allows bookings within two days but an outbound lead is available next week, what is the correct booking process?",
    );

    expect(freelancer.lane, JSON.stringify(freelancer.runtimeMetadata.plan)).toBe("answer");
    expect(freelancer.answer).toMatch(/^Freelancing by itself should not be treated as entrepreneurship/i);
    expect(freelancer.answer).not.toMatch(/^That\b/i);
    expect(calendar.lane, JSON.stringify(calendar.runtimeMetadata.plan)).toBe("answer");
    expect(calendar.answer).toMatch(/Use Google Calendar when OnceHub cannot provide the needed outbound-call time/i);
    expect(calendar.answer).not.toMatch(/^Yes\b/i);
    expectGoverned(freelancer);
    expectGoverned(calendar);
  });

  it("preserves the NLCEO social-media promise boundary while routing the exact asset list", async () => {
    const result = await run(
      "What social promotional assets are included in the $10,000 Next Level CEO package, and what should I avoid promising?",
    );

    expect(result.lane, JSON.stringify(result.runtimeMetadata.plan)).toBe("partial");
    expect(result.answer).toMatch(/not a social-media package/i);
    expect(result.answer).toMatch(/should not turn the call into a promise of ongoing social-media management/i);
    expect(result.answer).toContain("#sales-questions-requests");
    expect(result.selectedPolicyIds).toEqual(["claim_3a43cb9eed71cb37"]);
    expectGoverned(result);
  });

  it("renders unresolved route questions without auxiliary-verb fragments", async () => {
    const result = await run(
      "I have a Call 1 for Operation CEO, and the applicant has two different businesses. Should they choose one business to focus on, or can they mention both during the episode?",
    );

    expect(result.lane).toBe("route");
    expect(result.answer).toMatch(/^Check #sales-questions-requests before replying\. Unresolved:/i);
    expect(result.answer).not.toMatch(/confirm (?:decide|determine|should|does|do|is|are)\b/i);
  });
});

describe("Ask Sales V4 follow-up rendering regressions", () => {
  it("preserves broad topic-intro categories instead of narrowing them to production", async () => {
    const result = await run("Last section—I have questions about proof, production, support, platforms, and events.");

    expect(result.lane).toBe("conversation");
    expect(result.answer).toMatch(/proof and support/i);
    expect(result.answer).toMatch(/platforms/i);
    expect(result.answer).toMatch(/events/i);
  });

  it("actually simplifies the immediately prior nonprofit answer", async () => {
    const history: AskSalesFaqChatMessage[] = [
      { role: "user", content: "For Operation CEO, must the applicant own an LLC, or can the owner of a nonprofit qualify?" },
      { role: "assistant", content: "Nonprofit status by itself is not a disqualifier for Operation CEO. A nonprofit can qualify for Operation CEO." },
    ];
    const result = await run("Can you explain that in simpler language?", history);

    expect(result.lane).toBe("conversation");
    expect(result.answer).toMatch(/^Yes\. A nonprofit can qualify for Operation CEO\.$/i);
    expect(result.answer.match(/qualify for Operation CEO/gi)).toHaveLength(1);
  });

  it("removes a route instruction while preserving the unconfirmed turnaround boundary", async () => {
    const history: AskSalesFaqChatMessage[] = [
      { role: "user", content: "Is the $5,000 CEO Day upgrade available for Next Level CEO, and what payment and turnaround terms apply?" },
      { role: "assistant", content: "The CEO Day upgrade is available for Next Level CEO. The CEO Day upgrade costs $5,000. The CEO Day upgrade requires payment in full only. Please check #sales-questions-requests to confirm what turnaround terms apply to the $5,000 CEO Day upgrade for Next Level CEO before replying." },
    ];
    const result = await run("That’s helpful. Can you give me the answer without repeating the route note?", history);

    expect(result.lane).toBe("conversation");
    expect(result.answer).toMatch(/No approved turnaround terms are confirmed/i);
    expect(result.answer).not.toContain("#sales-");
  });

  it("shortens a route-only prior answer instead of returning the same sentence", async () => {
    const previous = "Please check #sales-questions-requests to confirm is the Mastermind only once a year; and are there other in-person training and networking programs throughout the year, or just the one event before replying.";
    const history: AskSalesFaqChatMessage[] = [
      { role: "user", content: "Is the Mastermind only once a year, and are there other in-person programs?" },
      { role: "assistant", content: previous },
    ];
    const result = await run("Thanks—can you make that last answer shorter?", history);

    expect(result.lane).toBe("conversation");
    expect(result.answer).toBe("Mastermind frequency and other in-person programs: check #sales-questions-requests.");
    expect(result.answer.length).toBeLessThan(previous.length);
  });

  it("turns a controlled-resource response into a genuinely short checklist", async () => {
    const previous = "Request the current controlled resource or file for the document that explains the complete production process, including pre-production, filming, post-production, and expected scheduling timelines from #sales-questions-requests.";
    const history: AskSalesFaqChatMessage[] = [
      { role: "user", content: "Where is the complete production process document?" },
      { role: "assistant", content: previous },
    ];
    const result = await run("Please turn your previous answer into a short checklist.", history);

    expect(result.lane).toBe("conversation");
    expect(result.answer).toMatch(/^• Get the complete production-process document from #sales-questions-requests\.$/i);
    expect(result.answer.length).toBeLessThan(previous.length);
  });

  it("asks for the complete minimum non-sensitive third-party payment facts", async () => {
    const history: AskSalesFaqChatMessage[] = [
      { role: "user", content: "If a business partner who is not in Keap pays on behalf of the cast member, how should I confirm the payment and get the contract signed if it does not populate automatically?" },
      { role: "assistant", content: "The partner may pay, but payment matching and missing-contract recovery require the current owners." },
    ];
    const result = await run("I’m not sure which show this applies to. What information do you need from me?", history);

    expect(result.lane).toBe("conversation");
    expect(result.answer).toMatch(/product or show/i);
    expect(result.answer).toMatch(/package and payment option/i);
    expect(result.answer).toMatch(/payer’s relationship/i);
    expect(result.answer).toMatch(/where the payment appears/i);
    expect(result.answer).toMatch(/contract status/i);
    expect(result.answer).toMatch(/Do not send bank details, card numbers, login credentials/i);
  });

  it("acknowledges a rep-versus-prospect perspective correction explicitly", async () => {
    const history: AskSalesFaqChatMessage[] = [
      { role: "user", content: "What should I do if a prospect starts taking photos of the Call 1 presentation slides during the call?" },
      { role: "assistant", content: "Ask the prospect to stop taking photos. Explain that the slides are confidential. Ask them to delete any photos already taken." },
    ];
    const result = await run("You misunderstood me—I’m asking what the rep should do, not what the prospect should do.", history);

    expect(result.lane).toBe("conversation");
    expect(result.answer).toMatch(/^Those are the rep’s actions:/i);
    expect(result.answer).toMatch(/ask the prospect to stop/i);
  });

  it("does not relabel an arbitrary prospect obligation as the rep's action", async () => {
    const history: AskSalesFaqChatMessage[] = [
      { role: "user", content: "What does the prospect need to submit?" },
      { role: "assistant", content: "The prospect must submit the signed form." },
    ];
    const result = await run("You misunderstood me—I’m asking what the rep should do, not what the prospect should do.", history);

    expect(result.answer).not.toMatch(/^Those are the rep’s actions:/i);
    expect(result.answer).not.toMatch(/rep’s actions: the prospect must submit/i);
  });
});
