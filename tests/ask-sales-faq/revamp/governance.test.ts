import { describe,it,expect,vi,afterEach } from "vitest";
import { getRevampRegistry,getRevampKnowledge } from "../../../src/lib/ask-sales-faq/revamp/knowledge";
import { getKnowledgeRefreshEffectiveRegistry,knowledgeReleasePaths } from "../../../src/lib/ask-sales-faq/revamp/governance";
import { policyToEvidence } from "../../../src/lib/ask-sales-faq/revamp/policy-adapter";
import { buildV3AdminApprovedRelease,materializeV3Registry,previewV3AdminApprovedRelease,getMaterializedV3Registry } from "../../../src/lib/ask-sales-faq/v3/admin-approved-releases";
afterEach(()=>vi.unstubAllEnvs());
describe("candidate governance shares the effective runtime registry",()=>{
 it("selects legacy unchanged and candidate only explicitly",()=>{
  vi.stubEnv("ASK_SALES_FAQ_RUNTIME_VERSION","v5.14");
  expect(getKnowledgeRefreshEffectiveRegistry()).toEqual(getMaterializedV3Registry());
  vi.stubEnv("ASK_SALES_FAQ_RUNTIME_VERSION","revamp");
  expect(getKnowledgeRefreshEffectiveRegistry()).toBe(getRevampRegistry());
  expect(getRevampKnowledge().map(p=>p.id)).toEqual(getKnowledgeRefreshEffectiveRegistry().policies.map(p=>p.id));
  expect(knowledgeReleasePaths("revamp").faq).toBe("runtime/revamp-admin-approved-releases.json");
 });
 it("admin preview retires an operational policy from candidate evidence and rejects stale base",()=>{
  const current=getRevampRegistry();
  const old=current.policies.find(p=>p.id.startsWith("operational_"))!;
    const entry = buildV3AdminApprovedRelease({
      releaseId: "kr_test_supersession",
      preparedAt: "2026-07-18T20:10:00.000Z",
      preparedBy: "admin@example.com",
      baseKnowledgeVersion: current.knowledge_version,
      candidates: [{
        id: "candidate_supersession",
        title: "Approved replacement test policy",
        summary: "A precise replacement for one governed test policy.",
        proposedPolicy: "This exact-admin test fixture replaces the selected previous policy.",
        decisionKey: old.decision_key,
        productScopes: old.product_scopes,
        domains: old.domains,
        actions: old.actions,
        entities: old.entities,
        policyObject: old.title,
        conditions: null,
        effectiveDate: "2026-07-18",
        answerImpact: "material",
        sourceAuthority: "owner_confirmed",
        authorityName: "Rich",
        authorityBasis: "Owner-confirmed test fixture",
        sourceId: "google_doc:test",
        sourceLabel: "Test document",
        sourceRevision: "revision-1",
        evidenceQuotes: ["This fixture replaces the selected previous policy."],
        snapshotHash: "b".repeat(64),
        approvedBy: "admin@example.com",
        approvedAt: "2026-07-18T20:05:00.000Z",
        conflictLevel: "direct",
        conflictResolution: "supersede",
        conflictingPolicyIds: [old.id],
        blockedTopicIds: [],
      }],
    });
    const materialized = materializeV3Registry(current, { schema_version: 1, description: "test", releases: [entry] });
    expect(materialized.policies.some((policy) => policy.id === old.id)).toBe(false);
    expect(materialized.superseded_policies?.some((policy) => policy.id === old.id)).toBe(true);
    expect(() => materializeV3Registry(current, {
      schema_version: 1,
      description: "test",
      releases: [{ ...entry, base_knowledge_version: "stale-version" }],
    })).toThrow(/built for knowledge/);
  const preview=previewV3AdminApprovedRelease(entry,current);
  expect(preview).toEqual(materialized);
  expect(preview.policies.map(policyToEvidence).some(p=>p.id===old.id)).toBe(false);
  expect(preview.policies.map(policyToEvidence).some(p=>p.id===entry.policies[0].id)).toBe(true);
  expect(getRevampRegistry().policies.some(p=>p.id===old.id)).toBe(true);
 });
});
