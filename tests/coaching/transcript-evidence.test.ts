import { describe, expect, it } from "vitest";
import { findTranscriptMatch, parseTranscriptLines, timestampSeconds } from "@/lib/transcript-evidence";

describe("transcript evidence matching", () => {
  it("matches a cited second to a timestamped speaker line with milliseconds", () => {
    const lines = parseTranscriptLines("Call transcript\n[00:42:16.830] Buyer: I need to compare the options.\n[00:42:27.200] Rep: Of course.");
    expect(findTranscriptMatch(lines, "00:42:16")).toEqual({ index: 1, kind: "exact" });
  });

  it("handles two-part times, escaped brackets, and VTT cue starts", () => {
    const lines = parseTranscriptLines("\\[01:05:03.150\\] Rep: Let's review.\n01:05:07.200 --> 01:05:10.400\nFollow-up text");
    expect(lines[0].seconds).toBe(3903);
    expect(findTranscriptMatch(lines, "65:07")).toEqual({ index: 1, kind: "exact" });
    expect(findTranscriptMatch(lines, "01:05:07")).toEqual({ index: 1, kind: "exact" });
  });

  it("labels a close but non-exact line and refuses distant guesses", () => {
    const lines = parseTranscriptLines("[00:03:12.000] Buyer: Question.\n[00:03:30.000] Rep: Answer.");
    expect(findTranscriptMatch(lines, "00:03:15")).toEqual({ index: 0, kind: "nearby" });
    expect(findTranscriptMatch(lines, "00:05:00")).toEqual({ index: -1, kind: "missing" });
    expect(timestampSeconds("bad time")).toBeNull();
  });
});
