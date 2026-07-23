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

  it("does not mistake a Call 1 workflow label for a one-episode count", () => {
    expect(extractV4TypedFacts("The applicant can mention both businesses during the Call 1 episode.")).toEqual([]);
    expect(extractV4TypedFacts("The package includes one episode.").map((fact) => fact.canonical)).toContain("count:episode:1");
  });

  it("does not infer that explanatory material is unavailable from evidence silence", () => {
    expect(deterministicV4SentenceErrors(
      "No additional explanatory material is available.",
      "The former weekly program is discontinued. Use Rudy's call videos and the current Media Kit assets instead.",
    )).toContain("absence of evidence cannot establish that no material is available");
    expect(deterministicV4SentenceErrors(
      "No additional explanatory material is available.",
      "The program is discontinued, and no additional explanatory material is available.",
    )).not.toContain("absence of evidence cannot establish that no material is available");
  });

  it("does not transfer documentary-only styling onto the podcast format", () => {
    const evidence = "The podcast is designed around exposure, authority, credibility, background story, trust, and education. The documentary episode uses a Hollywood-documentary style focused on emotional storytelling and trust.";
    expect(deterministicV4SentenceErrors(
      "The podcast episode structure builds trust through a Hollywood-documentary style of emotional storytelling.",
      evidence,
    )).toContain("documentary-only style evidence cannot define the podcast structure");
    expect(deterministicV4SentenceErrors(
      "The podcast is designed around authority and trust, while the documentary episode uses a Hollywood-documentary style.",
      evidence,
    )).not.toContain("documentary-only style evidence cannot define the podcast structure");
  });

  it("does not turn a freelancing-alone boundary into an absolute business prerequisite", () => {
    const evidence = "Freelancing by itself should not be treated as entrepreneurship for qualification. Evaluate whether the person has a genuine business, offer, ownership, and broader fit rather than qualifying them solely because they take freelance jobs.";
    expect(deterministicV4SentenceErrors(
      "Freelancers should not be moved to Call 2 without an established business.",
      evidence,
    )).toContain("freelancing-alone evidence cannot create an absolute established-business prerequisite");
    expect(deterministicV4SentenceErrors(
      "Freelancing by itself should not be treated as entrepreneurship for qualification.",
      evidence,
    )).not.toContain("freelancing-alone evidence cannot create an absolute established-business prerequisite");
  });

  it("treats hyphenated policy durations as the same typed fact as natural answer wording", () => {
    expect(unsupportedV4TypedFacts(
      "The ownership window expires 30 days after the logged contact.",
      "A documented contact refreshes the 30-day ownership window.",
    )).toEqual([]);
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

  it("does not turn a prohibition into permission for an unstated alternative", () => {
    expect(deterministicV4SentenceErrors(
      "You may reference the internal statistics in a message.",
      "Do not share internal statistics or send internal screenshots to prospects.",
    )).toContain("prohibitive evidence cannot authorize an unstated permission");
    expect(deterministicV4SentenceErrors(
      "You may reference public information in a message.",
      "You may reference public information, but do not share internal statistics or screenshots.",
    )).not.toContain("prohibitive evidence cannot authorize an unstated permission");
    expect(deterministicV4SentenceErrors(
      "Reps can schedule through a public or personal calendar, but must not touch the master calendar.",
      "Scheduling is up to the rep through public/personal calendar hours, but do not touch the master calendar.",
    )).not.toContain("prohibitive evidence cannot authorize an unstated permission");
  });

  it("allows an exact evidence-backed internal channel while still rejecting invented channels", () => {
    expect(deterministicV4SentenceErrors(
      "Use the DJ contract channel <#C07QJ2AJWJU> to verify the signed contract.",
      "Use the DJ contract channel <#C07QJ2AJWJU> to verify signed contracts.",
    )).not.toContain(expect.stringContaining("unapproved route channels"));
    expect(deterministicV4SentenceErrors(
      "Use #invented-contract-channel to verify the signed contract.",
      "Use the DJ contract channel <#C07QJ2AJWJU> to verify signed contracts.",
    )).toContain("unapproved route channels: #invented-contract-channel");
  });

  it("allows request amounts only when applying an explicit all-unlisted-splits boundary", () => {
    const request = "The client proposes $3K now and $17K in three weeks.";
    const genericBoundary = "Treat any combination of payment amounts or dates that is not one of the current listed plans as a custom split.";
    expect(deterministicV4SentenceErrors(
      "The proposed $3K now and $17K later is an unlisted custom split.",
      genericBoundary,
      request,
    )).not.toContain(expect.stringContaining("unsupported typed facts"));
    expect(deterministicV4SentenceErrors(
      "The approved plan costs $3K now and $17K later.",
      "Use only approved payment plans.",
      request,
    )).toContain("unsupported typed facts: $3K, $17K");
  });
});
