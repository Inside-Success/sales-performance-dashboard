import { describe, expect, it } from "vitest";
import { parseAnswerDisplayList, parseAnswerDisplaySegments } from "@/lib/ask-sales-faq/presentation";

describe("Ask Sales FAQ answer presentation", () => {
  it("turns a flattened package enumeration into a real list", () => {
    const parsed = parseAnswerDisplayList(
      "The approved options are: - **Lite**: PIF $10,000 - **Standard**: PIF $15,000 - **Premium VIP**: PIF $20,000 - **CEO Day upgrade**: PIF $5,000",
    );

    expect(parsed).toEqual({
      intro: "The approved options are:",
      items: [
        "**Lite**: PIF $10,000",
        "**Standard**: PIF $15,000",
        "**Premium VIP**: PIF $20,000",
        "**CEO Day upgrade**: PIF $5,000",
      ],
    });
  });

  it("does not split ordinary prose containing a dash", () => {
    expect(parseAnswerDisplayList("Use the current process - then check with the owner if the case changes.")).toBeNull();
  });

  it("identifies safe inline emphasis without rendering raw markdown markers", () => {
    expect(parseAnswerDisplaySegments("**Lite**: PIF $10,000")).toEqual([
      { text: "Lite", strong: true },
      { text: ": PIF $10,000", strong: false },
    ]);
  });
});
