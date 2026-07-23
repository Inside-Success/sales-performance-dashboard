import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => readFileSync(path.join(root, file), "utf8");
const checks = [];
const V4_RELEASE_BRANCHES = [
  "agent/ask-sales-v4-isolated-2026-07-21",
  "agent/ask-sales-v4-systemic-knowledge-2026-07-22",
];

function check(name, condition, detail) {
  checks.push({ name, condition: Boolean(condition), detail });
}

function resolveLocalImport(importer, specifier) {
  let base;
  if (specifier.startsWith("@/")) base = path.join(root, "src", specifier.slice(2));
  else if (specifier.startsWith(".")) base = path.resolve(path.dirname(importer), specifier);
  else return null;
  const candidates = [base, ...[".ts", ".tsx", ".js", ".mjs", ".json"].map((extension) => `${base}${extension}`), ...[".ts", ".tsx", ".js", ".mjs"].map((extension) => path.join(base, `index${extension}`))];
  return candidates.find((candidate) => existsSync(candidate)) || null;
}

function localDependencyClosure(entry) {
  const pending = [path.join(root, entry)];
  const visited = new Set();
  const importPattern = /(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']|(?:import|require)\s*\(\s*["']([^"']+)["']\s*\)/g;
  while (pending.length) {
    const file = pending.pop();
    if (!file || visited.has(file)) continue;
    visited.add(file);
    if (file.endsWith(".json")) continue;
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(importPattern)) {
      const resolved = resolveLocalImport(file, match[1] || match[2]);
      if (resolved && !visited.has(resolved)) pending.push(resolved);
    }
  }
  return [...visited];
}

const selector = read("src/lib/ask-sales-faq/runtime-selector.ts");
const productionRoute = read("src/app/api/ask-sales-faq/route.ts");
const isolatedRoute = read("src/app/api/ask-sales-faq/v4-isolated/route.ts");
const systemicIsolatedRoute = read("src/app/api/ask-sales-faq/v4-systemic-isolated/route.ts");
const v5IsolatedRoute = read("src/app/api/ask-sales-faq/v5-isolated/route.ts");
const isolatedRoutes = [isolatedRoute, systemicIsolatedRoute, v5IsolatedRoute];
const isolation = read("src/lib/ask-sales-faq/v4/isolation.ts");
const historyToken = read("src/lib/ask-sales-faq/v4/history-token.ts");
const runtime = read("src/lib/ask-sales-faq/v4/runtime.ts");
const provider = read("src/lib/ask-sales-faq/v4/provider.ts");
const proxy = read("src/proxy.ts");
const appHeader = read("src/components/dashboard/app-header.tsx");
const labPage = read("src/app/ask-sales-faq/v4-lab/page.tsx");
const systemicLabPage = read("src/app/ask-sales-faq/v4-systemic-lab/page.tsx");
const v5LabPage = read("src/app/ask-sales-faq/v5-lab/page.tsx");
const labUi = read("src/components/ask-sales-faq/ask-sales-v4-lab.tsx");
const vercelConfig = JSON.parse(read("vercel.json"));
const deploymentEnabled = vercelConfig?.git?.deploymentEnabled;
const deploymentEntries = deploymentEnabled && typeof deploymentEnabled === "object" && !Array.isArray(deploymentEnabled)
  ? Object.entries(deploymentEnabled)
  : [];
const v4Dependencies = [...new Set([
  ...localDependencyClosure("src/app/api/ask-sales-faq/v4-isolated/route.ts"),
  ...localDependencyClosure("src/app/api/ask-sales-faq/v4-systemic-isolated/route.ts"),
  ...localDependencyClosure("src/app/api/ask-sales-faq/v5-isolated/route.ts"),
])];
const relativeV4Dependencies = v4Dependencies.map((file) => path.relative(root, file));
const forbiddenPersistenceImport = relativeV4Dependencies.find((file) =>
  /(?:^|\/)(?:db|database|neon|conversation-history|feedback-sync|quality-review-store|knowledge-refresh-store)(?:\.|\/|$)/i.test(file),
);
const transitiveSources = v4Dependencies.filter((file) => !file.endsWith(".json")).map((file) => readFileSync(file, "utf8")).join("\n");

check(
  "production selector remains V2/V3 only",
  !selector.includes("v4") && !selector.includes("v5") && selector.includes("runAskSalesFaqV3") && selector.includes('? "v3" : "v2"'),
  "The production runtime selector must not import or select V4/V5.",
);
check(
  "production API route does not import isolated V4",
  !productionRoute.includes("v4-isolated") && !productionRoute.includes("v5-isolated") && !productionRoute.includes("runAskSalesFaqV4") && !productionRoute.includes("runAskSalesFaqV5"),
  "The normal Ask Sales endpoint must stay on the production selector.",
);
check(
  "V4 Git publication is disabled only for the exact isolated branches",
  deploymentEntries.length === V4_RELEASE_BRANCHES.length &&
    V4_RELEASE_BRANCHES.every((branch) => deploymentEnabled?.[branch] === false) &&
    deploymentEnabled !== false,
  "Vercel Git auto-deployment must be disabled only for the isolated V4 branches, never globally or for main.",
);
check(
  "V4 containment config does not alter production build behavior",
  vercelConfig.ignoreCommand === undefined &&
    vercelConfig.buildCommand === undefined &&
    vercelConfig.installCommand === undefined &&
    vercelConfig.outputDirectory === undefined &&
    vercelConfig.framework === undefined &&
    vercelConfig.github === undefined &&
    deploymentEnabled?.main !== false &&
    deploymentEnabled?.production !== false &&
    deploymentEnabled?.["*"] !== false,
  "The branch containment file must not add a broad skip, legacy Git override, or production/build setting.",
);
check(
  "V4 is enabled only in an explicit Vercel Preview",
  isolation.includes('process.env.VERCEL_ENV === "preview"') &&
    isolation.includes('process.env[V4_ISOLATION_FLAG] === "true"') &&
    !isolation.includes('process.env.VERCEL_ENV !== "production"'),
  "Both the page gate and runtime assertion must fail closed outside an explicit Vercel Preview.",
);
check(
  "V4 requires a capability token",
  isolatedRoutes.every((route) => route.includes("isV4LabTokenAuthorized")) && isolation.includes("timingSafeEqual") && isolation.includes("length < 24"),
  "Every clean-room route must require a constant-time checked token of at least 24 characters.",
);
check(
  "V4 requires separately encrypted stateless history",
  isolation.includes("process.env.ASK_SALES_V4_HISTORY_SIGNING_SECRET") &&
    isolation.includes("length < 32") &&
    historyToken.includes("createCipheriv") &&
    historyToken.includes("createDecipheriv") &&
    historyToken.includes('createHash("sha256"') &&
    historyToken.includes('createCipheriv("aes-256-gcm"') &&
    historyToken.includes('createDecipheriv("aes-256-gcm"') &&
    historyToken.includes("cipher.setAAD(V4_HISTORY_AAD)") &&
    historyToken.includes("decipher.setAAD(V4_HISTORY_AAD)") &&
    historyToken.includes("decipher.setAuthTag(authenticationTag)") &&
    historyToken.includes("cipher.getAuthTag()") &&
    historyToken.includes('const V4_HISTORY_AUDIENCE = "ask-sales-v4-isolated-history"') &&
    historyToken.includes("payload.kv !== input.knowledgeVersion") &&
    historyToken.includes("payload.rv !== runtimeRevision()") &&
    historyToken.includes("payload.exp > now") &&
    isolatedRoutes.every((route) => route.includes("V4HistoryTokenError") && route.includes("}, 409)")),
  "Client-supplied assistant text must never become V4 history; only short-lived AES-GCM-encrypted server observations may be reused.",
);
check(
  "V4 lab accepts only the strict question and encrypted-history contract",
  isolatedRoutes.every((route) =>
    route.includes("question: z.string().trim().min(1).max(6000)") &&
    route.includes("historyToken: z.string().min(1).max(64 * 1024).optional()") &&
    route.includes("}).strict()") &&
    !route.includes("messages: z.array")) &&
    labUi.includes("...(historyToken ? { historyToken } : {})") &&
    labUi.includes("setHistoryToken(null)") &&
    !labUi.includes("requestMessages") &&
    !labUi.includes("localStorage") &&
    !labUi.includes("sessionStorage"),
  "The browser may render its own transcript, but the API trusts only the current question plus a server-encrypted in-memory history token.",
);
check(
  "V4 page auth bypass is exact and Preview-only",
  proxy.includes('const V4_LAB_PATHS = new Set(["/ask-sales-faq/v4-lab", "/ask-sales-faq/v4-systemic-lab", "/ask-sales-faq/v5-lab"])') &&
    proxy.includes("V4_LAB_PATHS.has(pathname)") &&
    !proxy.includes("pathname.startsWith") &&
    proxy.includes('process.env.ASK_SALES_V4_ISOLATED === "true"') &&
    proxy.includes('process.env.VERCEL_ENV === "preview"') &&
    appHeader.includes('requestHeaders.get("x-ask-sales-v4-lab-request") === "1"'),
  "Only the exact lab page may bypass dashboard auth, and only in an isolated Vercel Preview.",
);
check(
  "V4 route dependency graph is persistence-free",
  !forbiddenPersistenceImport &&
    isolatedRoutes.every((route) => route.includes("persistence: false")) &&
    runtime.includes("databaseWrites: false") &&
    runtime.includes("historyPersistence: false") &&
    !/\b(?:sql|neon)\s*\(/.test(transitiveSources),
  forbiddenPersistenceImport
    ? `Forbidden persistence dependency found: ${forbiddenPersistenceImport}`
    : `No persistence module or SQL/Neon call is reachable across ${relativeV4Dependencies.length} local dependencies.`,
);
check(
  "V4 remains non-indexable",
  isolatedRoutes.every((route) => route.includes("noindex, nofollow, noarchive")) &&
    [labPage, systemicLabPage, v5LabPage].every((page) => page.includes("noindex") || page.includes("index: false")),
  "The lab page and API responses must remain outside search indexing.",
);
check(
  "V4 direct provider uses only its isolated credential",
  provider.includes("process.env.ASK_SALES_V4_DEEPSEEK_API_KEY") &&
    !provider.includes("process.env.DEEPSEEK_API_KEY"),
  "Direct V4 must require its Preview-scoped credential and must never inherit the shared V3 DeepSeek key.",
);
check(
  "V4 providers are DeepSeek-only and bounded",
  provider.includes('process.env.ASK_SALES_V4_USE_VERCEL_GATEWAY === "true"') &&
    provider.includes("maxRetries: 0") &&
    provider.includes("timeout: 32_000") &&
    provider.includes('only: ["deepseek"]') &&
    provider.includes("const DIRECT_MAX_ATTEMPTS = 2") &&
    provider.includes("const deadlineAt = startedAt + directTimeoutSeconds() * 1000") &&
    provider.includes("const remainingMs = deadlineAt - Date.now()") &&
    provider.includes("setTimeout(() => controller.abort(), remainingMs)") &&
    provider.includes('fetch("https://api.deepseek.com/chat/completions"') &&
    provider.includes("Math.min(configured, 35)"),
  "Gateway must remain zero-retry; direct mode may retry once, but both attempts share one absolute 35-second-or-less stage deadline and remain DeepSeek-only.",
);
check(
  "hosted model access must be live-confirmed",
  isolatedRoutes.every((route) =>
    route.includes('process.env.ASK_SALES_V4_MODEL_ACCESS_CONFIRMED === "true"') &&
    route.includes("has not passed a live access check")),
  "Configuration alone must not make the hosted lab ready before the provider passes a real isolated access check.",
);
check(
  "no-model fallback is a stable deterministic whitelist",
  runtime.includes("SAFE_FALLBACK_POLICY_FAMILIES") &&
    runtime.includes("deterministicWhitelistPlan") &&
    runtime.includes("resolveV4PriorityPolicyFamily") &&
    !runtime.includes("highest-ranked applicable governed decision crossed the deterministic relevance floor"),
  "A provider outage must not turn broad similarity retrieval into direct answers.",
);

const failed = checks.filter((item) => !item.condition);
for (const item of checks) {
  console.log(`${item.condition ? "PASS" : "FAIL"} ${item.name}: ${item.detail}`);
}
console.log(`Ask Sales V4 isolation validation: ${checks.length - failed.length}/${checks.length} passed`);
if (failed.length) process.exitCode = 1;
