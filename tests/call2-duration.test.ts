import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), query: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/rep-scoring/access", () => ({
  requireRepScoringAdmin: mocks.auth,
}));
vi.mock("@neondatabase/serverless", () => ({ neon: () => mocks.query }));
import Page from "@/app/manager/call2-duration/page";
import { calls } from "@/app/manager/call2-duration/data";

const db = new PGlite();
const cue = { id: 2, at: 180, playback: 170, text: "I want to think it over." };
const sample = {
  signal: cue,
  outcome: "A follow-up was agreed.",
  total: 420,
  attendance: 403,
  cast: "Cast member",
  rep: "Rep A",
  show: "Sample",
  date: "2026-11-23T00:00:00Z",
  recording: "https://us06web.zoom.us/rec/play/example",
  recordingStart: 1000000,
};
beforeAll(async () => {
  await db.exec(readFileSync("migrations/20261124_call2_duration.sql", "utf8"));
  await db.exec(
    readFileSync("migrations/20261124_call2_duration_sources.sql", "utf8"),
  );
  await db.exec(
    readFileSync("migrations/20261124_call2_duration_replies.sql", "utf8"),
  );
  await db.query(
    "insert into call2_duration_pilot values ($1,$2,now(),$3,$4,null,null)",
    ["sample", "digest", JSON.stringify(sample), JSON.stringify([cue])],
  );
  await db.query("update call2_duration_pilot set rep_replies = $1", [
    JSON.stringify({ 2: "What would you like to think through?" }),
  ]);
});
beforeEach(() => {
  mocks.query.mockImplementation(
    async (parts: TemplateStringsArray, ...values: unknown[]) => {
      const statement = parts.reduce(
        (s, p, i) => s + (i ? "$" + i : "") + p,
        "",
      );
      return (await db.query(statement, values)).rows;
    },
  );
});
afterAll(() => db.close());
it("checks admin access before reading source links", async () => {
  mocks.auth.mockRejectedValueOnce(Error("forbidden"));
  const count = mocks.query.mock.calls.length;
  await expect(calls()).rejects.toThrow("forbidden");
  expect(mocks.query).toHaveBeenCalledTimes(count);
});
it("renders saved timing and source links without review or playback controls", async () => {
  mocks.auth.mockResolvedValue({ user: { email: "tester@example.com" } });
  await db.query("update call2_duration_pilot set transcript_doc_id = $1", [
    "sample-doc",
  ]);
  const html = renderToStaticMarkup(
    await Page({ searchParams: Promise.resolve({}) }),
  );
  for (const item of [
    "7:00",
    "6:43",
    "4:00",
    cue.text,
    "Open transcript",
    "Rep’s next reply",
    "What would you like to think through?",
    "Call outcome",
    "1 of 1",
    "Median time cast stayed",
  ])
    expect(html).toContain(item);
  for (const removed of [
    "Listen to exchange",
    "<audio",
    "Right moment",
    "Choose a different transcript line",
    "Watch Zoom recording",
    sample.recording,
  ])
    expect(html).not.toContain(removed);
  expect(html).toContain("https://docs.google.com/document/d/sample-doc/edit");
  expect(html.indexOf("Pilot overview")).toBeLessThan(
    html.indexOf("Cast member"),
  );
});

it("shows only a verified recording and respects a saved no-pullback decision", async () => {
  await db.query(
    "update call2_duration_pilot set verified_recording_url = $1, transcript_doc_id = null, review = $2",
    [sample.recording, JSON.stringify({ signal: null })],
  );
  const html = renderToStaticMarkup(
    await Page({ searchParams: Promise.resolve({ rep: sample.rep }) }),
  );
  expect(html).toContain("Watch Zoom recording");
  expect(html).toContain(sample.recording);
  expect(html).toContain("0 of 1");
  expect(html).not.toContain("Open transcript");
});
