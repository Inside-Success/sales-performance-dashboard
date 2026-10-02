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
  // October 2 reporting cutover: retain older facts, attach current scope/exception.
  "claim_8a9cf2f0ece51838": ["hubspot-daily-stats-cutover-2026-10-03"],
  "claim_23274f39a5e133fd": ["hubspot-daily-stats-cutover-2026-10-03"],
  "claim_fd73c21ee3b825f1": ["hubspot-daily-stats-cutover-2026-10-03"],
  "claim_2b5b531c2d6e5d3d": ["hubspot-daily-stats-cutover-2026-10-03"],
  "claim_b0d064824b8f2a21": ["hubspot-daily-stats-cutover-2026-10-03"],
  "claim_f138747b82ed9495": ["hubspot-daily-stats-cutover-2026-10-03"],
  "claim_73ef5411048af18b": ["hubspot-daily-stats-cutover-2026-10-03"],
  "claim_242239cf725f61e5": ["hubspot-daily-stats-cutover-2026-10-03"],
  "operational_8ac4fa24ec5beb59": ["hubspot-daily-stats-cutover-2026-10-03"],
  "operational_f6f8facb8dc13152": ["hubspot-daily-stats-cutover-2026-10-03"],
  "operational_7afd712d2bbe5dc4": ["hubspot-daily-stats-cutover-2026-10-03"],
  "curated_v43_daily_stats_workflow": ["hubspot-daily-stats-cutover-2026-10-03"],
  "operational_430eec4ecc808667": ["hubspot-daily-stats-cutover-2026-10-03"],
  "operational_19b3a45cd89cd084": ["hubspot-daily-stats-cutover-2026-10-03"],
  "operational_bea0a3490da994ff": ["hubspot-daily-stats-cutover-2026-10-03"],
  "operational_ed3a886f347a4fce": ["hubspot-daily-stats-cutover-2026-10-03"],
  "operational_a5d452de2a7975bd": ["hubspot-daily-stats-cutover-2026-10-03"],
  "operational_97abb111f0fc60c9": ["hubspot-daily-stats-cutover-2026-10-03"],
  "operational_fa593fb4843c7bb8": ["hubspot-daily-stats-cutover-2026-10-03"],
  "operational_ff1a8382e15d26a3": ["hubspot-daily-stats-cutover-2026-10-03"],
  "operational_d10b4c2257d9126c": ["hubspot-daily-stats-cutover-2026-10-03"],
  "operational_60c9077057f0507c": ["hubspot-daily-stats-cutover-2026-10-03"],
  "operational_481cd47364011710": ["hubspot-daily-stats-cutover-2026-10-03"],
  "operational_2c477b63e870a30f": ["hubspot-daily-stats-cutover-2026-10-03"],
  "operational_2474e09dd890b777": ["hubspot-daily-stats-cutover-2026-10-03"],
  "operational_edfd5059826a93e6": ["hubspot-daily-stats-cutover-2026-10-03"],
  "operational_8e0c761dc6754860": ["hubspot-daily-stats-cutover-2026-10-03"],
  "operational_b24c75593645105b": ["hubspot-daily-stats-cutover-2026-10-03"],
  "operational_f81371b0c74602d4": ["hubspot-daily-stats-cutover-2026-10-03"],
  "operational_0dbc2d1def04543b": ["hubspot-daily-stats-cutover-2026-10-03"],
  "operational_bfea219b8ec7a5ee": ["hubspot-daily-stats-cutover-2026-10-03"],
  "operational_ebff7f4c88421ca7": ["hubspot-daily-stats-cutover-2026-10-03"],
  "operational_acbac4cb0c06b822": ["hubspot-daily-stats-cutover-2026-10-03"],
  "operational_851a3a454fa38f08": ["hubspot-daily-stats-cutover-2026-10-03"],
  "operational_82036b75562e3c4f": ["hubspot-daily-stats-cutover-2026-10-03"],
  "operational_4331b007f2a15e94": ["hubspot-daily-stats-cutover-2026-10-03"],
  "operational_49fb799621c35e99": ["hubspot-daily-stats-cutover-2026-10-03"],
  "operational_200b8f09c6c05172": ["hubspot-daily-stats-cutover-2026-10-03"],
  "operational_66d166166988f4a0": ["hubspot-daily-stats-cutover-2026-10-03"],
  "operational_3f573a35b76973e6": ["hubspot-daily-stats-cutover-2026-10-03"],
  "operational_a48b5cc65ffadb3d": ["hubspot-daily-stats-cutover-2026-10-03"],
  "operational_c19404089ff40541": ["hubspot-daily-stats-cutover-2026-10-03"],

  [v514.V514_CURRENT_PRICES_AND_PLANS_POLICY.id]: ["main-lite-complete-deliverables", "main-standard-complete-deliverables", "main-vip-complete-deliverables", v514.V514_CALL2_QUOTE_SEQUENCE_POLICY.id],
  kr_7ace400fcdf68db9: ["active-show-list-resource"],
  operational_112edff8e7218415: ["reapply-context-and-current-guidance"],
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
