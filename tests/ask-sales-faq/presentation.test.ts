import { describe, expect, it } from "vitest";
import { parseAnswerDisplayList, parseAnswerDisplaySegments, shouldShowPlainAnswerWithStructured } from "@/lib/ask-sales-faq/presentation";

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

  it("suppresses prose that repeats a structured price and payment-plan table", () => {
    expect(shouldShowPlainAnswerWithStructured(
      "The current ISTV prices are $12,000 for Lite, $20,000 for Standard, and $30,000 for VIP/Premium. The listed payment plans are: Lite can be split into 4 payments of $3,000, 3 payments of $4,000, or 2 payments of $6,000; Standard offers 4 payments of $5,000 or 2 payments of $10,000; VIP/Premium offers 4 payments of $7,500, 3 payments of $10,000, or 2 payments of $15,000.",
      {
        summary: "ISTV pricing and payment plans",
        sections: [
          { title: "Prices", items: ["Lite: $12,000", "Standard: $20,000", "VIP/Premium: $30,000"] },
          { title: "Payment Plans", items: ["Lite: 4 x $3,000, 3 x $4,000, or 2 x $6,000", "Standard: 4 x $5,000 or 2 x $10,000", "VIP/Premium: 4 x $7,500, 3 x $10,000, or 2 x $15,000"] },
        ],
        confidenceLabel: "High",
        confidenceScore: 95,
        sourceMode: "evidence",
      },
    )).toBe(false);
  });

  it("keeps a material caveat that is not represented in the structured list", () => {
    expect(shouldShowPlainAnswerWithStructured(
      "The current ISTV prices are $12,000 for Lite, $20,000 for Standard, and $30,000 for VIP/Premium. These amounts cannot be changed without owner approval.",
      {
        summary: "ISTV prices",
        sections: [{ title: "Prices", items: ["Lite: $12,000", "Standard: $20,000", "VIP/Premium: $30,000"] }],
        confidenceLabel: "High",
        confidenceScore: 95,
        sourceMode: "evidence",
      },
    )).toBe(true);
  });
});
