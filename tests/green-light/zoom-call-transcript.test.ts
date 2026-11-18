import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveZoomCallTranscript, transcriptFromItems, transcriptFromVtt } from "@/lib/green-light/zoom-call-transcript";

const LINK = "https://us06web.zoom.us/rec/share/abc.DEF_123";
const page = (configPath: string) => `<html><script>window.__zm_unified_player__ = { playInfoApi: '/nws/recording/2.0/share/abc/play-info', featureConfigApi: '${configPath}' };</script></html>`;
const long = "We talked about the business for a long time and covered every part of the story in detail. ".repeat(3);
const items = { status: true, result: { dataList: [
  { userName: "Rep Name", text: "Welcome  to the call." },
  { userName: "Rep Name", text: "Tell me about your business." },
  { userName: "Pat Prospect", text: long },
  { userName: "", text: "   " },
] } };
const config = (extra: Record<string, unknown> = {}) => ({ status: true, result: { transcript: { status: "success", getApi: "/nws/recording/2.0/share/abc/transcript?pageType=web" }, captions: { transcriptCaptionApi: "/nws/recording/2.0/share/abc/play/vtt?type=transcript" }, ...extra } });

function mockFetch(routes: Record<string, { body?: unknown; status?: number; location?: string }>) {
  const calls: string[] = [];
  vi.stubGlobal("fetch", vi.fn(async (input: URL | string) => {
    const url = new URL(String(input));
    calls.push(url.href);
    const route = routes[url.pathname];
    if (!route) return new Response("not found", { status: 404 });
    if (route.location) return new Response(null, { status: 302, headers: { location: route.location } });
    return new Response(typeof route.body === "string" ? route.body : JSON.stringify(route.body), { status: route.status || 200 });
  }));
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe("zoom call transcript", () => {
  it("joins transcript items into speaker turns", () => {
    expect(transcriptFromItems(items.result.dataList)).toBe(`Rep Name: Welcome to the call. Tell me about your business.\n\nPat Prospect: ${long.trim()}`);
    expect(transcriptFromItems(null)).toBe("");
  });

  it("cleans a caption file", () => {
    expect(transcriptFromVtt("WEBVTT\r\n\r\n1\r\n00:00:11.580 --> 00:00:13.000\r\nRep Name: Hello there.\r\n\r\n2\r\n00:00:14.000 --> 00:00:16.000\r\nPat Prospect: Hi.\r\n")).toBe("Rep Name: Hello there.\nPat Prospect: Hi.");
    expect(transcriptFromVtt("<html>not captions</html>")).toBe("");
  });

  it("reads the transcript the recording page points to", async () => {
    const calls = mockFetch({
      "/rec/share/abc.DEF_123": { body: page("/nws/recording/2.0/share/abc/feature-config?x=1") },
      "/nws/recording/2.0/share/abc/feature-config": { body: config() },
      "/nws/recording/2.0/share/abc/transcript": { body: items },
    });
    const text = await resolveZoomCallTranscript(LINK);
    expect(text).toContain("Rep Name: Welcome to the call.");
    expect(text).toContain("Pat Prospect: We talked about the business");
    expect(calls.every((url) => new URL(url).hostname === "us06web.zoom.us")).toBe(true);
  });

  it("falls back to the caption file when the item list is unusable", async () => {
    mockFetch({
      "/rec/share/abc.DEF_123": { body: page("/nws/recording/2.0/share/abc/feature-config") },
      "/nws/recording/2.0/share/abc/feature-config": { body: config() },
      "/nws/recording/2.0/share/abc/transcript": { body: "<html>error</html>" },
      "/nws/recording/2.0/share/abc/play/vtt": { body: `WEBVTT\n\n1\n00:00:01.000 --> 00:00:09.000\nPat Prospect: ${long}\n` },
    });
    expect(await resolveZoomCallTranscript(LINK)).toBe(`Pat Prospect: ${long.trim()}`);
  });

  it("returns nothing while Zoom is still processing or has no transcript", async () => {
    mockFetch({
      "/rec/share/abc.DEF_123": { body: page("/nws/recording/2.0/share/abc/feature-config") },
      "/nws/recording/2.0/share/abc/feature-config": { body: { status: true, result: { transcript: { status: "processing", getApi: "/nws/recording/2.0/share/abc/transcript" } } } },
    });
    expect(await resolveZoomCallTranscript(LINK)).toBeNull();
    mockFetch({ "/rec/share/abc.DEF_123": { body: "<html>old page without the player config</html>" } });
    expect(await resolveZoomCallTranscript(LINK)).toBeNull();
    mockFetch({
      "/rec/share/abc.DEF_123": { body: page("/nws/recording/2.0/share/abc/feature-config") },
      "/nws/recording/2.0/share/abc/feature-config": { body: config() },
      "/nws/recording/2.0/share/abc/transcript": { body: { status: true, result: { dataList: [{ userName: "A", text: "Too short." }] } } },
      "/nws/recording/2.0/share/abc/play/vtt": { body: "WEBVTT\n\n1\n00:00:01.000 --> 00:00:02.000\nA: Too short.\n" },
    });
    expect(await resolveZoomCallTranscript(LINK)).toBeNull();
  });

  it("never leaves zoom.us or follows an unexpected path", async () => {
    await expect(resolveZoomCallTranscript("https://example.com/rec/share/abc")).rejects.toThrow("Untrusted Zoom URL");
    await expect(resolveZoomCallTranscript("http://us06web.zoom.us/rec/share/abc")).rejects.toThrow("Untrusted Zoom URL");
    expect(await resolveZoomCallTranscript("https://us06web.zoom.us/j/123456")).toBeNull();

    let calls = mockFetch({ "/rec/share/abc.DEF_123": { body: page("https://evil.example.com/nws/recording/2.0/x") } });
    await expect(resolveZoomCallTranscript(LINK)).rejects.toThrow("Untrusted Zoom URL");
    expect(calls).toHaveLength(1);

    calls = mockFetch({ "/rec/share/abc.DEF_123": { body: page("/account/settings") } });
    expect(await resolveZoomCallTranscript(LINK)).toBeNull();
    expect(calls).toHaveLength(1);

    calls = mockFetch({
      "/rec/share/abc.DEF_123": { body: page("/nws/recording/2.0/share/abc/feature-config") },
      "/nws/recording/2.0/share/abc/feature-config": { body: { status: true, result: { transcript: { status: "success", getApi: "https://other.zoom.us/nws/recording/2.0/share/abc/transcript" } } } },
    });
    expect(await resolveZoomCallTranscript(LINK)).toBeNull();
    expect(calls).toHaveLength(2);

    mockFetch({ "/rec/share/abc.DEF_123": { location: "https://evil.example.com/landing" } });
    await expect(resolveZoomCallTranscript(LINK)).rejects.toThrow("Untrusted Zoom URL");
  });
});
