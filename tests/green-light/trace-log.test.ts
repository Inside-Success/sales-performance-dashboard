import { PGlite } from "@electric-sql/pglite";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import fixtures from "./letter-fixtures.json";

// The real route handlers and the real SQL, run against an in-process Postgres. Only the sign-in,
// the letter workflow (fetch) and Next's "after the response" hook are stand-ins.
const state = vi.hoisted(() => ({
  db: null as PGlite | null,
  url: "isolated-test-only" as string | undefined,
  breakDatabase: false,
  afterThrows: false,
  zoomTranscript: "" as string,
  auth: vi.fn(),
  pending: [] as Promise<unknown>[],
}));

vi.mock("@/auth", () => ({ auth: state.auth }));
vi.mock("@/lib/database-connection", () => ({ databaseUrl: () => state.url }));
vi.mock("@neondatabase/serverless", () => ({
  neon: () => (parts: TemplateStringsArray, ...values: unknown[]) => {
    if (state.breakDatabase) return Promise.reject(new Error("database is down"));
    const text = parts.reduce((sum, part, index) => sum + part + (index < values.length ? `$${index + 1}` : ""), "");
    return state.db!.query(text, values).then((result) => result.rows);
  },
}));
vi.mock("next/server", async (original) => ({
  ...(await original<typeof import("next/server")>()),
  after: (task: () => unknown) => {
    if (state.afterThrows) throw new Error("after() is not available here");
    state.pending.push(Promise.resolve().then(task));
  },
}));
vi.mock("@/lib/green-light/zoom-call-transcript", () => ({ resolveZoomCallTranscript: async () => state.zoomTranscript }));
vi.mock("@/lib/zoom-transcript", () => ({ resolveZoomTranscript: async () => null }));
vi.mock("@/lib/manual-transcript-archive", () => ({ resolveManualArchivedTranscript: async () => null }));

import { NextRequest } from "next/server";
import { POST as generate } from "@/app/api/green-light/generate/route";
import { POST as refine } from "@/app/api/green-light/refine/route";
import { POST as save } from "@/app/api/green-light/save/route";
import { GET as status } from "@/app/api/green-light/status/route";
import { GET as trace } from "@/app/api/green-light/trace/route";
import { POST as zoom } from "@/app/api/green-light/transcript/route";
import { isMagicMikeAdmin } from "@/lib/admin-access-policy";
import { listGreenLightTrace, readGreenLightTrace, recordGreenLightTrace, writtenSections } from "@/lib/green-light/trace-store";

const REP = { user: { email: "regular.rep@insidesuccess.com", name: "Regular Rep" } };
const ADMIN = { user: { email: "rudymawerllc@gmail.com", name: "Rudy" } };
const LETTER = (fixtures as Record<string, string>).mansion;
const STORY_LETTER = (fixtures as Record<string, string>).normal;
const TRANSCRIPT = "Casting manager: tell me about the business. Prospect: I run a roofing company in Dallas, twelve years now. ".repeat(4);
const SURVEY = Array.from({ length: 60 }, (_, index) => `Q${index + 1}: How many years have you been in business?\nA: ${"twelve years in roofing ".repeat(12).trim()}`).join("\n");

const flush = async () => {
  await Promise.all(state.pending.splice(0));
};
const rows = async (where = "true") => (await state.db!.query(`select * from green_light_letter_trace where ${where} order by id`)).rows as Record<string, unknown>[];
const post = (path: string, body: unknown) => new NextRequest(`https://example.com/api/green-light/${path}`, { method: "POST", body: JSON.stringify(body) });
const get = (path: string) => new NextRequest(`https://example.com/api/green-light/${path}`);

/** The letter workflow: answers by the last part of the webhook address. */
function workflow(answers: Record<string, { status?: number; body: unknown } | (() => never)>) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input instanceof Request ? input.url : input);
    const key = Object.keys(answers).find((suffix) => new URL(url).pathname.endsWith(suffix));
    if (!key) throw new Error(`unexpected request to ${url}`);
    const answer = answers[key];
    if (typeof answer === "function") return answer();
    return new Response(JSON.stringify(answer.body), { status: answer.status || 200, headers: { "content-type": "application/json" } });
  });
}

beforeAll(async () => {
  state.db = await PGlite.create();
}, 30_000);
afterAll(async () => {
  await state.db?.close();
});
beforeEach(async () => {
  state.url = "isolated-test-only";
  state.breakDatabase = false;
  state.afterThrows = false;
  state.zoomTranscript = "";
  state.auth.mockResolvedValue(REP);
  // Empty the table between tests (it is created by the first write, as in production).
  await state.db!.exec("do $$ begin if to_regclass('green_light_letter_trace') is not null then truncate green_light_letter_trace restart identity; end if; end $$");
});
afterEach(async () => {
  await flush();
  vi.restoreAllMocks();
});

describe("green light trace log", () => {
  it("keeps the whole focus points box, the transcript and the Zoom link for a letter", async () => {
    expect(isMagicMikeAdmin(REP.user.email)).toBe(false);
    const calls = workflow({ "-start": { body: { ok: true, job_id: "v2_1763500000000_abc123" } } });
    const focus = ["He wants to be known for storm repair", ...SURVEY.split("\n")];
    const response = await generate(
      post("generate", {
        show: "mansion",
        prospect_name: "Jordan Example",
        transcript: TRANSCRIPT,
        input_type: "zoom_link",
        focus_points: focus,
        zoom_link: "  https://us06web.zoom.us/rec/share/abc.DEF_123  ",
      }),
    );
    expect(await response.json()).toEqual({ ok: true, job_id: "v2_1763500000000_abc123" });
    // The workflow still receives exactly what it did before; the Zoom link is not sent to it.
    const sent = JSON.parse(String(calls.mock.calls[0][1]?.body));
    expect(sent.focus_points).toEqual(focus);
    expect(sent).not.toHaveProperty("zoom_link");
    await flush();

    const [row] = await rows("event = 'generate'");
    expect(row).toMatchObject({
      job_id: "v2_1763500000000_abc123",
      rep_email: "regular.rep@insidesuccess.com",
      rep_name: "Regular Rep",
      prospect_name: "Jordan Example",
      show_type: "mansion",
      input_type: "zoom_link",
      zoom_link: "https://us06web.zoom.us/rec/share/abc.DEF_123",
      transcript: TRANSCRIPT.trim(),
    });
    expect(row.focus_points).toBe(focus.join("\n"));
    expect(String(row.focus_points).length).toBeGreaterThan(15000);
  });

  it("records a letter written without a transcript, and one that could not start", async () => {
    workflow({ "-start": { body: { ok: true, job_id: "v2_1763500000001_nt0001" } } });
    const notes = ["Owns a roofing company in Dallas, 12 years, about 20 staff.", "Started it after he was laid off."];
    await generate(post("generate", { show: "island", prospect_name: "Jordan Example", transcript: "", input_type: "focus_points", focus_points: notes }));
    await flush();
    expect((await rows("event = 'generate'"))[0]).toMatchObject({ input_type: "focus_points", focus_points: notes.join("\n"), transcript: null, zoom_link: null });

    vi.mocked(globalThis.fetch).mockRestore();
    workflow({ "-start": { status: 500, body: { message: "Workflow could not be started" } } });
    const failed = await generate(post("generate", { show: "island", prospect_name: "Jordan Example", transcript: "", input_type: "focus_points", focus_points: notes }));
    expect(failed.status).toBe(502);
    await flush();
    expect((await rows("event = 'start_failed'"))[0]).toMatchObject({ job_id: "", focus_points: notes.join("\n"), error: "Workflow could not be started" });
  });

  it("keeps the letter exactly as the AI wrote it, once, with its sections", async () => {
    workflow({ "-status": { body: { status: "complete", draft_text: LETTER, show_type: "mansion", guest_name: "Jordan Example", doc_title: "Mansion of Money TV x Jordan Example", warnings: ["Review note: check the name."] } } });
    for (let poll = 0; poll < 3; poll += 1) {
      const response = await status(get("status?job_id=v2_1763500000000_abc123"));
      expect((await response.json()).draft_text).toBe(LETTER);
      await flush();
    }
    const drafts = await rows("event = 'draft'");
    expect(drafts).toHaveLength(1);
    expect(drafts[0]).toMatchObject({ job_id: "v2_1763500000000_abc123", letter_text: LETTER, show_type: "mansion", rep_email: "regular.rep@insidesuccess.com" });
    expect(Object.keys(drafts[0].sections as object).sort()).toEqual(["business_experience", "competitive_edge", "personality", "prospect_name", "the_wildcard"]);
    expect(drafts[0].detail).toEqual({ warnings: ["Review note: check the name."] });
    expect(Object.keys(writtenSections(STORY_LETTER) || {})).toContain("act_1");
    expect(writtenSections("not a letter")).toBeNull();
  });

  it("records a failed generation and still answers the page", async () => {
    workflow({ "-status": { body: { status: "failed", error: "validation failed: Personality paragraph is missing" } } });
    const response = await status(get("status?job_id=v2_1763500000002_fail01"));
    expect(await response.json()).toEqual({ ok: true, status: "failed", error: "validation failed: Personality paragraph is missing" });
    await status(get("status?job_id=v2_1763500000002_fail01"));
    await flush();
    const failed = await rows("event = 'failed'");
    expect(failed).toHaveLength(1);
    expect(failed[0]).toMatchObject({ job_id: "v2_1763500000002_fail01", error: "validation failed: Personality paragraph is missing" });
  });

  it("records each AI change with the letter before and after, and the final letter sent to the Doc", async () => {
    const edited = LETTER.replace("Jordan Example", "Jordan A. Example");
    const changed = edited.replace(/BUSINESS EXPERIENCE\n[^\n]+/, "BUSINESS EXPERIENCE\nYou run a $3.5 million roofing company.");
    expect(changed).not.toBe(edited);
    workflow({
      "-refine": { body: { ok: true, draft_text: changed, guest_name: "Jordan A. Example", warnings: [] } },
      "-save": { body: { ok: true, document_url: "https://docs.google.com/document/d/abc123/edit", doc_title: "Mansion of Money TV x Jordan A. Example" } },
    });
    const base = { show: "mansion", prospect_name: "Jordan A. Example", job_id: "v2_1763500000000_abc123" };
    const refined = await refine(post("refine", { ...base, draft_text: edited, instructions: "Mention the size of the company", transcript: TRANSCRIPT }));
    expect((await refined.json()).draft_text).toBe(changed);
    const saved = await save(post("save", { ...base, draft_text: changed }));
    expect((await saved.json()).document_url).toBe("https://docs.google.com/document/d/abc123/edit");
    await flush();

    const [change] = await rows("event = 'refine'");
    expect(change).toMatchObject({ job_id: base.job_id, instructions: "Mention the size of the company", letter_before: edited, letter_text: changed });
    const [final] = await rows("event = 'save'");
    expect(final).toMatchObject({ job_id: base.job_id, letter_text: changed, document_url: "https://docs.google.com/document/d/abc123/edit", doc_title: "Mansion of Money TV x Jordan A. Example", rep_name: "Regular Rep" });
    expect((final.sections as Record<string, string>).business_experience).toBe("You run a $3.5 million roofing company.");
  });

  it("records a change or a final letter that did not go through", async () => {
    workflow({
      "-refine": { body: { ok: false, error: "AI refine introduced a compliance-sensitive claim (guarantee). The original draft was not changed." } },
      "-save": () => {
        throw new Error("network down");
      },
    });
    const base = { show: "mansion", prospect_name: "Jordan Example", job_id: "v2_1763500000000_abc123", draft_text: LETTER };
    expect((await refine(post("refine", { ...base, instructions: "Guarantee he will win", transcript: TRANSCRIPT }))).status).toBe(422);
    expect((await save(post("save", base))).status).toBe(502);
    await flush();
    expect((await rows("event = 'refine_failed'"))[0]).toMatchObject({ instructions: "Guarantee he will win", letter_before: LETTER });
    expect(String((await rows("event = 'refine_failed'"))[0].error)).toContain("compliance-sensitive");
    expect((await rows("event = 'save_failed'"))[0]).toMatchObject({ letter_text: LETTER, error: "The letter workflow did not answer." });
  });

  it("never lets a database problem change what the rep gets", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const answers: Record<string, string[]> = {};
    for (const broken of ["healthy", "down", "missing", "cannot schedule"] as const) {
      state.breakDatabase = broken === "down";
      state.url = broken === "missing" ? undefined : "isolated-test-only";
      state.afterThrows = broken === "cannot schedule";
      const bodies: string[] = (answers[broken] = []);
      const keep = async (response: Response) => {
        bodies.push(`${response.status} ${await response.clone().text()}`);
        return response;
      };
      workflow({
        "-start": { body: { ok: true, job_id: "v2_1763500000003_dbdown" } },
        "-status": { body: { status: "complete", draft_text: LETTER, show_type: "mansion" } },
        "-refine": { body: { ok: true, draft_text: LETTER } },
        "-save": { body: { ok: true, document_url: "https://docs.google.com/document/d/abc123/edit" } },
      });
      const base = { show: "mansion", prospect_name: "Jordan Example", job_id: "v2_1763500000003_dbdown", draft_text: LETTER };
      expect((await keep(await generate(post("generate", { show: "mansion", prospect_name: "Jordan Example", transcript: TRANSCRIPT, input_type: "transcript", focus_points: [] })))).status).toBe(200);
      expect((await keep(await status(get("status?job_id=v2_1763500000003_dbdown")))).status).toBe(200);
      expect((await keep(await refine(post("refine", { ...base, instructions: "Make it shorter", transcript: TRANSCRIPT })))).status).toBe(200);
      expect((await keep(await save(post("save", base)))).status).toBe(200);
      state.zoomTranscript = TRANSCRIPT;
      expect((await keep(await zoom(post("transcript", { zoom_link: "https://us06web.zoom.us/rec/share/abc.DEF_123" })))).status).toBe(200);
      state.zoomTranscript = "";
      expect((await keep(await zoom(post("transcript", { zoom_link: "https://us06web.zoom.us/rec/share/abc.DEF_123" })))).status).toBe(422);
      // The failure paths too: the workflow not answering must stay a plain 502 with the same message.
      vi.mocked(globalThis.fetch).mockRestore();
      workflow({});
      expect((await keep(await generate(post("generate", { show: "mansion", prospect_name: "Jordan Example", transcript: TRANSCRIPT, input_type: "transcript", focus_points: [] })))).status).toBe(502);
      expect((await keep(await status(get("status?job_id=v2_1763500000003_dbdown")))).status).toBe(502);
      expect((await keep(await refine(post("refine", { ...base, instructions: "Make it shorter", transcript: TRANSCRIPT })))).status).toBe(502);
      expect((await keep(await save(post("save", base)))).status).toBe(502);
      await expect(flush()).resolves.toBeUndefined();
      await expect(recordGreenLightTrace({ event: "save", rep_email: "rep@insidesuccess.com" })).resolves.toBeUndefined();
      vi.mocked(globalThis.fetch).mockRestore();
    }
    // Every answer, body and status, is the same whether the trace log works or not.
    expect(answers.healthy).toHaveLength(10);
    for (const broken of ["down", "missing", "cannot schedule"]) expect(answers[broken]).toEqual(answers.healthy);
    expect(errors).toHaveBeenCalledWith("Green light trace not saved", "generate", "Error");
    expect(errors).toHaveBeenCalledWith("Green light trace not scheduled", "generate", "Error");
    state.afterThrows = false;
    await state.db!.exec("truncate green_light_letter_trace restart identity");
    // Once the database is back, the next letter is recorded again.
    state.breakDatabase = false;
    state.url = "isolated-test-only";
    await recordGreenLightTrace({ event: "save", rep_email: "rep@insidesuccess.com", job_id: "v2_1763500000004_back01" });
    expect(await rows()).toHaveLength(1);
  });

  it("records which Zoom recording was asked for and whether it had a transcript", async () => {
    state.zoomTranscript = TRANSCRIPT;
    const link = "https://us06web.zoom.us/rec/share/abc.DEF_123";
    expect(await (await zoom(post("transcript", { zoom_link: link }))).json()).toEqual({ ok: true, transcript: TRANSCRIPT.trim() });
    state.zoomTranscript = "too short";
    expect((await zoom(post("transcript", { zoom_link: link }))).status).toBe(422);
    expect((await zoom(post("transcript", { zoom_link: "https://us06web.zoom.us/j/83614505751" }))).status).toBe(400);
    await flush();
    const asked = await rows("event = 'zoom'");
    expect(asked).toHaveLength(2);
    expect(asked[0]).toMatchObject({ zoom_link: link, error: null, transcript: null, detail: { outcome: "transcript_found", transcript_chars: TRANSCRIPT.trim().length } });
    expect(asked[1]).toMatchObject({ zoom_link: link, detail: { outcome: "not_ready", transcript_chars: 0 } });
    expect(String(asked[1].error)).toContain("Zoom has no transcript");

    // These rows belong to no letter, so the lookup reaches them by their own number.
    state.auth.mockResolvedValue(ADMIN);
    const list = await (await trace(get("trace"))).text();
    expect(list).toContain("https://example.com/api/green-light/trace?id=2");
    expect(await (await trace(get("trace?id=2"))).text()).toContain("ZOOM TRANSCRIPT REQUEST");
    expect((await trace(get("trace?id=abc"))).status).toBe(400);
    state.auth.mockResolvedValue(REP);
    expect((await trace(get("trace?id=2"))).status).toBe(404);
  });

  it("keeps a row even when the text has characters the database refuses", async () => {
    const odd = `Owns a roofing company\u0000 in Dallas \uD83D and \uDE00 alone, real emoji \uD83D\uDE00 kept`;
    await recordGreenLightTrace({ event: "generate", rep_email: "rep@insidesuccess.com", job_id: "v2_1763500000007_odd001", prospect_name: `Jordan\u0000 Example`, focus_points: odd, transcript: odd, detail: { warnings: [odd], multi: null } });
    const [row] = await rows();
    expect(row).toMatchObject({ prospect_name: "Jordan Example", focus_points: "Owns a roofing company in Dallas  and  alone, real emoji \uD83D\uDE00 kept" });
    expect((row.detail as { warnings: string[] }).warnings[0]).toBe(row.focus_points);
  });

  it("accepts a request whatever the Zoom link field holds", async () => {
    workflow({ "-start": { body: { ok: true, job_id: "v2_1763500000008_zoom01" } } });
    for (const zoomLink of [undefined, null, 42, "", "https://us06web.zoom.us/rec/share/abc"]) {
      const response = await generate(post("generate", { show: "mansion", prospect_name: "Jordan Example", transcript: TRANSCRIPT, input_type: "zoom_link", focus_points: [], zoom_link: zoomLink }));
      expect(response.status).toBe(200);
    }
    await flush();
    expect((await rows("event = 'generate'")).map((row) => row.zoom_link)).toEqual([null, null, null, null, "https://us06web.zoom.us/rec/share/abc"]);
  });

  it("can be searched, and treats search text literally", async () => {
    await recordGreenLightTrace({ event: "generate", rep_email: "a.rep@insidesuccess.com", rep_name: "Alex Rep", job_id: "v2_1763500000005_aaa111", prospect_name: "Jordan Example", focus_points: "x".repeat(900), transcript: "y".repeat(1500) });
    await recordGreenLightTrace({ event: "save", rep_email: "a.rep@insidesuccess.com", rep_name: "Alex Rep", job_id: "v2_1763500000005_aaa111", prospect_name: "Jordan Example", letter_text: LETTER, document_url: "https://docs.google.com/document/d/DOC_one/edit" });
    await recordGreenLightTrace({ event: "generate", rep_email: "b.rep@insidesuccess.com", rep_name: "Blake Rep", job_id: "v2_1763500000006_bbb222", prospect_name: "Sam 100% O'Neil" });

    expect((await listGreenLightTrace({})).map((row) => row.event)).toEqual(["generate", "save", "generate"]);
    expect(await listGreenLightTrace({ prospect: "jordan" })).toHaveLength(2);
    expect((await listGreenLightTrace({ prospect: "jordan" }))[1]).toMatchObject({ focus_chars: 900, transcript_chars: 1500, letter_chars: 0 });
    expect(await listGreenLightTrace({ rep: "blake" })).toHaveLength(1);
    expect(await listGreenLightTrace({ rep: "B.REP@" })).toHaveLength(1);
    expect(await listGreenLightTrace({ doc: "DOC_one" })).toHaveLength(1);
    expect(await listGreenLightTrace({ prospect: "100%" })).toHaveLength(1);
    expect(await listGreenLightTrace({ prospect: "%" })).toHaveLength(1);
    expect(await listGreenLightTrace({ prospect: "_" })).toHaveLength(0);
    expect(await listGreenLightTrace({ prospect: "'; drop table green_light_letter_trace; --" })).toHaveLength(0);
    expect(await listGreenLightTrace({ limit: 1 })).toHaveLength(1);
    expect((await readGreenLightTrace("v2_1763500000005_aaa111")).map((row) => row.event)).toEqual(["generate", "save"]);
  });
});

describe("green light trace lookup", () => {
  it("is hidden from reps and signed-out visitors", async () => {
    await recordGreenLightTrace({ event: "generate", rep_email: "a.rep@insidesuccess.com", job_id: "v2_1763500000005_aaa111", prospect_name: "Jordan Example", focus_points: "secret notes" });
    for (const session of [null, REP, { user: {} }]) {
      state.auth.mockResolvedValue(session);
      for (const path of ["trace", "trace?job_id=v2_1763500000005_aaa111", "trace?format=json"]) {
        const response = await trace(get(path));
        expect(response.status).toBe(404);
        expect(await response.text()).toBe("Not found");
      }
    }
  });

  it("shows an admin the list and everything about one letter", async () => {
    state.auth.mockResolvedValue(ADMIN);
    expect(isMagicMikeAdmin(ADMIN.user.email)).toBe(true);
    await recordGreenLightTrace({ event: "generate", rep_email: "a.rep@insidesuccess.com", rep_name: "Alex Rep", job_id: "v2_1763500000005_aaa111", prospect_name: "Jordan Example", show_type: "mansion", input_type: "zoom_link", zoom_link: "https://us06web.zoom.us/rec/share/abc", focus_points: "Wants to be known for storm repair", transcript: TRANSCRIPT });
    await recordGreenLightTrace({ event: "draft", rep_email: "a.rep@insidesuccess.com", job_id: "v2_1763500000005_aaa111", letter_text: LETTER });
    await recordGreenLightTrace({ event: "save", rep_email: "a.rep@insidesuccess.com", job_id: "v2_1763500000005_aaa111", prospect_name: "Jordan Example", letter_text: LETTER, document_url: "https://docs.google.com/document/d/DOC_one/edit" });

    const list = await trace(get("trace?prospect=jordan"));
    expect(list.status).toBe(200);
    expect(list.headers.get("cache-control")).toBe("no-store");
    const listText = await list.text();
    expect(listText).toContain("Alex Rep | Jordan Example | mansion | zoom_link | focus 34 chars");
    expect(listText).toContain("https://example.com/api/green-light/trace?job_id=v2_1763500000005_aaa111");
    expect(listText).not.toContain("storm repair");

    const letter = await (await trace(get("trace?job_id=v2_1763500000005_aaa111"))).text();
    for (const expected of ["WHAT THE REP GAVE", "Zoom link: https://us06web.zoom.us/rec/share/abc", "Wants to be known for storm repair", "LETTER AS THE AI WROTE IT", "FINAL LETTER SENT TO THE GOOGLE DOC", "https://docs.google.com/document/d/DOC_one/edit", TRANSCRIPT.trim()]) {
      expect(letter).toContain(expected);
    }
    expect((await (await trace(get("trace?job_id=v2_1763500000005_aaa111&format=json"))).json()).rows).toHaveLength(3);
    expect((await trace(get("trace?job_id=not-a-job"))).status).toBe(400);
    expect(await (await trace(get("trace?job_id=v2_1763500000009_none00"))).text()).toContain("Nothing is recorded for this letter.");

    state.breakDatabase = true;
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await trace(get("trace"))).status).toBe(503);
  });
});
