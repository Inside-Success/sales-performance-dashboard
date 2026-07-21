import { describe, expect, it } from "vitest";
import { deterministicV4SentenceErrors, extractV4TypedFacts, unsupportedV4TypedFacts } from "@/lib/ask-sales-faq/v4/facts";

describe("Ask Sales V4 typed facts", () => {
  it("treats compact and expanded money formats as the same amount", () => {
    expect(unsupportedV4TypedFacts("Standard is $20k.", "Standard is $20,000.")).toEqual([]);
    expect(unsupportedV4TypedFacts("The first payment is $2.5k.", "The first payment is $2,500.")).toEqual([]);
    expect(unsupportedV4TypedFacts("The license is 20K.", "The license is $20,000.")).toEqual([]);
  });

  it("keeps currency amounts, percentages, and durations structurally distinct", () => {
    expect(extractV4TypedFacts("Pay $2,500, receive 20%, and wait 3 business days.").map((fact) => fact.canonical)).toEqual([
      "money:usd:2500",
      "percentage:20",
      "duration:business-day:3",
    ]);
  });

  it("rejects an unsupported amount without discarding equivalent formatting", () => {
    expect(unsupportedV4TypedFacts("The package is $30,000.", "The package is $20k.").map((fact) => fact.canonical)).toEqual(["money:usd:30000"]);
  });

  it("blocks changing one qualifying Tier-1 platform into all three", () => {
    expect(deterministicV4SentenceErrors(
      "VIP guarantees submission to all three Tier-1 platforms.",
      "VIP includes submission to any one of three Tier-1 platforms; placement is not guaranteed.",
    )).toEqual(expect.arrayContaining([
      expect.stringContaining("one qualifying platform"),
      expect.stringContaining("guarantee"),
    ]));
  });

  it("normalizes counts, minute/hour durations, exact dates, and deadline weekdays", () => {
    expect(extractV4TypedFacts("Use 4 payments, wait 90 minutes, and close by Sunday on July 21, 2026.").map((fact) => fact.canonical)).toEqual(expect.arrayContaining([
      "count:payment:4",
      "duration:minute:90",
      "deadline:weekday:sunday",
      "date:2026-07-21",
    ]));
    expect(unsupportedV4TypedFacts("The call is 2 hours.", "The call is 90 minutes.").map((fact) => fact.canonical)).toContain("duration:hour:2");
  });

  it("treats equivalent ranges alike and rejects a changed endpoint", () => {
    expect(unsupportedV4TypedFacts("The episode runs 12 to 15 minutes.", "The episode runs 12–15 minutes.")).toEqual([]);
    expect(unsupportedV4TypedFacts("The episode runs 10-15 minutes.", "The episode runs 12–15 minutes.").map((fact) => fact.canonical)).toContain("range:duration:minute:10:15");
    expect(unsupportedV4TypedFacts("The plan has 2 to 4 payments.", "The plan has 2–4 installments.")).toEqual([]);
  });

  it("preserves guarantee polarity instead of reading a negation as a promise", () => {
    expect(deterministicV4SentenceErrors("Placement is not guaranteed.", "Placement cannot be guaranteed.")).not.toContain(expect.stringContaining("guarantee"));
    expect(deterministicV4SentenceErrors("We do not guarantee placement.", "There is no guarantee of placement.")).not.toContain(expect.stringContaining("guarantee"));
    expect(deterministicV4SentenceErrors("Placement is guaranteed.", "Placement is not guaranteed.")).toContain("unsupported positive guarantee language");
    expect(deterministicV4SentenceErrors("Placement is not guaranteed.", "Placement is guaranteed.")).toContain("unsupported negative guarantee boundary");
  });
});
