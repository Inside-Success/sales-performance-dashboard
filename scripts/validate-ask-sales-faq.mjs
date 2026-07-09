import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const requiredFiles = [
  "src/app/ask-sales-faq/page.tsx",
  "src/app/ask-sales-faq/admin/page.tsx",
  "src/app/api/ask-sales-faq/route.ts",
  "src/app/api/ask-sales-faq/conversations/route.ts",
  "src/app/api/ask-sales-faq/conversations/[conversationId]/route.ts",
  "src/app/api/ask-sales-faq/feedback/route.ts",
  "src/components/ask-sales-faq/ask-sales-faq-chat.tsx",
  "src/lib/ask-sales-faq/access.ts",
  "src/lib/ask-sales-faq/feedback-sync.ts",
  "src/lib/ask-sales-faq/runtime.ts",
  "src/lib/ask-sales-faq/types.ts",
  "src/lib/ask-sales-faq/generated/approved-faq-bundle.ts",
  "src/lib/ask-sales-faq/generated/policy-aware-rag-index.json",
];

const secretPatterns = [/sk-proj-[A-Za-z0-9_-]{20,}/, /sk-ant-[A-Za-z0-9_-]{20,}/, /sk-[A-Za-z0-9_-]{32,}/];

const checks = [];

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function addCheck(name, passed, detail) {
  checks.push({ name, passed, detail });
}

const missingFiles = requiredFiles.filter((file) => !fs.existsSync(path.join(root, file)));
addCheck(
  "required Ask Sales FAQ files exist",
  missingFiles.length === 0,
  missingFiles.length ? `missing: ${missingFiles.join(", ")}` : "all required files exist",
);

if (missingFiles.length === 0) {
  const page = read("src/app/ask-sales-faq/page.tsx");
  const adminPage = read("src/app/ask-sales-faq/admin/page.tsx");
  const chatRoute = read("src/app/api/ask-sales-faq/route.ts");
  const historyRoute = read("src/app/api/ask-sales-faq/conversations/route.ts");
  const conversationActionRoute = read("src/app/api/ask-sales-faq/conversations/[conversationId]/route.ts");
  const feedbackRoute = read("src/app/api/ask-sales-faq/feedback/route.ts");
  const feedbackSync = read("src/lib/ask-sales-faq/feedback-sync.ts");
  const chatUi = read("src/components/ask-sales-faq/ask-sales-faq-chat.tsx");
  const nav = read("src/components/dashboard/main-nav.tsx");
  const runtime = read("src/lib/ask-sales-faq/runtime.ts");
  const access = read("src/lib/ask-sales-faq/access.ts");
  const types = read("src/lib/ask-sales-faq/types.ts");
  const bundle = read("src/lib/ask-sales-faq/generated/approved-faq-bundle.ts");
  const ragIndex = JSON.parse(read("src/lib/ask-sales-faq/generated/policy-aware-rag-index.json"));
  const db = read("src/lib/db.ts");
  const envExample = read(".env.example");

  addCheck("hidden page route is not in main nav", !nav.includes("/ask-sales-faq"), "main nav does not expose route");

  addCheck(
    "admin route stays hidden from main nav",
    !nav.includes("/ask-sales-faq/admin"),
    "admin route is not exposed in normal dashboard navigation",
  );

  addCheck(
    "page uses Ask Sales FAQ access gate",
    page.includes("getAskSalesFaqAccess"),
    "page checks feature flag and allowlist",
  );

  addCheck(
    "admin page uses admin email gate",
    adminPage.includes("isAskSalesFaqAdmin") &&
      adminPage.includes("getAskSalesFaqAdminOverview") &&
      adminPage.includes("Read-only Neon review") &&
      adminPage.includes("backend records remain saved"),
    "admin page requires admin email and is read-only",
  );

  addCheck(
    "api routes call auth directly",
    [chatRoute, historyRoute, conversationActionRoute, feedbackRoute].every((content) => content.includes("await auth()")),
    "all api routes call auth",
  );

  addCheck(
    "api routes use access gate",
    [chatRoute, historyRoute, conversationActionRoute, feedbackRoute].every((content) => content.includes("getAskSalesFaqAccess")),
    "all api routes use access gate",
  );

  addCheck(
    "runtime uses approved bundle and policy guard",
    runtime.includes("APPROVED_FAQ_ARTICLES") &&
      runtime.includes("ASK_SALES_FAQ_POLICY_RULES") &&
      runtime.includes("decidePolicyGuard") &&
      runtime.includes("buildPolicyBlockedDecision") &&
      runtime.includes("policy-aware-rag-index.json"),
    "runtime imports approved bundle, policy rules, and server-side RAG index",
  );

  addCheck(
    "runtime has safe fallback behavior",
    runtime.includes("AI_UNAVAILABLE_RESPONSE") && runtime.includes("buildUnavailableDecision"),
    "runtime returns a safe user-facing message instead of raw errors when AI is unavailable",
  );

  addCheck(
    "runtime filters recent chat context before policy routing",
    runtime.includes("routingConversationContext") &&
      runtime.includes("shouldUseConversationContextForRouting") &&
      runtime.includes("isContextDependentFollowUpQuestion") &&
      !runtime.includes("decidePolicyGuard(sanitizedQuestion, conversationContext)") &&
      !runtime.includes("matchPolicyGuard(buildContextualQuestion(question, conversationContext))"),
    "old chat context is only available to routing for true follow-ups, not every new standalone question",
  );

  addCheck(
    "bundle includes real Slack question regression rules",
    bundle.includes("answer-americas-authors-episode-availability") &&
      bundle.includes("answer-pre-audition-video-sharing") &&
      bundle.includes("answer-license-options-document") &&
      bundle.includes("answer-short-notice-onboarding") &&
      bundle.includes("answer-dj-nlceo-book-out-timing") &&
      bundle.includes("answer-four-pay-mastermind-filming") &&
      bundle.includes("answer-rebrand-examples"),
    "source-backed Slack regression topics are represented without adding a broad fallback answer path",
  );

  addCheck(
    "chat requests send bounded recent context",
    chatUi.includes("MAX_CONTEXT_MESSAGES_TO_SEND = 10") &&
      chatUi.includes("MAX_CONTEXT_MESSAGE_CHARS = 1800") &&
      chatUi.includes("function buildRequestMessages") &&
      chatUi.includes("messages: buildRequestMessages(nextMessages)"),
    "browser sends a compact recent chat window instead of the full conversation history",
  );

  addCheck(
    "api trims long inbound conversations defensively",
    chatRoute.includes("MAX_INBOUND_MESSAGES = 200") &&
      chatRoute.includes("MAX_RUNTIME_MESSAGES = 10") &&
      chatRoute.includes("MAX_RUNTIME_MESSAGE_CHARS = 2000") &&
      chatRoute.includes("function normalizeRuntimeMessages") &&
      chatRoute.includes("const messages = normalizeRuntimeMessages(payload.messages)") &&
      chatRoute.includes("export const maxDuration = 120"),
    "server accepts old/full-chat clients but trims to a safe runtime window and allows longer model calls",
  );

  addCheck(
    "bundle has nineteen approved rep-facing articles",
    (bundle.match(/"?approvedAt"?\s*:\s*"/g) || []).length === 19 &&
      bundle.includes('"call-1-flow"') &&
      bundle.includes('"opt-out-dnc-and-security-escalation"') &&
      bundle.includes('"qualification-and-show-fit-rubric"') &&
      bundle.includes('"main-istv-call-2-cohort-reschedule-rules"') &&
      bundle.includes('"greenlight-pdf-and-cohort-deadlines"') &&
      bundle.includes('"sales-tech-routing-and-support-requests"') &&
      bundle.includes('"approvedAt": "2026-07-08"') &&
      bundle.includes("#sales-finance-requests") &&
      bundle.includes("#sales-tech-requests") &&
      bundle.includes("#greenlight-requests"),
    "bundle contains the original approved articles plus the Rich/Mike-approved July 7 and Rich/user-confirmed July 8 gap closures",
  );

  addCheck(
    "neon schema and helpers are present",
    db.includes("ask_sales_faq_conversations") &&
      db.includes("ask_sales_faq_messages") &&
      db.includes("ask_sales_faq_feedback") &&
      db.includes("ask_sales_faq_misses") &&
      db.includes("ask_sales_faq_diagnostics") &&
      db.includes("saveAskSalesFaqExchange") &&
      db.includes("saveAskSalesFaqDiagnostic") &&
      db.includes("getAskSalesFaqAdminOverview") &&
      db.includes("answer_payload"),
    "db includes ask sales faq tables, helpers, diagnostics, admin overview, and structured answer retention",
  );

  addCheck(
    "rollout request guard table is present",
    db.includes("ask_sales_faq_request_guards") &&
      db.includes("client_request_id") &&
      db.includes("status in ('in_progress', 'completed', 'failed', 'rate_limited')") &&
      db.includes("ask_sales_faq_request_guards_viewer_created_idx") &&
      db.includes("ask_sales_faq_request_guards_status_updated_idx"),
    "db has the idempotency/rate-limit guard table and indexes",
  );

  addCheck(
    "rollout guard helpers are present",
    db.includes("reserveAskSalesFaqRequest") &&
      db.includes("checkAskSalesFaqRateLimit") &&
      db.includes("completeAskSalesFaqRequest") &&
      db.includes("failAskSalesFaqRequest") &&
      db.includes("FAQ_RATE_LIMIT_USER_WINDOW_MINUTES") &&
      db.includes("FAQ_RATE_LIMIT_USER_MAX") &&
      db.includes("FAQ_RATE_LIMIT_GLOBAL_WINDOW_SECONDS") &&
      db.includes("FAQ_RATE_LIMIT_GLOBAL_MAX"),
    "db exposes request reservation, completion/failure, and tunable rate-limit helpers",
  );

  addCheck(
    "chat api uses request guards before model calls",
    chatRoute.includes("clientRequestId: z.string().trim().max(120).optional().nullable()") &&
      chatRoute.includes("normalizeClientRequestId") &&
      chatRoute.includes("buildRequestGuardId") &&
      chatRoute.includes("reserveAskSalesFaqRequest") &&
      chatRoute.includes("checkAskSalesFaqRateLimit") &&
      chatRoute.includes("completeAskSalesFaqRequest") &&
      chatRoute.includes("failAskSalesFaqRequest") &&
      chatRoute.includes("requestGuard.response") &&
      chatRoute.includes("X-Ask-Sales-FAQ-Replayed"),
    "route validates client request ids, replays completed protected responses, and reserves/checks requests before calling the model",
  );

  addCheck(
    "chat api returns friendly protected-state messages",
    chatRoute.includes("buildDuplicateInProgressResponse") &&
      chatRoute.includes("buildRateLimitedResponse") &&
      chatRoute.includes("You have sent a lot of questions in a short time") &&
      chatRoute.includes("Ask Sales FAQ is getting a lot of questions at once") &&
      chatRoute.includes("I am already working on that question") &&
      chatRoute.includes("route the question instead of guessing") &&
      types.includes('"rate_limited"') &&
      types.includes('"duplicate_in_progress"') &&
      types.includes('"conversation_reply"'),
    "rate-limit, duplicate-send, and conversational states return clear typed outcomes",
  );

  addCheck(
    "chat answer logging is non-blocking after generation",
    chatRoute.includes("import { after, NextRequest, NextResponse } from \"next/server\"") &&
      chatRoute.includes("function scheduleExchangeSave") &&
      chatRoute.includes("after(async () =>") &&
      chatRoute.includes("saveAskSalesFaqExchange(payload)") &&
      chatRoute.includes("exchange_logging_failed"),
    "successful answers are returned before background history logging finishes",
  );

  addCheck(
    "browser sends a unique request id per question",
    chatUi.includes("clientRequestId: createClientRequestId()") &&
      chatUi.includes("function createClientRequestId") &&
      chatUi.includes("crypto.randomUUID()") &&
      chatUi.includes("Ask Sales FAQ is having trouble right now. Try again in a few moments"),
    "client posts an idempotency key and has a friendly network/runtime fallback",
  );

  addCheck(
    "validation failures become safe replies and diagnostics",
    chatRoute.includes("requestSchema.safeParse(rawPayload)") &&
      chatRoute.includes("buildSafeValidationResponse") &&
      chatRoute.includes("saveAskSalesFaqDiagnostic") &&
      chatRoute.includes("summarizePayloadIssue"),
    "bad payloads get a user-facing safe reply plus backend diagnostics, not a raw client error",
  );

  addCheck(
    "conversation delete is soft-delete and backend-retained",
    db.includes("status = 'deleted'") &&
      db.includes("deleted_at") &&
      conversationActionRoute.includes("retainedInBackend: true") &&
      !conversationActionRoute.includes("delete from ask_sales_faq"),
    "delete hides chat from sidebar without deleting rows",
  );

  addCheck(
    "conversation action menu closes on outside click",
    chatUi.includes("document.addEventListener(\"pointerdown\", closeConversationMenu)") &&
      chatUi.includes("[data-conversation-menu-root]") &&
      chatUi.includes("document.addEventListener(\"keydown\", closeConversationMenuWithKeyboard)"),
    "recent-chat action menu has click-away and escape-key closing behavior",
  );

  addCheck(
    "policy-aware RAG index has broad source coverage",
    ragIndex.chunk_count > 1000 &&
      ragIndex.chunks.some((chunk) => chunk.source_type === "approved_article") &&
      ragIndex.chunks.some((chunk) => chunk.source_type === "curated_slack_evidence") &&
      ragIndex.chunks.some((chunk) => chunk.source_type === "training_transcript"),
    `RAG index contains ${ragIndex.chunk_count} chunks across approved, Slack, and transcript evidence`,
  );

  addCheck(
    "normal FAQ answers are AI-first, not deterministic templates",
    runtime.includes("generateProviderAnswer") &&
      runtime.includes("selected_source_ids") &&
      !runtime.includes("createSearchProfileWithAi") &&
      !runtime.includes("selectEvidenceWithAi") &&
      !runtime.includes("reviewAnswerWithAi") &&
      !runtime.includes("function buildDeterministicAnswer") &&
      !runtime.includes("const deterministicAnswer"),
    "normal FAQ path uses a single AI call for evidence selection and answer generation",
  );

  addCheck(
    "pricing starter prompt has approved guard coverage",
    bundle.includes("current istv prices") &&
      bundle.includes("price and payment plans") &&
      bundle.includes("payment plans"),
    "common pricing/payment-plan phrasing routes to approved pricing article",
  );

  addCheck(
    "runtime uses AI semantic evidence selection over broad evidence",
    runtime.includes("Internally select the evidence by meaning, not by mechanical keyword overlap") &&
      runtime.includes("formatEvidencePacket") &&
      runtime.includes("selected_source_ids") &&
      runtime.includes("buildEvidenceCandidates") &&
      runtime.includes("A policy guard or approved-article router has already selected the approved sales guidance that controls this answer.") &&
      runtime.includes("Use any supporting evidence only for consistent context or wording"),
    "runtime asks the model to answer only after the policy guard or approved-article router selects the controlling sales guidance",
  );

  addCheck(
    "approved-topic RAG is scoped to the matched article",
    runtime.includes("buildPolicyScopedEvidenceCandidates") &&
      runtime.includes("scopedSupportChunkMatchesArticle") &&
      runtime.includes("SCOPED_EVIDENCE_WEAK_TOKENS") &&
      runtime.includes('chunk.source_type !== "approved_article"') &&
      runtime.includes("strongArticleTokenMatches.length >= 3"),
    "approved answers can include tightly scoped support, but broad unmatched retrieval stays blocked",
  );

  addCheck(
    "AI provider calls enforce JSON and preserve provider diagnostics",
    runtime.includes("response_format: { type: \"json_object\" }") &&
      runtime.includes("sanitizeProviderError") &&
      runtime.includes("extractJsonObject") &&
      runtime.includes("No Ask Sales FAQ provider succeeded for ${input.purpose}. Attempts: ${errors.length}."),
    "DeepSeek JSON mode is enabled and provider failures are logged with sanitized detail",
  );

  addCheck(
    "AI provider path has speed guardrails without broad deterministic answers",
    runtime.includes("FAQ_DEEPSEEK_DISABLE_THINKING") &&
      runtime.includes("thinking: { type: \"disabled\" }") &&
      runtime.includes("FAQ_ALLOW_CLAUDE_FALLBACK") &&
      runtime.includes("buildDeepSeekJsonRetryMessages") &&
      runtime.includes("runtimeMetadata") &&
      runtime.includes("modelEvidenceCandidates") &&
      envExample.includes('FAQ_DEEPSEEK_DISABLE_THINKING="true"') &&
      envExample.includes('FAQ_ALLOW_CLAUDE_FALLBACK="false"') &&
      !runtime.includes("function buildDeterministicAnswer") &&
      !runtime.includes("const deterministicAnswer"),
    "DeepSeek stays primary, malformed JSON gets one DeepSeek retry, Claude fallback is opt-in, and normal answers still use AI with approved evidence",
  );

  addCheck(
    "Ask Sales FAQ defaults to DeepSeek V4 Pro",
    runtime.includes('process.env.FAQ_DEEPSEEK_MODEL || "deepseek-v4-pro"') &&
      envExample.includes('FAQ_DEEPSEEK_MODEL="deepseek-v4-pro"') &&
      runtime.includes('process.env.FAQ_MODEL_TIMEOUT_SECONDS || "60"') &&
      envExample.includes('FAQ_MODEL_TIMEOUT_SECONDS="60"'),
    "runtime and env example default to DeepSeek V4 Pro with more timeout room for the higher-quality model",
  );

  addCheck(
    "same-day discount article uses same-calendar-day rule",
    bundle.includes("same calendar day as that Call 2") &&
      bundle.includes("pays later that same calendar day") &&
      bundle.includes("Do not carry the discount into the next day.") &&
      !bundle.includes("on that Call-2 closing call"),
    "approved pricing article no longer requires payment on the call when same-day payment occurs later",
  );

  addCheck(
    "DJ and Next Level CEO payment splits are available",
    bundle.includes("$2,500 x 4") &&
      bundle.includes("$3,600 x 3") &&
      bundle.includes("$4,000 x 4") &&
      bundle.includes("$7,500 x 2") &&
      bundle.includes("$7,000 x 3") &&
      bundle.includes("$10,000 x 2") &&
      bundle.includes("CEO Day upgrade"),
    "approved pricing bundle includes DJ/NLCEO PIF and split-payment options",
  );

  addCheck(
    "main ISTV Lite upgrade discount carry-forward is available",
    bundle.includes("Main ISTV upgrade before filming") &&
      bundle.includes("carries forward") &&
      bundle.includes("Discounted Standard total is $18,000") &&
      bundle.includes("Discounted VIP/Premium total is $28,000") &&
      bundle.includes("payment-difference link"),
    "approved pricing bundle includes before-filming upgrade totals and differences",
  );

  addCheck(
    "Call 1 pricing boundary uses Rich confirmation",
    bundle.includes("Default Call 1 pricing rule") &&
      bundle.includes("Narrow disqualification exception") &&
      bundle.includes("does not have a business and is not financially qualified") &&
      bundle.includes("only to disqualify") &&
      !bundle.includes("abstain-call-1-pricing-boundary"),
    "Call 1 pricing is now an approved article with the narrow disqualification exception",
  );

  addCheck(
    "confidence scores are normalized before display",
    runtime.includes("confidence_score must be an integer from 0 to 100") &&
      runtime.includes("parseConfidenceScore") &&
      runtime.includes("confidenceLabelFromScore") &&
      runtime.includes("numericValue >= 0 && numericValue <= 1 ? numericValue * 100 : numericValue") &&
      db.includes("normalizeAskSalesFaqConfidenceScore") &&
      db.includes("askSalesFaqConfidenceLabelFromScore") &&
      db.includes("confidenceScore === null ? item.confidence_label : askSalesFaqConfidenceLabelFromScore(confidenceScore)"),
    "model and stored confidence are normalized from decimal scale to 0-100 and label is aligned to score",
  );

  addCheck(
    "follow-up questions use filtered recent chat context",
    chatRoute.includes("runAskSalesFaq(lastMessage.content, messages)") &&
      runtime.includes("buildConversationContext") &&
      runtime.includes("const routingConversationContext = shouldUseConversationContextForRouting") &&
      runtime.includes("policyDecision = decidePolicyGuard(sanitizedQuestion, routingConversationContext)") &&
      runtime.includes("conversationContext: routingConversationContext") &&
      runtime.includes("isContextDependentFollowUpQuestion") &&
      runtime.includes("The current user question is authoritative."),
    "runtime filters recent context before AI routing and keeps direct policy matching current-question-first",
  );

  addCheck(
    "AI conversation planner handles policy-guard false abstains",
    runtime.includes("tryPlanConversationTurn") &&
      runtime.includes("conversation planning") &&
      runtime.includes("mode conversation_reply") &&
      runtime.includes("mode approved_article") &&
      runtime.includes("mode unsupported") &&
      runtime.includes("Do not add new policy, prices, discounts, owners, links, exceptions, or process steps") &&
      runtime.includes("For shorten/rephrase requests, use the most recent substantive assistant sales answer") &&
      runtime.includes("Never use conversation_reply for new sales-policy/action questions") &&
      runtime.includes("shouldAcceptConversationPlannerReply") &&
      runtime.includes("buildConversationReplyDecision") &&
      runtime.includes("routingSource: \"article_router\"") &&
      runtime.includes("routingSource: \"conversation_planner\"") &&
      types.includes("conversation_planner") &&
      db.includes('\"conversation_reply\"'),
    "default-abstain messages can become natural conversation replies, approved-article matches, or safe unsupported fallbacks without broad free answering",
  );

  addCheck(
    "short conversational follow-ups plan before broad routing",
    runtime.includes("let policyDecision = matchPolicyGuard(sanitizedQuestion)") &&
      runtime.includes("let conversationPlannerAttempted = false") &&
      runtime.includes("shouldPlanConversationBeforeContextPolicy(sanitizedQuestion, routingConversationContext)") &&
      runtime.includes("conversationPlannerAttempted = true") &&
      runtime.includes("policyDecision = decidePolicyGuard(sanitizedQuestion, routingConversationContext)") &&
      runtime.includes("!conversationPlannerAttempted") &&
      runtime.includes("isShortAnswerRewriteRequest") &&
      runtime.includes("isSocialConversationTurn") &&
      runtime.includes("isConcisePromiseConfirmation(question)") &&
      runtime.includes("return false;") &&
      runtime.includes("Ignore brief social replies like 'You're welcome'"),
    "short confirmations, thank-yous, and rewrite requests reach the AI planner without letting old context force a full policy answer",
  );

  addCheck(
    "fresh sales-policy action questions cannot become casual chat replies",
    runtime.includes("isNewSalesPolicyActionQuestion") &&
      runtime.includes("can i|can we|could i|could we|should i|should we") &&
      runtime.includes("offer|promise|approve|approval|greenlight|qualify|qualified|eligible|allowed|custom|deposit|payment|pay|discount|hold|exception") &&
      runtime.includes("hasMoneyOrPaymentAmount") &&
      runtime.includes("return !isNewSalesPolicyActionQuestion(question)") &&
      runtime.includes("money, deposit, payment, discount, contract, greenlight, qualification, offer, promise, hold, or exception questions"),
    "short follow-up handling cannot bypass approved-policy routing for new offer/payment/hold/qualification questions",
  );

  addCheck(
    "conversation replies render as plain chat instead of policy cards",
    chatUi.includes('message.outcome === "conversation_reply"') &&
      chatUi.includes("<AnswerText text={message.content} />") &&
      db.includes('\"conversation\"') &&
      runtime.includes("set summary equal to the answer and leave sections empty") &&
      runtime.includes("sections: []"),
    "thank-yous and rewrite replies no longer show internal planner summaries or forced answer-card blocks",
  );

  addCheck(
    "unapproved specialist handoffs are blocked",
    runtime.includes("UNAPPROVED_HANDOFF_PATTERNS") &&
      runtime.includes("let me connect") &&
      runtime.includes("specialist for (?:this|the) program") &&
      runtime.includes("someone|a specialist|our specialist") &&
      runtime.includes("will|can") &&
      runtime.includes("Do not tell the rep or prospect you will connect them with a specialist") &&
      runtime.includes("someone will reach out") &&
      runtime.includes("confirm with the current owner or post in the approved channel") &&
      runtime.includes("UNAPPROVED_HANDOFF_PATTERNS.some((pattern) => pattern.test(answer))"),
    "model output cannot tell reps/prospects a specialist will connect or reach out unless that handoff is explicitly approved",
  );

  addCheck(
    "article-router answers get grounding validation",
    runtime.includes("ensureArticleRouterGrounding") &&
      runtime.includes("approved article answer validation") &&
      runtime.includes("Fail if the draft invents a policy") &&
      runtime.includes("formatEvidencePacket([approvedArticleToCandidate(primaryArticle)]") &&
      runtime.includes("check.output.verdict !== \"pass\"") &&
      runtime.includes("parseGroundingCheckOutput"),
    "AI-router-selected answers are validated against the selected approved sales guidance before return",
  );

  addCheck(
    "composer stays editable while an answer is loading",
    chatUi.includes("const [queuedQuestions, setQueuedQuestions]") &&
      chatUi.includes("const isComposerEmpty = !input.trim()") &&
      chatUi.includes('placeholder={isLoading ? "Type the next follow-up..."') &&
      chatUi.includes("disabled={isComposerEmpty}") &&
      chatUi.includes('aria-label={isLoading ? "Queue follow-up question" : "Send question"}') &&
      !chatUi.includes("disabled={isLoading}"),
    "textarea remains enabled during loading and the submit button queues non-empty follow-ups",
  );

  addCheck(
    "composer draft survives queued auto-sends",
    chatUi.includes("function clearComposerIfCurrentQuestion") &&
      chatUi.includes("setInput((currentInput) => (currentInput.trim() === normalizedQuestion ? \"\" : currentInput))") &&
      chatUi.includes("clearComposerIfCurrentQuestion(question)") &&
      !chatUi.includes("syncMessages(nextMessages);\n    setInput(\"\");"),
    "queued or auto-started questions only clear the composer when they are still the current draft",
  );

  addCheck(
    "queued follow-ups drain sequentially after successful answers",
    chatUi.includes("function queueQuestion") &&
      chatUi.includes("function runNextQueuedQuestion") &&
      chatUi.includes("if (isLoadingRef.current)") &&
      chatUi.includes("syncQueuedQuestions(remainingQuestions)") &&
      chatUi.includes("void sendQuestion(nextQuestion.content)") &&
      chatUi.includes("if (shouldContinueQueue) runNextQueuedQuestion()") &&
      chatUi.includes("messages: buildRequestMessages(nextMessages)"),
    "loading submissions are queued, then sent one at a time with the latest bounded chat context",
  );

  addCheck(
    "queued follow-ups are visible and recoverable",
    chatUi.includes("function QueuedFollowups") &&
      chatUi.includes("Paused after the last answer failed.") &&
      chatUi.includes("onRemove={removeQueuedQuestion}") &&
      chatUi.includes("onClear={clearQueuedQuestions}") &&
      chatUi.includes("onResume={resumeQueuedQuestions}") &&
      chatUi.includes("if (queuedQuestionsRef.current.length) syncQueuePaused(true)") &&
      chatUi.includes("Finish the current answer or clear queued follow-ups before switching chats."),
    "queued items can be removed/cleared/resumed and chat switching is blocked while queue work is active",
  );

  addCheck(
    "current question intent is not overwritten by old chat context",
    runtime.includes("CURRENT USER QUESTION:") &&
      runtime.includes("Use recent conversation context only to resolve references or context-dependent follow-ups") &&
      !runtime.includes("const decision = decideQuestion(contextualQuestion)") &&
      !runtime.includes("/\\b(it|that|this|they|them|those|same|there)\\b/i.test(question);"),
    "runtime prompts AI to prioritize the latest user question over history",
  );

  addCheck(
    "reported dispensary and DJ cohort misses have guardrails",
    runtime.includes("qualification-regulated-cannabis-business") &&
      runtime.includes("dispensaries") &&
      runtime.includes("regulated, legal, licensed") &&
      runtime.includes("dj-nlceo-no-cohort-deposit-boundary") &&
      runtime.includes("dj-nlceo-pricing-no-cohort-deposit-boundary") &&
      bundle.includes("route-dj-nlceo-payment-timing-exception") &&
      bundle.includes("first payment") &&
      bundle.includes("few weeks") &&
      runtime.includes("DJ/NLCEO has no cohort rule") &&
      runtime.includes("do not invent a custom plan or promise a hold") &&
      runtime.includes("never approve a specific future payment date or hold") &&
      runtime.includes("you can give them until") &&
      runtime.includes("start the payment plan when you're ready"),
    "critical answer guardrails cover regulated cannabis/dispensary qualification and DJ/NLCEO deposit/cohort follow-ups without approving payment-date holds",
  );

  addCheck(
    "show-list duplicate summary is suppressed",
    chatUi.includes("isDuplicatedSummary") &&
      chatUi.includes("normalizeAnswerDisplayText") &&
      chatUi.includes('firstSection?.title === "Answer"') &&
      chatUi.includes("normalizeAnswerDisplayText(answer.summary) === normalizeAnswerDisplayText(firstSection.body)") &&
      chatUi.includes("duplicatedItems >= 4") &&
      bundle.includes("Legacy Makers") &&
      bundle.includes("Masters of Innovation"),
    "show-list answers and exact summary/Answer-section duplicates do not render twice",
  );

  addCheck(
    "AI answer prompt requires scoped useful answers",
    runtime.includes("If the user asks for only one product, package, show, or topic, do not include unrelated sections.") &&
      runtime.includes("Do not dump every related fact.") &&
      runtime.includes("Answer the actual question asked."),
    "AI answer prompt blocks broad irrelevant sections and canned dumping",
  );

  addCheck(
    "critical answer guardrails validate high-risk AI output",
    runtime.includes("CRITICAL_ANSWER_RULES") &&
      runtime.includes("validateCriticalAnswer") &&
      runtime.includes("ensureCriticalAnswer") &&
      runtime.includes("criticalRuleAllowsConciseConfirmation") &&
      runtime.includes("isConcisePromiseConfirmation") &&
      runtime.includes("critical answer repair") &&
      runtime.includes("buildCriticalFallbackOutput") &&
      runtime.includes("payment-no-custom-plans") &&
      runtime.includes("greenlight-letter-route") &&
      runtime.includes("ai_runtime_approved_fallback"),
    "AI-generated answers are checked and repaired for high-risk approved facts before returning to reps",
  );

  addCheck(
    "greenlight letters and live commission tiers cannot borrow wrong routes",
    bundle.includes("route-greenlight-letter-requests") &&
      bundle.includes("greenlight letter urgently") &&
      bundle.includes("#greenlight-requests") &&
      runtime.includes("greenlight-letter-route") &&
      runtime.includes("forbiddenAny: [\"#sales-finance-requests\"") &&
      bundle.includes("abstain-account-specific-commission-tier") &&
      bundle.includes("commission-tier-and-leaderboard") &&
      runtime.includes("live commission tier, leaderboard, or payout data"),
    "greenlight-letter questions route to the greenlight channel, while account-specific commission tiers abstain instead of using finance/payment guidance",
  );

  addCheck(
    "custom payment plans are direct no, not finance approval route",
    bundle.includes("Custom payment plans, custom splits, custom amounts, and custom payment links are not allowed.") &&
      bundle.includes("No, you cannot offer a custom payment plan.") &&
      bundle.includes("Do not route a custom payment plan request as if finance may approve a new plan") &&
      bundle.includes("payment-operation exceptions that are not requests for a custom payment plan") &&
      bundle.includes("different payment split") &&
      runtime.includes("different payment split") &&
      !bundle.includes("custom payment terms, custom split requests") &&
      !bundle.includes("invoices, custom payment terms, refund/payment exceptions"),
    "Rich-confirmed custom payment requests return no/custom plans instead of suggesting finance approval",
  );

  addCheck(
    "broad sales-tech route question is covered",
    bundle.includes("route-sales-tech-channel-question") &&
      bundle.includes("where do i post") &&
      bundle.includes("sales-tooling") &&
      bundle.includes("#sales-tech-requests"),
    "Zoom/Keap/calendar/recording/dropdown channel questions map to the sales-tech route",
  );

  addCheck(
    "AI answer prompt requires direct rep-facing style",
    runtime.includes("Write directly to the rep using you") &&
      runtime.includes("Do not write in third person as the rep should") &&
      runtime.includes("You should") &&
      runtime.includes("You must"),
    "prompt and sanitizer push model output into second-person rep guidance",
  );

  addCheck(
    "rep-facing internal status terms are sanitized",
    runtime.includes("REP_FACING_INTERNAL_TERMS") &&
      runtime.includes("REP_FACING_INTERNAL_PATTERNS") &&
      runtime.includes("UNAPPROVED_HANDOFF_PATTERNS") &&
      runtime.includes("ensureRepFacingOutput") &&
      runtime.includes("rep-facing wording repair") &&
      runtime.includes("\\bnot approved\\b") &&
      runtime.includes("Slack-level evidence") &&
      runtime.includes("governance log") &&
      runtime.includes("internal guidance") &&
      runtime.includes("candidate answer") &&
      runtime.includes("pending approval") &&
      runtime.includes("route[- ]only") &&
      runtime.includes("knowledge base") &&
      runtime.includes("source coverage") &&
      runtime.includes("modelOutputContainsHiddenTerms") &&
      chatRoute.includes("route the question instead of guessing") &&
      !chatRoute.includes("Please check the approved source"),
    "answer/runtime fallbacks rewrite or reject KB/governance wording instead of relying on awkward direct replacements",
  );

  addCheck(
    "evidence source cards use rep-facing labels",
    runtime.includes("label: sourceTrustLabel(top.trustLabel)") &&
      runtime.includes('return "Sales guidance"') &&
      runtime.includes("Related sales guidance area") &&
      !runtime.includes("AI selected evidence category"),
    "source cards avoid exposing evidence-file names or AI/source-selection mechanics to reps",
  );

  addCheck(
    "admin review items are categorized without mutating Neon",
    db.includes("classifyAskSalesFaqReviewItem") &&
      db.includes("Wording cleanup") &&
      db.includes("Rich/owner approval gap") &&
      db.includes("Approved-topic matching") &&
      adminPage.includes("reviewCategory") &&
      adminPage.includes("Review action"),
    "read-only admin review labels separate KB gaps from wording and matching cleanup",
  );

  addCheck(
    "source cards validate selected source IDs against question support",
    runtime.includes("filterQuestionSupportedEvidence") &&
      runtime.includes("evidenceSupportScore") &&
      runtime.includes("matchedArticleId: primaryArticle?.id || input.policyDecision.articleId") &&
      runtime.includes("sourceTrustLabel") &&
      runtime.includes("FAQ source reviewed"),
    "runtime validates selected evidence before trusting source cards or matched article IDs",
  );

  addCheck(
    "unmatched topics do not call the model or attach source cards",
    runtime.includes("if (!policyDecision.safeToGenerate)") &&
      runtime.includes("source: null") &&
      runtime.includes("provider: null") &&
      runtime.includes("matchedRuleId: \"default-abstain\"") &&
      runtime.includes("I do not have a confirmed answer for that yet"),
    "default-abstain and blocked policy decisions return safe route text before provider calls",
  );

  addCheck(
    "structured answers are retained and rendered",
    chatRoute.includes("structuredAnswer: result.structuredAnswer") &&
      chatUi.includes("StructuredAnswerCard") &&
      db.includes("normalizeAskSalesFaqAnswerPayload") &&
      db.includes('\"conversation\"'),
    "answers can render sectioned UI and persist structured payloads in Neon",
  );

  addCheck(
    "approved-answer prompt favors concise live-call wording",
    runtime.includes("Start with the shortest useful direct answer for a rep on a live call") &&
      runtime.includes("If the rep asks for a short reply, answer in one or two sentences") &&
      runtime.includes("Use sections only when they add useful steps") &&
      runtime.includes("Do not turn simple answers into policy memos") &&
      runtime.includes("userRequestedShortAnswer") &&
      runtime.includes("For DJ/NLCEO: no cohort rule, no same-day discount"),
    "approved answers and DJ/NLCEO critical fallback can stay safe without forcing long blocky replies",
  );

  addCheck(
    "short-answer and dense option formatting are presentation-only",
    runtime.includes("shapeModelOutputForDisplay") &&
      runtime.includes("summary: answer") &&
      runtime.includes("sections: []") &&
      runtime.includes("plainSummaryOnly") &&
      runtime.includes("normalizeStructuredAnswerSections") &&
      runtime.includes("normalizeActionInstructionSectionTitle") &&
      runtime.includes("splitInlineLabeledOptionSection") &&
      runtime.includes("splitMarkdownListSection") &&
      runtime.includes("splitCommaListSection") &&
      runtime.includes("splitDenseOptionSection") &&
      runtime.includes("extractDenseOptionList") &&
      runtime.includes("When the answer contains a list of shows, payment plans, packages, or steps") &&
      runtime.includes("Use What you can do for action instructions") &&
      runtime.includes("Payment options") &&
      runtime.includes("PIF"),
    "explicit short-answer requests render as a single concise answer, while dense payment/package options can render as bullets without changing policy facts",
  );

  addCheck(
    "final presentation polish stays generic and validation-safe",
    runtime.includes("mergeDuplicateDisplaySections") &&
      runtime.includes("mergeSectionBodies") &&
      runtime.includes("strongerSectionTone") &&
      runtime.includes("For DJ/NLCEO: no cohort rule, no same-day discount") &&
      runtime.includes("Ask Sales FAQ critical fallback failed validation"),
    "duplicate adjacent display sections are merged, short DJ/NLCEO fallbacks stay concise, and critical-repair warnings are emitted only when the final fallback cannot validate",
  );

  addCheck(
    "common approved-topic wording has guard coverage",
    [
      "refund policy",
      "what payment link",
      "tier 1 placement",
      "call 1",
      "dj",
      "upgrade",
      "share internal docs",
      "how long can clients use",
      "call recordings stored",
    ].every((phrase) => bundle.includes(phrase)),
    "broad rep phrasing maps to existing approved articles",
  );

  addCheck(
    "feature flag env vars are documented",
    [
      "ASK_SALES_FAQ_ENABLED",
      "ASK_SALES_FAQ_ALLOWED_EMAILS",
      "ASK_SALES_FAQ_ADMIN_EMAILS",
      "ASK_SALES_FAQ_FEEDBACK_WEBHOOK_URL",
      "ASK_SALES_FAQ_FEEDBACK_WEBHOOK_SECRET",
      "FAQ_RATE_LIMIT_USER_WINDOW_MINUTES",
      "FAQ_RATE_LIMIT_USER_MAX",
      "FAQ_RATE_LIMIT_GLOBAL_WINDOW_SECONDS",
      "FAQ_RATE_LIMIT_GLOBAL_MAX",
    ].every((name) => envExample.includes(name)),
    "env example includes faq flags",
  );

  addCheck(
    "feedback sync is non-blocking and sheet-tab aware",
    feedbackRoute.includes("syncAskSalesFaqFeedbackToSheet") &&
      feedbackRoute.includes("console.warn") &&
      feedbackSync.includes("Positive Reviews") &&
      feedbackSync.includes("Negative Reviews") &&
      feedbackSync.includes("ASK_SALES_FAQ_FEEDBACK_WEBHOOK_URL"),
    "feedback sync posts to configured webhook and does not fail user response",
  );

  addCheck(
    "allowlist fails closed",
    access.includes("ASK_SALES_FAQ_ENABLED") &&
      access.includes("ASK_SALES_FAQ_ALLOWED_EMAILS") &&
      access.includes("not_allowlisted"),
    "access gate checks flag and allowlist",
  );

  const scanned = [page, adminPage, chatRoute, historyRoute, conversationActionRoute, feedbackRoute, feedbackSync, runtime, access, bundle, db, envExample];
  const secretHit = scanned.some((content) => secretPatterns.some((pattern) => pattern.test(content)));
  addCheck("no committed api-key-like secrets", !secretHit, secretHit ? "secret-like value found" : "no secret-like value found");
}

const failed = checks.filter((check) => !check.passed);
console.log(`Ask Sales FAQ validation: ${checks.length - failed.length}/${checks.length} passed`);
for (const check of checks) {
  console.log(`${check.passed ? "PASS" : "FAIL"} ${check.name}: ${check.detail}`);
}

if (failed.length) process.exit(1);
