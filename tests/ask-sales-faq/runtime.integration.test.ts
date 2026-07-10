import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runAskSalesFaq } from "@/lib/ask-sales-faq/runtime";
import type { AskSalesFaqChatMessage } from "@/lib/ask-sales-faq/types";

type ProviderPurpose =
  | "conversation planning"
  | "answer generation"
  | "rep-facing wording repair"
  | "critical answer repair"
  | "approved article answer validation";

type ProviderStep =
  | { kind: "output"; value: unknown }
  | { kind: "raw"; value: string }
  | { kind: "http_error"; message?: string; status?: number }
  | { kind: "throw"; error: Error };

type ProviderScript = Partial<Record<ProviderPurpose, ProviderStep[]>>;

type CapturedProviderCall = {
  purpose: ProviderPurpose;
  messages: Array<{ role?: string; content?: string }>;
};

const ENV_KEYS = [
  "DEEPSEEK_API_KEY",
  "ANTHROPIC_API_KEY",
  "FAQ_ALLOW_CLAUDE_FALLBACK",
  "FAQ_DEEPSEEK_DISABLE_THINKING",
  "FAQ_MODEL_TIMEOUT_SECONDS",
] as const;

const paymentQuestion =
  "Just got off a really good Call 2. They see the value but funds are unavailable until Aug 15th and the only thing preventing the close is their ability to find 2.5k. Can they continue later or do they have to start over?";

let originalEnv: Partial<Record<(typeof ENV_KEYS)[number], string>>;

beforeEach(() => {
  originalEnv = {};
  for (const key of ENV_KEYS) {
    if (process.env[key] !== undefined) originalEnv[key] = process.env[key];
  }

  process.env.DEEPSEEK_API_KEY = "ask-sales-faq-test-key";
  delete process.env.ANTHROPIC_API_KEY;
  process.env.FAQ_ALLOW_CLAUDE_FALLBACK = "false";
  process.env.FAQ_DEEPSEEK_DISABLE_THINKING = "true";
  process.env.FAQ_MODEL_TIMEOUT_SECONDS = "8";

  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();

  for (const key of ENV_KEYS) {
    const value = originalEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("runAskSalesFaq integration safety", () => {
  it("does not surface a wrong-product provider answer for an explicit main ISTV question", async () => {
    const wrongDjAnswer =
      "Next Level CEO / Daymond John Lite is $10,000 PIF, with a listed option of $2,500 x 4 and no cohort rule.";
    const repairedMainAnswer = "Main ISTV Lite is $12,000. Use only the listed main ISTV payment plans.";
    installProviderStub({
      "answer generation": [outputStep(modelOutput(wrongDjAnswer))],
      "critical answer repair": [outputStep(modelOutput(repairedMainAnswer))],
    });

    const result = await runAskSalesFaq("What are the current main ISTV prices and payment plans?");

    expect(result.answer).not.toBe(wrongDjAnswer);
    expect(result.answer).not.toMatch(/\$2,500\s*x\s*4|no cohort rule/i);
  });

  it("sends only the selected approved policy unit to answer generation", async () => {
    const answer = "Main ISTV Lite is $12,000, Standard is $20,000, and VIP/Premium is $30,000.";
    const provider = installProviderStub({
      "answer generation": [outputStep(modelOutput(answer))],
    });

    const result = await runAskSalesFaq("What are the current main ISTV package prices?");
    const generationCall = provider.calls.find((call) => call.purpose === "answer generation");
    const prompt = generationCall ? providerPrompt(generationCall) : "";

    expect(prompt).toContain("Policy unit: Main ISTV pricing and listed payment plans");
    expect(prompt).not.toContain("$2,500 x 4");
    expect(prompt).not.toMatch(/curated_slack_evidence|training_transcript|governance_log/);
    expect(result.runtimeMetadata?.evidence?.modelCandidates).toBe(1);
    expect(result.runtimeMetadata?.evidence?.sourceChunkCandidates).toBe(0);
    expect(result.runtimeMetadata?.policyPlan?.selectedPolicyUnitIds).toEqual(["main-istv-pricing-and-plans"]);
  });

  it("asks for product scope when a payment-hold question does not identify the product", async () => {
    const wrongAssumption =
      "Because this is Daymond John, they can continue later. DJ/NLCEO has no cohort rule, so the main ISTV deadline does not apply.";
    installProviderStub({
      "answer generation": [outputStep(modelOutput(wrongAssumption))],
      "critical answer repair": [outputStep(modelOutput(wrongAssumption))],
    });

    const result = await runAskSalesFaq(paymentQuestion);

    expect(result.answer).toContain("Is this for main ISTV or DJ/NLCEO?");
    expect(result.answer).not.toMatch(/because this is (?:daymond john|next level ceo)/i);
    expect(result.needsRoute).toBe(true);
    expect(result.runtimeMetadata?.criticalFallbackUsed).toBe(false);
    expect(result.runtimeMetadata?.policyPlan?.clarificationRequired).toBe(true);
    expect(result.runtimeMetadata?.policyPlan?.selectedPolicyUnitIds).toEqual(["pricing-product-clarification"]);
  });

  it("uses the concise approved DJ timing plan when a draft promises a wait", async () => {
    installProviderStub({
      "answer generation": [outputStep(modelOutput("They can wait until August 15 because DJ has no cohort."))],
    });

    const result = await runAskSalesFaq(
      "This is a DJ applicant and funds are unavailable until Aug 15th. Do they have to re-apply or can they continue later?",
    );

    expect(result.answer).toContain("They do not have to reapply");
    expect(result.answer).toContain("Call 2 can be booked a few weeks out");
    expect(result.answer).not.toMatch(/main ISTV|\$2,500\s*x\s*4/i);
  });

  it("preserves the Legacy Makers DJ-to-ISTV passoff boundary", async () => {
    installProviderStub({
      "answer generation": [outputStep(modelOutput("Use the current Sales Ops materials for Legacy Makers."))],
    });

    const result = await runAskSalesFaq("Can you send me the current info and docs for Legacy Makers?");

    expect(result.answer).toContain("DJ side");
    expect(result.answer).toContain("ISTV-assigned rep");
  });

  it("does not invent a leadership-approval prerequisite for sending a contract before Call 2", async () => {
    installProviderStub({
      "answer generation": [
        outputStep(modelOutput("Sending the contract before Call 2 is allowed but not recommended without leadership approval.")),
      ],
    });

    const result = await runAskSalesFaq("Are we allowed to send a contract before Call 2?");

    expect(result.answer).toContain("you can send the current contract before Call 2");
    expect(result.answer).toContain("not advised");
    expect(result.answer).not.toContain("without leadership approval");
  });

  it("removes first-person handoff promises from route answers", async () => {
    const cleanAnswer =
      "Do not share or send the recording. Do not delete or vault it yourself. Acknowledge the request and route it to the source owner or compliance process.";
    installProviderStub({
      "answer generation": [
        outputStep(modelOutput("I'll make sure it gets to the people who can delete it.")),
      ],
      "rep-facing wording repair": [
        outputStep(
          modelOutput(cleanAnswer, {
            needsRoute: true,
            routeReason: "Route recording deletion requests to the source owner or compliance process.",
            selectedSourceIds: ["approved:internal-material-sharing-boundaries"],
          }),
        ),
      ],
    });

    const result = await runAskSalesFaq(
      "The applicant wants her audition recording deleted or vaulted because we cannot send it. What is the process?",
    );

    expect(result.answer).toBe(cleanAnswer);
    expect(result.answer).not.toMatch(/I'll make sure|I'll connect/i);
  });

  it("answers the approved hospital-employed doctor rule without reviving superseded ownership guidance", async () => {
    installProviderStub({
      "answer generation": [
        outputStep(
          modelOutput(
            "Yes. A hospital-employed doctor can qualify for America's Best Doctors even if they do not own the practice.",
            { selectedSourceIds: ["approved:qualification-and-show-fit-rubric"] },
          ),
        ),
      ],
    });
    const result = await runAskSalesFaq(
      "Does a hospital-employed doctor qualify if she does not own a private practice?",
    );

    expect(result.outcome).toBe("answer_from_approved_article");
    expect(result.answer).toContain("can qualify");
    expect(result.answer).not.toMatch(/guidance conflicts|must own|does not qualify/i);
    expect(result.runtimeMetadata?.policyPlan?.selectedPolicyUnitIds).toEqual([
      "americas-best-doctors-employed-doctor",
    ]);
  });

  it("keeps nurses outside the America's Best Doctors doctor category", async () => {
    installProviderStub({
      "answer generation": [
        outputStep(
          modelOutput("No. Nurses do not qualify as doctors for America's Best Doctors.", {
            selectedSourceIds: ["approved:qualification-and-show-fit-rubric"],
          }),
        ),
      ],
    });

    const result = await runAskSalesFaq("Can a registered nurse qualify as a doctor for America's Best Doctors?");

    expect(result.answer).toContain("do not qualify");
    expect(result.runtimeMetadata?.policyPlan?.selectedPolicyUnitIds).toEqual([
      "americas-best-doctors-nurse-boundary",
    ]);
  });

  it("answers unseen Spanish-production wording from the approved English-only fact", async () => {
    installProviderStub({
      "answer generation": [
        outputStep(
          modelOutput(
            "ISTV currently produces shows in English. Do not promise a Spanish-language episode or translation support.",
            { selectedSourceIds: ["approved:production-language-and-translation-boundary"] },
          ),
        ),
      ],
    });

    const result = await runAskSalesFaq("Could production record the entire show in Spanish for this client?");

    expect(result.outcome).toBe("answer_from_approved_article");
    expect(result.answer).toContain("in English");
    expect(result.answer).toContain("Do not promise");
    expect(result.runtimeMetadata?.policyPlan?.selectedPolicyUnitIds).toEqual([
      "english-only-production-and-translation",
    ]);
  });

  it("keeps a generic unsupported answer natural and hides internal routing reasons", async () => {
    installProviderStub({
      "conversation planning": [
        outputStep({
          mode: "unsupported",
          article_id: null,
          confidence_score: 0,
          confidence_label: "Low",
          needs_route: false,
          route_reason: "",
          reason: "No supported policy answer is available.",
        }),
      ],
    });

    const result = await runAskSalesFaq("Can the company buy a prospect a laptop for filming?");

    expect(result.outcome).toBe("abstain_unapproved");
    expect(result.answer).not.toMatch(/No approved policy rule|retrieval alone|knowledge base/i);
    expect(result.routeReason).toBe(
      "Confirm this with the current sales owner or the right help channel before replying.",
    );
    expect(result.structuredAnswer?.sections).toEqual([]);
  });

  it("answers an unseen follower-count question from the approved atomic claim", async () => {
    const claimId = "owner-social-followers-qualification-weight";
    const answer =
      "Follower count does not qualify or disqualify an applicant. Evaluate the overall business, story, reputation, and fit.";
    installProviderStub({
      "conversation planning": [
        outputStep({
          mode: "approved_claim",
          claim_ids: [claimId],
          article_id: null,
          confidence_score: 96,
          confidence_label: "High",
          needs_route: false,
          route_reason: "",
          reason: "The approved follower-count claim directly answers the qualification question.",
        }),
      ],
      "answer generation": [
        outputStep(
          modelOutput(answer, {
            selectedSourceIds: [`approved-claim:${claimId}`],
          }),
        ),
      ],
      "approved article answer validation": [outputStep({ verdict: "pass", reason: "Directly supported." })],
    });

    const result = await runAskSalesFaq("Does a small Instagram following mean I should disqualify an otherwise strong applicant?");

    expect(result.outcome).toBe("answer_from_evidence");
    expect(result.answer).toContain("does not qualify or disqualify");
    expect(result.source?.approved).toBe(true);
    expect(result.runtimeMetadata?.routing?.source).toBe("claim_router");
    expect(result.runtimeMetadata?.routing?.selectedClaimIds).toEqual([claimId]);
  });

  it("answers the requested payment-link delivery channel instead of returning generic tech routing", async () => {
    const claimId = "owner-zoom-phone-payment-link-email-only";
    const answer = "Send the approved payment link by email, not through a Zoom Phone message.";
    installProviderStub({
      "conversation planning": [
        outputStep({
          mode: "approved_claim",
          claim_ids: [claimId],
          confidence_score: 97,
          confidence_label: "High",
          needs_route: false,
          route_reason: "",
          reason: "The approved delivery-channel claim directly answers whether Zoom Phone is allowed.",
        }),
      ],
      "answer generation": [
        outputStep(modelOutput(answer, { selectedSourceIds: [`approved-claim:${claimId}`] })),
      ],
      "approved article answer validation": [outputStep({ verdict: "pass", reason: "Directly supported." })],
    });

    const result = await runAskSalesFaq("The prospect left the call. May I text the payment link through Zoom Phone?");

    expect(result.answer).toBe(answer);
    expect(result.outcome).toBe("answer_from_evidence");
    expect(result.needsRoute).toBe(false);
  });

  it("uses a current owner-backed route claim when fulfillment owns the next step", async () => {
    const claimId = "owner-scriptwriter-scheduling-fulfillment-route";
    const answer = "Post the scriptwriter scheduling issue in the fulfillment channel so the current team can advise.";
    installProviderStub({
      "conversation planning": [
        outputStep({
          mode: "approved_claim",
          claim_ids: [claimId],
          confidence_score: 96,
          confidence_label: "High",
          needs_route: true,
          route_reason: "Use the fulfillment channel for current scriptwriter scheduling help.",
          reason: "The approved current-process claim routes scriptwriter scheduling to fulfillment.",
        }),
      ],
      "answer generation": [
        outputStep(
          modelOutput(answer, {
            needsRoute: true,
            routeReason: "Use the fulfillment channel for current scriptwriter scheduling help.",
            selectedSourceIds: [`approved-claim:${claimId}`],
          }),
        ),
      ],
      "approved article answer validation": [outputStep({ verdict: "pass", reason: "Directly supported." })],
    });

    const result = await runAskSalesFaq("A past client cannot find any scriptwriter-call times. Where should I send this?");

    expect(result.outcome).toBe("route_from_evidence");
    expect(result.answer).toContain("fulfillment channel");
    expect(result.needsRoute).toBe(true);
  });

  it("keeps greetings and topic-switch statements conversational without injecting policy", async () => {
    installProviderStub({
      "conversation planning": [
        outputStep({
          mode: "conversation_reply",
          answer: "Hi! Ask me anything about the current sales process, and I’ll keep the answer concise.",
          summary: "Hi! Ask me anything about the current sales process, and I’ll keep the answer concise.",
          sections: [],
          article_id: null,
          claim_ids: [],
          confidence_score: 98,
          confidence_label: "High",
          needs_route: false,
          route_reason: "",
          reason: "Greeting without a policy request.",
        }),
        outputStep({
          mode: "conversation_reply",
          answer: "Sure—what would you like to know about payments or contracts?",
          summary: "Sure—what would you like to know about payments or contracts?",
          sections: [],
          article_id: null,
          claim_ids: [],
          confidence_score: 97,
          confidence_label: "High",
          needs_route: false,
          route_reason: "",
          reason: "Topic switch without a question.",
        }),
      ],
    });

    const greeting = await runAskSalesFaq("Hey there!");
    const topicSwitch = await runAskSalesFaq("Thanks. I’m switching to payments and contracts now.");

    expect(greeting.outcome).toBe("conversation_reply");
    expect(greeting.answer).toMatch(/^Hi!/);
    expect(topicSwitch.outcome).toBe("conversation_reply");
    expect(topicSwitch.answer).toContain("what would you like to know");
    expect(topicSwitch.answer).not.toMatch(/rights|license duration|route this/i);
  });

  it("does not promise an unconfirmed accessibility accommodation", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await runAskSalesFaq("Can we add audio descriptions as an accessibility accommodation?");

    expect(result.outcome).toBe("abstain_unapproved");
    expect(result.answer).toContain("not confirmed");
    expect(result.answer).toContain("production or accessibility owner");
    expect(result.runtimeMetadata?.routing?.matchedRuleId).toBe("abstain-accessibility-accommodation");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("routes record-assignment and automatic-contract failures to sales tech", async () => {
    const answer =
      "Post this in #sales-tech-requests with the lead record and a short description of the missing casting-manager assignment.";
    installProviderStub({
      "answer generation": [
        outputStep(
          modelOutput(answer, {
            needsRoute: true,
            routeReason: "Use #sales-tech-requests for the record-assignment issue.",
            selectedSourceIds: ["approved:sales-tech-routing-and-support-requests"],
          }),
        ),
      ],
    });

    const result = await runAskSalesFaq("A lead has no casting manager assigned in HubSpot. Where should I report it?");

    expect(result.answer).toContain("#sales-tech-requests");
    expect(result.runtimeMetadata?.routing?.matchedRuleId).toBe(
      "route-sales-tech-record-assignment-or-contract-automation",
    );
  });

  it("does not include discount totals in an upgrade question without prior discount eligibility", async () => {
    const answer =
      "A main ISTV client can upgrade before filming, but not after filming. Use the proper upgraded contract and current payment-difference route.";
    const provider = installProviderStub({
      "answer generation": [outputStep(modelOutput(answer))],
    });

    const result = await runAskSalesFaq(
      "Can a main ISTV client start with Lite and upgrade to Standard before filming?",
    );
    const generationCall = provider.calls.find((call) => call.purpose === "answer generation");
    const prompt = generationCall ? providerPrompt(generationCall) : "";

    expect(prompt).toContain("Policy unit: Main ISTV upgrade before filming");
    expect(prompt).not.toContain("Policy unit: Main ISTV upgrade discount carry-forward");
    expect(prompt).not.toContain("$18,000");
    expect(result.runtimeMetadata?.policyPlan?.selectedPolicyUnitIds).toEqual([
      "main-istv-upgrade-before-filming",
    ]);
  });

  it("replaces generic lead-ownership inventions with the approved Keap checks", async () => {
    installProviderStub({
      "answer generation": [
        outputStep(
          modelOutput("Check first-touch, territory, or a formal split agreement, then ask your team lead."),
        ),
      ],
    });

    const result = await runAskSalesFaq(
      "Another rep says this is their 20% lead, but I reached the prospect. What should I check before continuing?",
    );

    expect(result.answer).toContain("Check Keap first");
    expect(result.answer).toContain("30 days");
    expect(result.answer).toContain("first booking wins");
    expect(result.answer).not.toMatch(/territory|first-touch|formal split/i);
    expect(result.runtimeMetadata?.policyPlan?.selectedPolicyUnitIds).toEqual(["twenty-percent-lead-ownership"]);
  });

  it("does not let a bare DJ product mention turn bankruptcy into a pricing answer", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await runAskSalesFaq(
      "Does a past bankruptcy automatically disqualify a DJ/NLCEO applicant, or can I approve them?",
    );

    expect(result.outcome).toBe("abstain_unapproved");
    expect(result.answer).toContain("Do not automatically approve or disqualify");
    expect(result.answer).not.toMatch(/listed current package prices|payment options/i);
    expect(result.runtimeMetadata?.routing?.matchedRuleId).toBe("abstain-bankruptcy-qualification");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not let two product names turn opportunity ownership into pricing", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await runAskSalesFaq(
      "If a prospect is interested in both main ISTV and DJ/NLCEO, which rep should keep the opportunity and who should handle the passoff?",
    );

    expect(result.outcome).toBe("abstain_unapproved");
    expect(result.answer).toContain("ownership and passoff rule");
    expect(result.answer).not.toMatch(/listed current package prices|payment options/i);
    expect(result.runtimeMetadata?.routing?.matchedRuleId).toBe(
      "abstain-dual-product-opportunity-ownership",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rewrites first-person verification promises as a rep action", async () => {
    const cleanAnswer =
      "Do not promise full-episode YouTube rights. Confirm the exact usage rights with the current contracts or legal owner before replying.";
    installProviderStub({
      "answer generation": [
        outputStep(
          modelOutput("I need to verify the exact rights. I'll confirm with contracts and get back to you.", {
            needsRoute: true,
            routeReason: "Detailed content usage rights require contracts-approved wording.",
            selectedSourceIds: ["approved:platform-hosting-and-client-license-duration"],
          }),
        ),
      ],
      "rep-facing wording repair": [
        outputStep(
          modelOutput(cleanAnswer, {
            needsRoute: true,
            routeReason: "Confirm exact usage rights with the current contracts or legal owner.",
            selectedSourceIds: ["approved:platform-hosting-and-client-license-duration"],
          }),
        ),
      ],
    });

    const result = await runAskSalesFaq(
      "Can a client upload their full completed episode to YouTube, or should I promise only clips and approved reuse?",
    );

    expect(result.answer).toBe(cleanAnswer);
    expect(result.answer).not.toMatch(/I need to verify|I'll confirm|I will confirm/i);
  });

  it("honors main ISTV plus an explicit DJ exclusion even when critical repair is needed", async () => {
    const mainIstvAnswer =
      "For main ISTV, do not promise a hold or delayed payment date. Route the payment/deadline exception to Rich or the current owner before promising anything.";
    installProviderStub({
      "answer generation": [
        outputStep(
          modelOutput(mainIstvAnswer, {
            needsRoute: true,
            routeReason: "Main ISTV payment exceptions require current-owner confirmation.",
          }),
        ),
      ],
      "critical answer repair": [
        outputStep(
          modelOutput(mainIstvAnswer, {
            needsRoute: true,
            routeReason: "Main ISTV payment exceptions require current-owner confirmation.",
          }),
        ),
      ],
    });

    const result = await runAskSalesFaq(`${paymentQuestion} This is for main ISTV, not for any DJ show.`);

    expect(result.answer).toContain("For main ISTV");
    expect(result.answer).not.toMatch(/\$2,500\s*x\s*4|DJ\/NLCEO has no cohort rule|Because this is Daymond John/i);
    expect(result.provider).toBe("deepseek");
    expect(result.errorClass).toBeNull();
  });

  it("renders a simple route as one natural answer instead of a repeated policy card", async () => {
    const answer =
      "For main ISTV, do not promise a payment hold or later payment date; confirm the exception with Rich or the current owner first.";
    installProviderStub({
      "answer generation": [
        outputStep(
          modelOutput(answer, {
            needsRoute: true,
            routeReason: "Confirm the exception with Rich or the current owner before promising it.",
            sections: [
              { title: "Answer", body: answer },
              { title: "Route this", body: "Confirm the exception with Rich or the current owner." },
            ],
          }),
        ),
      ],
    });

    const result = await runAskSalesFaq(
      `${paymentQuestion} This is for main ISTV, not for any DJ show. Can I promise the hold?`,
    );

    expect(result.answer).toBe(answer);
    expect(result.structuredAnswer?.sections).toEqual([]);
  });

  it("rehydrates a product correction from the last substantive user question", async () => {
    const mainIstvAnswer =
      "For main ISTV, do not promise a hold or delayed payment date. Route the exception to Rich or the current owner.";
    const messages: AskSalesFaqChatMessage[] = [
      { role: "user", content: paymentQuestion },
      { role: "assistant", content: "First confirm whether this is main ISTV or DJ/NLCEO." },
      { role: "user", content: "What if my previous question was for main ISTV?" },
    ];
    const provider = installProviderStub({
      "conversation planning": [
        outputStep({
          mode: "unsupported",
          article_id: null,
          confidence_score: 0,
          confidence_label: "Low",
          needs_route: false,
          route_reason: "",
          reason: "The planner should not answer without the rehydrated policy question.",
        }),
      ],
      "answer generation": [
        outputStep(
          modelOutput(mainIstvAnswer, {
            needsRoute: true,
            routeReason: "Main ISTV payment exceptions require current-owner confirmation.",
          }),
        ),
      ],
      "critical answer repair": [
        outputStep(
          modelOutput(mainIstvAnswer, {
            needsRoute: true,
            routeReason: "Main ISTV payment exceptions require current-owner confirmation.",
          }),
        ),
      ],
    });

    const result = await runAskSalesFaq(messages.at(-1)?.content || "", messages);

    expect(result.contextualQuestion).toContain(paymentQuestion);
    expect(result.contextualQuestion).toContain("What if my previous question was for main ISTV?");
    expect(result.outcome).toBe("route_from_approved_article");
    expect(result.answer).toContain("For main ISTV");
    expect(provider.calls.some((call) => providerPrompt(call).includes(paymentQuestion))).toBe(true);
  });

  it("allows a genuine comparison to contain both products without treating either as excluded", async () => {
    const comparison =
      "Main ISTV Lite is $12,000. DJ/NLCEO Lite is $10,000 PIF, and its listed options include $2,500 x 4. Apply only the rules for the product being discussed.";
    installProviderStub({
      "answer generation": [outputStep(modelOutput(comparison))],
    });

    const result = await runAskSalesFaq("Compare main ISTV and DJ/NLCEO Lite prices and payment plans.");

    expect(result.answer).toContain("Main ISTV Lite is $12,000");
    expect(result.answer).toContain("DJ/NLCEO Lite is $10,000");
    expect(result.outcome).toBe("answer_from_approved_article");
  });

  it("retries malformed provider JSON and returns the valid retry", async () => {
    const answer = "Main ISTV Lite is $12,000, Standard is $20,000, and VIP/Premium is $30,000.";
    const provider = installProviderStub({
      "answer generation": [{ kind: "raw", value: "not valid json" }, outputStep(modelOutput(answer))],
    });

    const result = await runAskSalesFaq("What are the current ISTV prices and payment plans?");
    const attempts = result.runtimeMetadata?.providerAttempts || [];

    expect(result.answer).toBe(answer);
    expect(provider.calls.filter((call) => call.purpose === "answer generation")).toHaveLength(2);
    expect(attempts.map((attempt) => attempt.status)).toEqual(["failed", "success"]);
    expect(attempts[1]?.retry).toBe(true);
  });

  it("uses an approved scoped fallback when the provider request aborts", async () => {
    installProviderStub({
      "answer generation": [
        {
          kind: "throw",
          error: new DOMException("The operation was aborted", "AbortError"),
        },
      ],
    });

    const result = await runAskSalesFaq("Where can I find the current show list?");

    expect(result.provider).toBeNull();
    expect(result.errorClass).toBe("ai_runtime_approved_fallback");
    expect(result.answer).toContain("Legacy Makers");
    expect(result.answer).toContain("Masters of Innovation");
  });

  it("does not turn a lower-authority curated Slack claim into a deterministic provider fallback", async () => {
    const claimId = "claim_e421c70ea1db445d";
    installProviderStub({
      "conversation planning": [
        outputStep({
          mode: "approved_claim",
          claim_ids: [claimId],
          confidence_score: 95,
          confidence_label: "High",
          needs_route: false,
          route_reason: "",
          reason: "The curated low-risk call-format claim is directly relevant.",
        }),
      ],
      "answer generation": [
        {
          kind: "throw",
          error: new DOMException("The operation was aborted", "AbortError"),
        },
      ],
    });

    const result = await runAskSalesFaq("Can I do Call 1 by phone instead of Zoom?");

    expect(result.errorClass).toBe("ai_runtime_unavailable");
    expect(result.answer).not.toContain("company policy to do the audition over Zoom");
    expect(result.source).toBeNull();
  });

  it("keeps an approved enumeration structured even when the model returns one dense paragraph", async () => {
    const denseShowList =
      "The latest approved show list I have is: Legacy Makers, Women in Power, Operation CEO, America's Top Lawyers, America's Best Doctors, America's Top Trainers, America's Top Agents, Kingdom Creators, Mompreneurs, Couples of America, Builders of America, Legal Titans, Life Changers, Project Beauty, Mindset Masters, Love Experts, Live Longer, Americas Top Contractors, Blue Collar America, America's Authors, America's Top Physicians, Doctors of America, Rise of Her, Made It In America, Wealth Makers, Beyond Success, American Founders, Leading with Purpose, Impact Makers TV, and Masters of Innovation.";
    installProviderStub({
      "conversation planning": [
        outputStep({
          mode: "approved_article",
          article_id: "current-show-source",
          confidence_score: 97,
          confidence_label: "High",
          needs_route: false,
          route_reason: "",
          reason: "The approved current-show article controls this question.",
        }),
      ],
      "answer generation": [
        outputStep(
          modelOutput(denseShowList, {
            selectedSourceIds: ["approved:current-show-source"],
            sections: [{ title: "What you can say", body: denseShowList }],
          }),
        ),
      ],
    });

    const result = await runAskSalesFaq("What shows do we currently offer?");
    const list = result.structuredAnswer?.sections.find((section) => section.title === "Latest Approved Show List");

    expect(list?.items).toHaveLength(30);
    expect(list?.items?.[0]).toBe("Legacy Makers");
    expect(list?.items?.at(-1)).toBe("Masters of Innovation");
  });

  it("formats the previous list without re-routing policy or calling a provider", async () => {
    const previousAnswer =
      "The latest approved show list I have is: Legacy Makers, Women in Power, Operation CEO, America's Top Lawyers, America's Best Doctors, America's Top Trainers, America's Top Agents, Kingdom Creators, Mompreneurs, Couples of America, Builders of America, Legal Titans, Life Changers, Project Beauty, Mindset Masters, Love Experts, Live Longer, Americas Top Contractors, Blue Collar America, America's Authors, America's Top Physicians, Doctors of America, Rise of Her, Made It In America, Wealth Makers, Beyond Success, American Founders, Leading with Purpose, Impact Makers TV, and Masters of Innovation.";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const messages: AskSalesFaqChatMessage[] = [
      { role: "user", content: "What shows do we offer?" },
      { role: "assistant", content: previousAnswer },
      { role: "user", content: "Format these properly as a list." },
    ];

    const result = await runAskSalesFaq(messages.at(-1)?.content || "", messages);
    const list = result.structuredAnswer?.sections.find((section) => section.title === "Current shows");

    expect(result.outcome).toBe("conversation_reply");
    expect(list?.items).toHaveLength(30);
    expect(result.answer).toContain("- Legacy Makers");
    expect(result.answer).toContain("- Masters of Innovation");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps a provider-timeout fallback inside an explicit main ISTV scope", async () => {
    installProviderStub({
      "answer generation": [
        {
          kind: "throw",
          error: new DOMException("The operation was aborted", "AbortError"),
        },
      ],
    });

    const result = await runAskSalesFaq(
      `${paymentQuestion} This is for main ISTV and explicitly not for any DJ show.`,
    );

    expect(result.errorClass).toBe("ai_runtime_approved_fallback");
    expect(result.answer).toContain("For main ISTV");
    expect(result.answer).not.toMatch(/DJ\/NLCEO|Daymond John|Next Level CEO|\$2,500\s*x\s*4|no cohort rule/i);
    expect(result.routeReason).toBe(
      "Confirm any nonstandard main ISTV payment or deadline exception with Rich or the current owner before promising it.",
    );
    expect(result.runtimeMetadata?.policyPlan?.resolvedProductScope).toBe("main_istv");
    expect(result.runtimeMetadata?.policyPlan?.excludedProductScopes).toEqual(["dj_nlceo"]);
  });
});

function installProviderStub(script: ProviderScript) {
  const queues = new Map<ProviderPurpose, ProviderStep[]>();
  for (const [purpose, steps] of Object.entries(script) as Array<[ProviderPurpose, ProviderStep[]]>) {
    queues.set(purpose, [...steps]);
  }

  const calls: CapturedProviderCall[] = [];
  const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    expect(String(input)).toBe("https://api.deepseek.com/chat/completions");

    const requestBody = JSON.parse(String(init?.body || "{}")) as {
      messages?: Array<{ role?: string; content?: string }>;
    };
    const messages = requestBody.messages || [];
    const purpose = detectProviderPurpose(messages);
    calls.push({ purpose, messages });

    const step = queues.get(purpose)?.shift();
    if (!step) throw new Error(`Unexpected ${purpose} provider call`);
    if (step.kind === "throw") throw step.error;
    if (step.kind === "http_error") {
      return new Response(JSON.stringify({ error: { message: step.message || "Stub provider failure" } }), {
        status: step.status || 500,
        headers: { "content-type": "application/json" },
      });
    }

    const content = step.kind === "raw" ? step.value : JSON.stringify(step.value);
    return new Response(
      JSON.stringify({
        choices: [{ message: { content } }],
        usage: { completion_tokens: 1, total_tokens: 1 },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  });

  vi.stubGlobal("fetch", fetchMock);
  return { calls, fetchMock };
}

function detectProviderPurpose(messages: Array<{ role?: string; content?: string }>): ProviderPurpose {
  const prompt = messages.map((message) => message.content || "").join("\n");

  if (prompt.includes("Ask Sales FAQ conversation planner")) return "conversation planning";
  if (prompt.includes("You rewrite Ask Sales FAQ answers")) return "rep-facing wording repair";
  if (prompt.includes("You repair Ask Sales FAQ answers")) return "critical answer repair";
  if (prompt.includes("You validate an Ask Sales FAQ draft answer")) return "approved article answer validation";
  if (prompt.includes("You are Ask Sales FAQ, an internal AI assistant")) return "answer generation";

  throw new Error("Unrecognized Ask Sales FAQ provider purpose");
}

function providerPrompt(call: CapturedProviderCall) {
  return call.messages.map((message) => message.content || "").join("\n");
}

function outputStep(value: unknown): ProviderStep {
  return { kind: "output", value };
}

function modelOutput(
  answer: string,
  options: {
    needsRoute?: boolean;
    routeReason?: string;
    selectedSourceIds?: string[];
    sections?: Array<{ title?: string; body?: string; items?: string[]; tone?: string }>;
  } = {},
) {
  return {
    answer,
    summary: answer,
    sections: options.sections || [],
    selected_source_ids: options.selectedSourceIds || ["approved:istv-nlceo-pricing-and-same-day-discount"],
    needs_route: options.needsRoute || false,
    route_reason: options.routeReason || "",
    confidence_label: "High",
    confidence_score: 95,
  };
}
