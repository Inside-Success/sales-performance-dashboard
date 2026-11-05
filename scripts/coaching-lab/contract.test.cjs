const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("fs"),
  os = require("os"),
  path = require("path");
const { schema, validate, render, acceptReview } = require("./contract.cjs");
const { reserve, settle } = require("./accounting.cjs");
test("focus points to an entry and rendering does not expose evidence metadata", () => {
  const r = {
    ...schema,
    status: "completed",
    offer_family: "reality",
    outcome: {
      payment: "not_confirmed",
      text: "A follow-up was agreed.",
      evidence_ids: ["T1"],
    },
    objections: [],
    lessons: [
      {
        id: "L1",
        purpose: "repeat",
        title: "Keep the agreed purpose clear",
        observation: "A distinct observation",
        teaching: "A distinct teaching",
        example: "",
        evidence_ids: ["T1"],
        counterevidence_ids: [],
      },
    ],
    focus_id: "L1",
    next_steps: [],
  };
  const blocks = [{ id: "T1" }];
  assert.equal(validate(r, blocks), r);
  assert.equal(
    acceptReview(
      r,
      { pass: true, findings: [], corrected_report: null },
      blocks,
    ),
    r,
  );
  assert.throws(
    () =>
      acceptReview(
        r,
        {
          pass: true,
          findings: [{ issue: "bad", evidence_ids: ["T1"] }],
          corrected_report: null,
        },
        blocks,
      ),
    /Conflicting/,
  );
  assert.throws(
    () =>
      acceptReview(
        r,
        {
          pass: false,
          findings: [{ issue: "bad", evidence_ids: ["unknown"] }],
          corrected_report: r,
        },
        blocks,
      ),
    /evidence/,
  );
  assert.equal(render(r, blocks).split("A distinct teaching").length, 2);
  assert(!render(r, blocks).includes("T1"));
  assert.throws(() => validate({ ...r, focus_id: "missing" }, blocks));
  assert.throws(() => validate(r, []));
  const inline = structuredClone(r);
  inline.lessons[0].teaching = "Keep L1 in mind.";
  assert(!render(inline, blocks).includes("L1"));
  inline.lessons[0].teaching = "Compare O9.";
  assert.throws(() => render(inline, blocks), /Unknown inline entry/);
});
test("intent blocks duplicate reservation and settled receipts remain idempotent", () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "coaching-lab-test-"));
  try {
    const file = d + "/ledger.json";
    fs.writeFileSync(file, JSON.stringify({ ceiling: 0.01, requests: [] }));
    const p = { input_mtok: 1, output_mtok: 1 };
    const r = reserve(file, { model: "test" }, p, 1);
    assert.equal(reserve(file, { model: "test" }, p, 1).id, r.id);
    assert.equal(JSON.parse(fs.readFileSync(file)).requests.length, 1);
    const receipt = {
      usage: { input_tokens: 1 },
      provider_response_id: "receipt",
      costs: { total_cost_usd: 0.001 },
    };
    settle(file, r.id, receipt);
    settle(file, r.id, receipt);
    assert.throws(() =>
      settle(file, r.id, { ...receipt, provider_response_id: "other" }),
    );
    assert.throws(() => reserve(file, { model: "expensive" }, p, 20000));
  } finally {
    fs.rmSync(d, { recursive: true });
  }
});
test("OpenAI cache writes are distinct from fresh input and cache reads", () => {
  const { openAiUsage } = require("./usage.cjs");
  const raw = {
    usage: {
      prompt_tokens: 1000,
      completion_tokens: 100,
      prompt_tokens_details: { cached_tokens: 600, cache_write_tokens: 300 },
    },
  };
  const r = openAiUsage(raw, {
    input_mtok: 1,
    cache_read_mtok: 0.05,
    cache_write_mtok: 1.25,
    output_mtok: 5,
  });
  assert.equal(r.usage.input_tokens, 100);
  assert.equal(r.costs.total_cost_usd, 0.001005);
  assert.throws(
    () =>
      openAiUsage(
        {
          usage: {
            prompt_tokens: 1,
            completion_tokens: 1,
            prompt_tokens_details: { cached_tokens: 2 },
          },
        },
        {},
      ),
    /Invalid usage/,
  );
});
test("foundation sources retain exact bytes and fail on changed or duplicate layers", () => {
  const { hash } = require("./accounting.cjs");
  const { compose, manifest } = require("./foundation.cjs");
  const layer = {
    id: "principles",
    source: "fixture",
    revision: "v1",
    text: "Exact source\n",
    digest: hash("Exact source\n"),
  };
  assert.equal(compose([layer]), layer.text);
  assert(!("text" in manifest([layer])[0]));
  assert.throws(() => compose([{ ...layer, text: "Changed" }]), /digest/);
  assert.throws(() => compose([layer, layer]), /Invalid/);
});
