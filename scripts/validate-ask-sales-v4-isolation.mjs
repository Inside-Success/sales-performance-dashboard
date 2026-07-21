import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => readFileSync(path.join(root, file), "utf8");
const checks = [];

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
const isolation = read("src/lib/ask-sales-faq/v4/isolation.ts");
const runtime = read("src/lib/ask-sales-faq/v4/runtime.ts");
const provider = read("src/lib/ask-sales-faq/v4/provider.ts");
const proxy = read("src/proxy.ts");
const appHeader = read("src/components/dashboard/app-header.tsx");
const labPage = read("src/app/ask-sales-faq/v4-lab/page.tsx");
const v4Dependencies = localDependencyClosure("src/app/api/ask-sales-faq/v4-isolated/route.ts");
const relativeV4Dependencies = v4Dependencies.map((file) => path.relative(root, file));
const forbiddenPersistenceImport = relativeV4Dependencies.find((file) =>
  /(?:^|\/)(?:db|database|neon|conversation-history|feedback-sync|quality-review-store|knowledge-refresh-store)(?:\.|\/|$)/i.test(file),
);
const transitiveSources = v4Dependencies.filter((file) => !file.endsWith(".json")).map((file) => readFileSync(file, "utf8")).join("\n");

check(
  "production selector remains V2/V3 only",
  !selector.includes("v4") && selector.includes("runAskSalesFaqV3") && selector.includes('? "v3" : "v2"'),
  "The production runtime selector must not import or select V4.",
);
check(
  "production API route does not import isolated V4",
  !productionRoute.includes("v4-isolated") && !productionRoute.includes("runAskSalesFaqV4"),
  "The normal Ask Sales endpoint must stay on the production selector.",
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
  isolatedRoute.includes("isV4LabTokenAuthorized") && isolation.includes("timingSafeEqual") && isolation.includes("length < 24"),
  "The clean-room route must require a constant-time checked token of at least 24 characters.",
);
check(
  "V4 page auth bypass is exact and Preview-only",
  proxy.includes("pathname === V4_LAB_PATH") &&
    proxy.includes('process.env.ASK_SALES_V4_ISOLATED === "true"') &&
    proxy.includes('process.env.VERCEL_ENV === "preview"') &&
    appHeader.includes('requestHeaders.get("x-ask-sales-v4-lab-request") === "1"'),
  "Only the exact lab page may bypass dashboard auth, and only in an isolated Vercel Preview.",
);
check(
  "V4 route dependency graph is persistence-free",
  !forbiddenPersistenceImport &&
    isolatedRoute.includes("persistence: false") &&
    runtime.includes("databaseWrites: false") &&
    runtime.includes("historyPersistence: false") &&
    !/\b(?:sql|neon)\s*\(/.test(transitiveSources),
  forbiddenPersistenceImport
    ? `Forbidden persistence dependency found: ${forbiddenPersistenceImport}`
    : `No persistence module or SQL/Neon call is reachable across ${relativeV4Dependencies.length} local dependencies.`,
);
check(
  "V4 remains non-indexable",
  isolatedRoute.includes("noindex, nofollow, noarchive") && (labPage.includes("noindex") || labPage.includes("index: false")),
  "The lab page and API responses must remain outside search indexing.",
);
check(
  "V4 provider is bounded and opt-in",
  provider.includes('process.env.ASK_SALES_V4_USE_VERCEL_GATEWAY === "true"') &&
    provider.includes("maxRetries: 0") &&
    provider.includes("timeout: 32_000") &&
    provider.includes('only: ["deepseek"]'),
  "The isolated model path must be explicitly enabled, DeepSeek-only, non-retrying, and time-bounded.",
);
check(
  "hosted model access must be live-confirmed",
  isolatedRoute.includes('process.env.ASK_SALES_V4_MODEL_ACCESS_CONFIRMED === "true"') &&
    isolatedRoute.includes("has not passed a live access check"),
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
