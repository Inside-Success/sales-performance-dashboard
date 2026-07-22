import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { parseV4AdjudicationProvenance, parseV4GoldNeeds, type V4GoldReferenceCatalog } from "@/lib/ask-sales-faq/v4/adjudication";
import { getMaterializedV3Registry } from "@/lib/ask-sales-faq/v3/admin-approved-releases";
import { getV4RouteCatalog } from "@/lib/ask-sales-faq/v4/corpus";

type FixturePrompt = {
  question: string;
  sourceCohort: string;
  sourceRef: string;
  productionLogId?: string;
  productionAnswer?: string;
  productionNeedsRoute?: boolean;
  goldNeeds: unknown;
};

type Fixture = {
  name: string;
  promptCount: number;
  conversationCount: number;
  adjudication: unknown;
  conversations: Array<{ id: string; prompts: FixturePrompt[] }>;
};

function fixture(name: string) {
  return JSON.parse(readFileSync(new URL(`./${name}`, import.meta.url), "utf8")) as Fixture;
}

const fresh = fixture("v4-fresh-slack-source-gold-2026-07-22.json");
const replay = fixture("v4-live-v3-log-replay-2026-07-22.json");
const registry = getMaterializedV3Registry();
const catalog: V4GoldReferenceCatalog = {
  policies: registry.policies.map((policy) => ({ id: policy.id, decisionKey: policy.decision_key, policyKey: policy.policy_key })),
  blockedTopics: registry.blocked_topics.map((topic) => ({ id: topic.id })),
  routeKeys: Object.keys(getV4RouteCatalog()),
};

function prompts(value: Fixture) {
  return value.conversations.flatMap((conversation) => conversation.prompts);
}

function validatesAgainstCurrentGoldSchema(value: Fixture) {
  expect(value.conversationCount).toBe(value.conversations.length);
  expect(value.promptCount).toBe(prompts(value).length);
  const provenance = parseV4AdjudicationProvenance(value.adjudication, registry.knowledge_version);
  expect(provenance?.knowledgeVersion).toBe(registry.knowledge_version);
  for (const prompt of prompts(value)) {
    expect(prompt.question.trim()).not.toBe("");
    expect(parseV4GoldNeeds(prompt.goldNeeds, catalog).length).toBeGreaterThan(0);
  }
}

describe("Ask Sales V4 fresh and production-replay evaluation fixtures", () => {
  it("binds every atomic gold need to the current materialized knowledge and route schema", () => {
    validatesAgainstCurrentGoldSchema(fresh);
    validatesAgainstCurrentGoldSchema(replay);
    expect(registry.knowledge_version).toBe("8c8c677c1209f2d7");
  });

  it("keeps fresh Slack cases source-traceable and free of captured system answers", () => {
    for (const prompt of prompts(fresh)) {
      expect(prompt.sourceCohort).toBe("fresh_slack_authoritative_thread");
      expect(prompt.sourceRef).toMatch(/^https:\/\/istvoffical\.slack\.com\/archives\/C0AUQKNR8CF\/p\d+$/);
      expect(prompt.productionAnswer).toBeUndefined();
    }
  });

  it("keeps production replay cases bound to redacted log IDs and captured V3 behavior", () => {
    for (const prompt of prompts(replay)) {
      expect(prompt.sourceCohort).toBe("production_v3_log");
      expect(prompt.productionLogId).toMatch(/^launch-\d{3}$/);
      expect(prompt.productionAnswer?.trim()).not.toBe("");
      expect(typeof prompt.productionNeedsRoute).toBe("boolean");
    }
  });
});
