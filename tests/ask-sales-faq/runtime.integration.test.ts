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
