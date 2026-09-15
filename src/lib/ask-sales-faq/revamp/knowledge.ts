import "server-only";
import { createHash } from "node:crypto";
import { getV4SystemicCorpus } from "../v4/systemic/corpus";
import { V56_OWNER_CONFIRMED_POLICIES } from "../v5-6/knowledge";
import { V512_SOURCE_REVIEWED_POLICIES } from "../v5-12/knowledge";
import { V513_SOURCE_REVIEWED_POLICIES, V513_CURRENT_STUDIO_ADDRESS_POLICY } from "../v5-13/knowledge";
import * as v514 from "../v5-14/knowledge";
import authorityResolutions from "../v4/systemic/authority-resolutions.json";
import { getV4RouteCatalog } from "../v4/corpus";
import additions from "./knowledge-additions.json";
import releaseLedger from "./admin-approved-releases.json";
import { getMaterializedV3Registry, materializeV3Registry, type V3AdminApprovedReleaseLedger } from "../v3/admin-approved-releases";
import { evidenceToPolicy, policyToEvidence } from "./policy-adapter";
import { normalizeProductScopes } from "./retrieval";
import type { Evidence } from "./types";

// The old runtimes remain untouched. All candidate consumers use this snapshot.
export function reconcileEvidence(records: Evidence[]) {
  const byId = new Map(records.map(record => [record.id, record]));
  const visited = new Set<string>();
  const visiting = new Set<string>();
  function visit(id: string) {
    if (visiting.has(id)) throw new Error(`Cyclic evidence supersession: ${id}`);
    if (visited.has(id)) return;
    const record = byId.get(id);
    if (!record) throw new Error(`Unknown superseded evidence: ${id}`);
    visiting.add(id);
    record.supersedes.forEach(visit);
    visiting.delete(id);
    visited.add(id);
  }
  byId.forEach(record => visit(record.id));
  const retired = new Set([...byId.values()].flatMap(record => record.supersedes));
  // Supersession is explicit by ID. Recency alone cannot resolve different
  // products, exceptions, actors or genuinely conflicting statements.
  return [...byId.values()].filter(record => !retired.has(record.id));
}

const inherited = [
  ...getV4SystemicCorpus(), ...V56_OWNER_CONFIRMED_POLICIES, ...V512_SOURCE_REVIEWED_POLICIES,
  ...V513_SOURCE_REVIEWED_POLICIES, V513_CURRENT_STUDIO_ADDRESS_POLICY,
  v514.V514_ROI_BOUNDARY_POLICY, v514.V514_WEEKLY_SUPPORT_DISCONTINUED_POLICY,
  v514.V514_DOCTOR_NURSE_ELIGIBILITY_POLICY, v514.V514_CALL2_QUOTE_SEQUENCE_POLICY,
  v514.V514_CURRENT_PRICES_AND_PLANS_POLICY,
].filter(p => p.answerability !== "discovery_only" && !p.systemic.ownerReviewRequired).map((p): Evidence => ({
  id: p.id, decisionKey: p.decision_key, title: p.title, questions: p.question_families,
  text: p.decision, scopes: normalizeProductScopes(p.product_scopes), sourceIds: p.source.ids,
  reviewedAt: p.last_reviewed || p.effective_at, authority: p.authority,
  kind: "policy", risk: p.risk_level, routeKey: p.route_key,
  conditions: [p.answerability, p.systemic.scopeRisk, p.systemic.temporalRisk, "legacy_scope_not_verified_for_reality"], supersedes: [],
  domains: [...p.domains, ...([v514.V514_CURRENT_PRICES_AND_PLANS_POLICY.id,v514.V514_ROI_BOUNDARY_POLICY.id,"owner-dj-nlceo-current-offer-overview","kr_7ace400fcdf68db9"].includes(p.id) ? ["company_context"] : [])], actions: p.actions, entities: p.entities, sourceKind:p.source.kind, approvedBy:p.source.approved_by,
}));
// Preserve historical source adjudications as scoped evidence context rather
// than re-running the old question-family regex gates. Only explicitly global
// retirements disappear; claim-specific exclusions retain their other uses.
const resolutions = authorityResolutions.resolutions.filter(r=>r.status === "source_resolved");
const globallyRetired = new Set(resolutions.flatMap(r=>"globally_retired_policy_ids" in r ? r.globally_retired_policy_ids || [] : []));
const withAuthorityContext = inherited.filter(p=>!globallyRetired.has(p.id)).map(p=>({
  ...p,
  conditions: [...p.conditions, ...resolutions.filter(r=>(r.controlling_policy_ids as string[]).includes(p.id) || (r.excluded_policy_ids as string[]).includes(p.id)).flatMap(r=>[
    ...(r.controlling_policy_ids as string[]).filter(id=>id!==p.id).map(id=>`governing_evidence:${id}`),
    `${(r.excluded_policy_ids as string[]).includes(p.id) ? "Do not use this record to override the controlling decision" : "Controlling source decision"} for ${r.title}. Applicable scopes: ${r.product_scopes.join(", ")}. ${r.authority_basis}`])],
}));
// Related maintained records travel together: a price table alone cannot answer
// a benefits comparison, and a catalog without its resource cannot answer where.
const maintainedRelationships: Record<string, string[]> = {
  [v514.V514_CURRENT_PRICES_AND_PLANS_POLICY.id]: ["main-lite-complete-deliverables", "main-standard-complete-deliverables", "main-vip-complete-deliverables"],
  kr_7ace400fcdf68db9: ["active-show-list-resource"],
};
const allRecords = [...withAuthorityContext, ...additions as Evidence[]].map(record=>({
  ...record, conditions:[...record.conditions,...(maintainedRelationships[record.id]||[]).map(id=>`governing_evidence:${id}`)],
}));
const replacements = new Map(allRecords.flatMap(record=>record.supersedes.map(id=>[id,record.id] as const)));
const reconciled = reconcileEvidence(allRecords);
const activeIds = new Set(reconciled.map(record=>record.id));
const baseRecords = reconciled.map(record=>({...record,conditions:record.conditions.flatMap(condition=>{
  if(!condition.startsWith("governing_evidence:")) return [condition];
  let id=condition.slice("governing_evidence:".length);
  while(replacements.has(id)) id=replacements.get(id)!;
  return activeIds.has(id) && id!==record.id ? [`governing_evidence:${id}`] : [];
})}));
const baseVersion = createHash("sha256").update(JSON.stringify(baseRecords)).digest("hex").slice(0, 24);
const legacy = getMaterializedV3Registry();
const baseRegistry = { ...legacy, route_catalog: getV4RouteCatalog(), knowledge_version: baseVersion, policies: baseRecords.map(record => evidenceToPolicy(record, legacy)) };
const registry = materializeV3Registry(baseRegistry, releaseLedger as V3AdminApprovedReleaseLedger);
const records = registry.policies.map(policyToEvidence);
export const REVAMP_KNOWLEDGE_VERSION = registry.knowledge_version;
export function getRevampHistoricalKnowledge() { return withAuthorityContext; }
export function getRevampRegistry() { return registry; }
export function getRevampBaseRegistry() { return baseRegistry; }
export function getRevampKnowledge() { return records; }
export function getRevampKnowledgeSnapshot() { return { version: REVAMP_KNOWLEDGE_VERSION, records }; }
