import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveZoomTranscript } from "@/lib/zoom-transcript";

const origin = "https://us06web.zoom.us";
const share = origin + "/rec/share/fixture";
const metadata = "/nws/recording/2.0/share/fixture?pageType=web";
const player = `<script>window.__zm_unified_player__ = { "playInfoApi": "${metadata}" };</script>`;
const body = "Buyer: I need to understand whether my team can reuse these clips after our episode goes live.";
const identity = { owner: "Example Rep", title: "Buyer – Casting Follow-up", startedAt: "2026-11-17T18:58:25.000Z" };

function playInfo(transcriptUrl?: string) {
  return Response.json({ status: true, result: { mediaInfo: {
    mediaId: "fixture-media", ownerName: identity.owner, mediaTopic: identity.title,
    createdTime: Date.parse(identity.startedAt), transcriptUrl,
  } } });
}

afterEach(() => vi.unstubAllGlobals());

describe("Zoom transcript resolution", () => {
  it("uses unified player captions without looking in the archive", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response(player)).mockResolvedValueOnce(playInfo("/captions/fixture.vtt"))
      .mockResolvedValueOnce(new Response(`WEBVTT\n\n1\n00:00:01.000 --> 00:00:04.000\n<v Buyer>${body.replace("Buyer: ", "")}</v>`));
    vi.stubGlobal("fetch", fetch);
    const archive = vi.fn();
    const result = await resolveZoomTranscript(share, archive);
    expect(result).toEqual({ fileId: "fixture-media", transcriptUrl: origin + "/captions/fixture.vtt", transcriptText: "[00:00:01.000] " + body });
    expect(fetch.mock.calls[1][0].href).toBe(origin + metadata);
    expect(archive).not.toHaveBeenCalled();
  });

  it("uses the authorized archive fallback when the share has no captions", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response(player)).mockResolvedValueOnce(playInfo()));
    const archive = vi.fn().mockResolvedValue(body);
    expect(await resolveZoomTranscript(share, archive)).toEqual({ transcriptText: body, transcriptUrl: null, fileId: "fixture-media" });
    expect(archive).toHaveBeenCalledExactlyOnceWith(identity);
  });

  it("leaves private or unrecognized shares on the paste path", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response(player))
      .mockResolvedValueOnce(Response.json({ status: false, result: {} })));
    const archive = vi.fn();
    await expect(resolveZoomTranscript(share, archive)).resolves.toBeNull();
    expect(archive).not.toHaveBeenCalled();
  });

  it("still resolves legacy player metadata", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response("window.recordingMobilePlayData = {fileId: 'legacy'};"))
      .mockResolvedValueOnce(Response.json({ result: { ccUrl: "/captions/old.vtt" } }))
      .mockResolvedValueOnce(new Response(body));
    vi.stubGlobal("fetch", fetch);
    expect(await resolveZoomTranscript(share)).toMatchObject({ fileId: "legacy", transcriptText: body });
  });

  it("rejects non-Zoom input and off-domain redirects before fetching them", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response("", {status: 302, headers: {location: "https://outside.invalid/rec/share/fixture"}}));
    vi.stubGlobal("fetch", fetch);
    await expect(resolveZoomTranscript("https://zoom.us.outside.invalid/rec/share/fixture")).rejects.toThrow("Untrusted Zoom URL");
    expect(fetch).not.toHaveBeenCalled();
    await expect(resolveZoomTranscript(share)).rejects.toThrow("Untrusted Zoom URL");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
