import { afterEach, describe, expect, it, vi } from "vitest";
import type { PerformanceCall } from "@/lib/types";
import { getCoachingCallScore } from "@/lib/rep-scoring/coaching-score";
import { CALL2_CURRENT_VERSION } from "@/lib/rep-scoring/scorer-version";
const call = { source_payload: { source_airtable_record_id: "rec-one" }, scorecard_key: "zoom:one", rep_email: "rep@example.com", call_date: "2026-09-10T12:00:00Z" } as PerformanceCall;
const row = { id: "airtable-one", fields: { "Assessment ID": `${CALL2_CURRENT_VERSION}:rec-one`, "Source Record ID": "rec-one", "Scorer Version": CALL2_CURRENT_VERSION, "Scored Rep Email": "rep@example.com", "Meeting Start At": call.call_date, "Call Type": "Call 2+", "Composite Score": 76, "Dimensions JSON": "PRIVATE MANAGER REASONING" } };
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
function setup(response: Response) {
  vi.stubEnv("REP_SCORING_AIRTABLE_TOKEN", "isolated-test");
  vi.stubEnv("REP_SCORING_COACHING_SCORE_ENABLED", "true");
  const fetchMock = vi.fn().mockResolvedValue(response); vi.stubGlobal("fetch", fetchMock); return fetchMock;
}
describe("rep-facing score lookup", () => {
  it("returns only a score and opaque identity, never manager reasoning", async () => {
    const fetchMock = setup(Response.json({ records: [row] }));
    const result = await getCoachingCallScore(call);
    expect(result).toEqual({ assessmentId: `${CALL2_CURRENT_VERSION}:rec-one`, score: 76 });
    expect(JSON.stringify(result)).not.toContain("PRIVATE");
    expect(new URL(String(fetchMock.mock.calls[0][0])).searchParams.get("filterByFormula")).toContain(CALL2_CURRENT_VERSION);
  });
  it("does not turn an empty score into zero", async () => {
    setup(Response.json({ records: [{ ...row, fields: { ...row.fields, "Composite Score": null } }] }));
    expect(await getCoachingCallScore(call)).toBeNull();
  });
  it("keeps coaching available when the optional score store fails", async () => {
    setup(new Response("unavailable", { status: 503 }));
    expect(await getCoachingCallScore(call)).toBeNull();
  });
  it("does not expose another rep's score", async () => {
    setup(Response.json({ records: [row] }));
    expect(await getCoachingCallScore({ ...call, rep_email: "different@example.com" })).toBeNull();
  });
});
