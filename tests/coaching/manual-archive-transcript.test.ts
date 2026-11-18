import { expect, it } from "vitest";
import { formatManualArchivedTranscript } from "@/lib/manual-transcript-archive";

it("converts archive cues without changing the timestamp or speech", () => {
  const input = "[segment 1 00:03:16.570] Rep: What would make this worthwhile?\n[segment 1 00:03:18.650] Buyer: I would need to clear it with my partner.";
  expect(formatManualArchivedTranscript(input)).toBe(
    "[00:03:16.570] Rep: What would make this worthwhile?\n[00:03:18.650] Buyer: I would need to clear it with my partner.",
  );
});

it("retains part labels when timestamps are segment-relative", () => {
  expect(formatManualArchivedTranscript("[segment 1 00:43:12.000] Buyer: That's right.\n[segment 2 00:00:08.000] Rep: Let's walk through that.")).toBe(
    "[00:43:12.000] [segment 1] Buyer: That's right.\n[00:00:08.000] [segment 2] Rep: Let's walk through that.",
  );
});
