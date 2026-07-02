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
      runtime.includes("policy-aware-rag-index.json"),
    "runtime imports approved bundle and server-side RAG index",
  );

  addCheck(
    "runtime has safe fallback behavior",
    runtime.includes("AI_UNAVAILABLE_RESPONSE") && runtime.includes("buildUnavailableDecision"),
    "runtime returns a safe user-facing message instead of raw errors when AI is unavailable",
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
    "bundle has eight approved articles",
    (bundle.match(/approvedAt: "2026-06-30"/g) || []).length === 8,
    "bundle contains 8 approved articles",
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
      runtime.includes("buildEvidenceCandidates"),
    "runtime asks the model to select evidence semantically inside the answer call",
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
    "follow-up questions include recent chat context",
    chatRoute.includes("runAskSalesFaq(lastMessage.content, messages)") &&
      runtime.includes("buildConversationContext") &&
      runtime.includes("The current user question is authoritative."),
    "runtime sends recent conversation context to AI while keeping current question authoritative",
  );

  addCheck(
    "current question intent is not overwritten by old chat context",
    runtime.includes("CURRENT USER QUESTION:") &&
      runtime.includes("Use conversation context only to resolve short or ambiguous follow-ups.") &&
      !runtime.includes("const decision = decideQuestion(contextualQuestion)") &&
      !runtime.includes("/\\b(it|that|this|they|them|those|same|there)\\b/i.test(question);"),
    "runtime prompts AI to prioritize the latest user question over history",
  );

  addCheck(
    "show-list duplicate summary is suppressed",
    chatUi.includes("isDuplicatedSummary") &&
      chatUi.includes("duplicatedItems >= 4") &&
      bundle.includes("Legacy Makers") &&
      bundle.includes("Masters of Innovation"),
    "show-list answers do not render the full list twice",
  );

  addCheck(
    "AI answer prompt requires scoped useful answers",
    runtime.includes("If the user asks for only one product, package, show, or topic, do not include unrelated sections.") &&
      runtime.includes("Do not dump every related fact.") &&
      runtime.includes("Answer the actual question asked."),
    "AI answer prompt blocks broad irrelevant sections and canned dumping",
  );

  addCheck(
    "structured answers are retained and rendered",
    chatRoute.includes("structuredAnswer: result.structuredAnswer") &&
      chatUi.includes("StructuredAnswerCard") &&
      db.includes("normalizeAskSalesFaqAnswerPayload"),
    "answers can render sectioned UI and persist structured payloads in Neon",
  );

  addCheck(
    "common approved-topic wording has guard coverage",
    [
      "refund policy",
      "what payment link",
      "tier 1 placement",
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
