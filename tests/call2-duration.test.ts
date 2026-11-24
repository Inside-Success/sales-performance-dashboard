import React from "react";
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
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw Error(path);
  },
}));
import Page from "@/app/manager/call2-duration/page";
import {
  calls,
  choices,
  playbackLink,
} from "@/app/manager/call2-duration/data";
import { saveMark } from "@/app/manager/call2-duration/actions";

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
  await db.query(
    "insert into call2_duration_pilot values ($1,$2,now(),$3,$4,null,null)",
    ["sample", "digest", JSON.stringify(sample), JSON.stringify([cue])],
  );
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
function form(cue: string, revision = "") {
  const f = new FormData();
  for (const [k, v] of Object.entries({
    id: "sample",
    digest: "digest",
    revision,
    cue,
  }))
    f.set(k, v);
  return f;
}
it("checks admin access before list, transcript choices and writes", async () => {
  mocks.auth.mockRejectedValue(Error("forbidden"));
  const count = mocks.query.mock.calls.length;
  for (const read of [
    calls,
    () => choices("sample"),
    () => saveMark(form("none")),
  ])
    await expect(read()).rejects.toThrow("forbidden");
  expect(mocks.query).toHaveBeenCalledTimes(count);
});
it("renders saved timing and jumps to the aligned cue with lead-in", async () => {
  mocks.auth.mockResolvedValue({ user: { email: "tester@example.com" } });
  const html = renderToStaticMarkup(
    await Page({ searchParams: Promise.resolve({}) }),
  );
  for (const item of [
    "7:00",
    "6:43",
    "4:00",
    cue.text,
    "Listen to exchange",
    "startTime=1000167000",
  ])
    expect(html).toContain(item);
  expect(() =>
    playbackLink(
      { ...sample, recording: "https://zoom.us.example.org/rec/play/anything" },
      cue,
    ),
  ).toThrow();
});
it("saves a correction without rewriting the original and prevents stale overwrites", async () => {
  mocks.auth.mockResolvedValue({ user: { email: "tester@example.com" } });
  await expect(saveMark(form("none"))).rejects.toThrow(
    "/manager/call2-duration",
  );
  const [row] = await calls();
  expect(row.review?.signal).toBeNull();
  expect(row.summary.signal).toEqual(cue);
  await expect(saveMark(form("2"))).rejects.toThrow("changed=1");
  await expect(saveMark(form("999", row.revision))).rejects.toThrow(
    "changed=1",
  );
  await expect(saveMark(form("2", row.revision))).rejects.toThrow(
    "/manager/call2-duration",
  );
  expect((await calls())[0].review?.signal).toEqual(cue);
});
