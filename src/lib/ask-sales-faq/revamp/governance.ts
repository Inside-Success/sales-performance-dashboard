import "server-only";
import { getMaterializedV3Registry } from "../v3/admin-approved-releases";
import { getRevampRegistry } from "./knowledge";
export function selectedKnowledgeRuntime(): "revamp" | "v3" {
  return process.env.ASK_SALES_FAQ_RUNTIME_VERSION?.trim().toLowerCase() === "revamp" ? "revamp" : "v3";
}
/** Runtime, conflict review, release preview and production health share this registry. */
export function getKnowledgeRefreshEffectiveRegistry() {
  return selectedKnowledgeRuntime() === "revamp" ? getRevampRegistry() : getMaterializedV3Registry();
}
export function knowledgeReleasePaths(runtime: "revamp" | "v3") {
  return runtime === "revamp" ? {
    faq: "runtime/revamp-admin-approved-releases.json",
    dashboard: "src/lib/ask-sales-faq/revamp/admin-approved-releases.json",
  } : { faq: "runtime/v3-admin-approved-releases.json", dashboard: "src/lib/ask-sales-faq/generated/v3-admin-approved-releases.json" };
}
