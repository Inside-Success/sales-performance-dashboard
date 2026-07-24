import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

type Candidate = { parentTs: string };
type Selection = {
  runtimeFreezeCommit: string;
  threadRepliesOpenedBeforeSelection?: boolean;
  threadRepliesOpenedBeforeReplacementSelection?: boolean;
  candidates: Candidate[];
};
type GoldCase = { id: string; sourceIds: string[] };
type Gold = {
  status: string;
  runtimeFreezeCommit: string;
  selectionCommits: string[];
  governance: { initialOverlapRegressionOnly: number; finalFreshCases: number };
  cases: GoldCase[];
};

const root = process.cwd();
const fixture = (name: string) => path.join(root, "tests", "ask-sales-faq", name);
const json = <T>(name: string) => JSON.parse(readFileSync(fixture(name), "utf8")) as T;

const initialName = "v5-2-slack-holdout-selection-2026-07-24.json";
const replacementName = "v5-2-slack-holdout-replacement-selection-2026-07-24.json";
const goldName = "v5-2-fresh-slack-gold-2026-07-24.json";
const priorNames = [
  "v4-fresh-slack-source-gold-2026-07-22.json",
  "v5-fresh-slack-holdout-2026-07-24.json",
  "v5-1-post-freeze-slack-holdout-2026-07-24.json",
];

function slackParent(sourceIds: string[]) {
  const source = sourceIds.find((value) => value.startsWith("slack:C0AUQKNR8CF:"));
  return source?.split(":").at(-1) || "";
}

describe("V5.2 evaluation governance", () => {
  const initial = json<Selection>(initialName);
  const replacements = json<Selection>(replacementName);
  const gold = json<Gold>(goldName);

  it("freezes both selections before their thread replies are opened", () => {
    expect(initial.runtimeFreezeCommit).toBe("5aff892");
    expect(replacements.runtimeFreezeCommit).toBe("5aff892");
    expect(initial.threadRepliesOpenedBeforeSelection).toBe(false);
    expect(replacements.threadRepliesOpenedBeforeReplacementSelection).toBe(false);
    expect(initial.candidates).toHaveLength(40);
    expect(replacements.candidates).toHaveLength(36);
  });

  it("seals 40 unique source-only gold cases against the frozen runtime", () => {
    const ids = gold.cases.map((item) => item.id);
    const parents = gold.cases.map((item) => slackParent(item.sourceIds));
    expect(gold.status).toBe("sealed_before_runtime_evaluation");
    expect(gold.runtimeFreezeCommit).toBe("5aff892");
    expect(gold.selectionCommits).toEqual(["fa53da6", "1eaace1"]);
    expect(gold.governance.finalFreshCases).toBe(40);
    expect(gold.cases).toHaveLength(40);
    expect(new Set(ids).size).toBe(40);
    expect(parents.every(Boolean)).toBe(true);
    expect(new Set(parents).size).toBe(40);
  });

  it("uses only preregistered parents and excludes every earlier evaluation source", () => {
    const preregistered = new Set([...initial.candidates, ...replacements.candidates].map((item) => item.parentTs));
    const goldParents = gold.cases.map((item) => slackParent(item.sourceIds));
    const priorText = priorNames.map((name) => readFileSync(fixture(name), "utf8")).join("\n");
    expect(goldParents.every((parent) => preregistered.has(parent))).toBe(true);
    expect(goldParents.filter((parent) => priorText.includes(parent))).toEqual([]);
    expect(initial.candidates.filter((item) => priorText.includes(item.parentTs))).toHaveLength(18);
    expect(gold.governance.initialOverlapRegressionOnly).toBe(18);
  });
});
