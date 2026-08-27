import { afterEach, describe, expect, it, vi } from "vitest";

import { getV7Rep, getV7ScorecardOverview } from "@/lib/rep-scoring/v7-validation";

const originalEnv = {
  enabled: process.env.REP_SCORING_ENABLED,
  token: process.env.REP_SCORING_AIRTABLE_TOKEN,
  baseId: process.env.REP_SCORING_AIRTABLE_BASE_ID,
  table: process.env.REP_SCORING_CALL_SCORES_TABLE,
  scorer: process.env.REP_SCORING_ACTIVE_SCORER_VERSION,
};

afterEach(() => {
  vi.unstubAllGlobals();
  restore("REP_SCORING_ENABLED", originalEnv.enabled);
  restore("REP_SCORING_AIRTABLE_TOKEN", originalEnv.token);
  restore("REP_SCORING_AIRTABLE_BASE_ID", originalEnv.baseId);
  restore("REP_SCORING_CALL_SCORES_TABLE", originalEnv.table);
  restore("REP_SCORING_ACTIVE_SCORER_VERSION", originalEnv.scorer);
});

describe("scorecard Airtable pagination", () => {
  it("does not cache page offsets and restarts once after a 422", async () => {
    process.env.REP_SCORING_ENABLED = "true";
    process.env.REP_SCORING_AIRTABLE_TOKEN = "test-token";
    process.env.REP_SCORING_AIRTABLE_BASE_ID = "app-test";
    process.env.REP_SCORING_CALL_SCORES_TABLE = "call_scores";
    process.env.REP_SCORING_ACTIVE_SCORER_VERSION = "magic-mike-call2-evidence-score-v1";

    const record = {
      id: "rec-1",
      fields: {
        "Assessment ID": "assessment-1",
        "Source Record ID": "source-1",
        "Scored Rep Email": "rep@example.com",
        "Scored Rep Label": "Test Rep",
        "Call Type": "Call 2+",
        "Meeting Start At": "2026-08-27T12:00:00.000Z",
        "Composite Score": 64,
        "Scorer Version": "magic-mike-call2-evidence-score-v1",
        "Scored At": "2026-08-27T12:05:00.000Z",
      },
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ records: [record], offset: "stale-offset" }))
      .mockResolvedValueOnce(jsonResponse({ error: { type: "INVALID_OFFSET_VALUE" } }, 422))
      .mockResolvedValueOnce(jsonResponse({ records: [record] }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getV7ScorecardOverview();

    expect(result.error).toBeUndefined();
    expect(result.callsReviewed).toBe(1);
    expect(result.repSummaries).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    for (const call of fetchMock.mock.calls) {
      expect(call[1]).toMatchObject({ cache: "no-store" });
      expect(call[1]).not.toHaveProperty("next");
    }
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("offset=stale-offset");
    expect(String(fetchMock.mock.calls[2]?.[0])).not.toContain("offset=");
  });

  it("recovers a rep-detail read after an Airtable timeout", async () => {
    configureScorecard();
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new DOMException("The operation was aborted due to timeout", "TimeoutError"))
      .mockResolvedValueOnce(jsonResponse({ records: [scoreRecord()] }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getV7Rep("rep@example.com");

    expect(result?.summary.repName).toBe("Test Rep");
    expect(result?.summary.totalCalls).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries a transient Airtable service response but not a permanent auth failure", async () => {
    configureScorecard();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ error: { message: "Unavailable" } }, 503))
      .mockResolvedValueOnce(jsonResponse({ records: [scoreRecord()] }))
      .mockResolvedValueOnce(jsonResponse({ error: { message: "Authentication required" } }, 401));
    vi.stubGlobal("fetch", fetchMock);

    const recovered = await getV7Rep("rep@example.com");
    await expect(getV7Rep("rep@example.com")).rejects.toThrow("Authentication required");

    expect(recovered?.summary.totalCalls).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

function configureScorecard() {
  process.env.REP_SCORING_ENABLED = "true";
  process.env.REP_SCORING_AIRTABLE_TOKEN = "test-token";
  process.env.REP_SCORING_AIRTABLE_BASE_ID = "app-test";
  process.env.REP_SCORING_CALL_SCORES_TABLE = "call_scores";
  process.env.REP_SCORING_ACTIVE_SCORER_VERSION = "magic-mike-call2-evidence-score-v1";
}

function scoreRecord() {
  return {
    id: "rec-1",
    fields: {
      "Assessment ID": "assessment-1",
      "Source Record ID": "source-1",
      "Scored Rep Email": "rep@example.com",
      "Scored Rep Label": "Test Rep",
      "Call Type": "Call 2+",
      "Meeting Start At": "2026-08-27T12:00:00.000Z",
      "Composite Score": 64,
      "Scorer Version": "magic-mike-call2-evidence-score-v1",
      "Scored At": "2026-08-27T12:05:00.000Z",
    },
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function restore(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
