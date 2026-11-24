import { afterEach, expect, it, vi } from "vitest";
const { session, lookup } = vi.hoisted(() => ({ session: vi.fn(), lookup: vi.fn() }));
vi.mock("@/auth", () => ({ auth: session }));
vi.mock("@/lib/rep-scoring/admin-allowlist", () => ({ isRepScoringAdmin: (email: string) => email === "admin" }));
vi.mock("@neondatabase/serverless", () => ({ neon: () => lookup }));
import { GET } from "@/app/api/call2-transcript/route";

const request = new Request("https://example.com/api/call2-transcript?occurrence=pilot");
function fixture(uuid: string, playback: number) {
  session.mockResolvedValue({ user: { email: "admin" } });
  lookup.mockResolvedValue([{ transcript_doc_id: "doc", cue: { text: "Let me think.", at: 99, playback } }]);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
    `Zoom Meeting UUID: ${uuid}\r\nFull Transcript\r\n[00:01:00.300] Cast: Let me think.\r\n[00:01:05.400] Rep: Of course.`,
    { headers: { "Content-Type": "text/plain" } },
  )));
}
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });
it("requires admin before querying a pilot call", async () => {
  session.mockResolvedValue(null);
  expect((await GET(request)).status).toBe(403);
  expect(lookup).not.toHaveBeenCalled();
});
it("highlights the recording cue and omits source metadata", async () => {
  fixture("pilot", 60);
  const res = await GET(request);
  const data = await res.json();
  expect(data.lineIndex).toBe(0);
  expect(data.transcript).toContain("Rep: Of course.");
  expect(data.transcript).not.toContain("UUID");
  expect(res.headers.get("Cache-Control")).toContain("no-store");
});
it("does not highlight a repeated quote at a different time", async () => {
  fixture("pilot", 99);
  expect((await (await GET(request)).json()).lineIndex).toBe(-1);
});
it("rejects a source belonging to another call", async () => {
  fixture("other", 60);
  expect((await GET(request)).status).toBe(502);
});
