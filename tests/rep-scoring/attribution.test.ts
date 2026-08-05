import { describe, expect, it } from "vitest";
import { resolveSpeakingRep } from "@/lib/rep-scoring/attribution";

const roster = [
  { email: "samantha@example.com", name: "Samantha Forcash" },
  { email: "ezekiel@example.com", name: "Ezekiel Campbell" },
  { email: "dominique@example.com", name: "Dominique Limbo" },
];

describe("rep speaker attribution", () => {
  it("keeps the assigned rep when that rep is the only substantive roster speaker", () => {
    const result = resolveSpeakingRep(
      "[00:00:01.000] Samantha Forcash: Thanks for joining today and tell me what you want to accomplish.\n[00:00:12.000] Prospect: I want to grow.\n[00:00:20.000] Samantha Forcash: What has prevented that growth so far and what timeline are you working toward?",
      roster[0],
      roster,
    );
    expect(result).toMatchObject({ status: "resolved", substituted: false, resolved: roster[0] });
    expect(result.allowedSpeakerLabels).toEqual(["Samantha Forcash"]);
  });

  it("resolves a unique shortened first name with a transcript role suffix", () => {
    const extendedRoster = [...roster, { email: "adetokunbo@example.com", name: "Adetokunbo Osinaike" }];
    const result = resolveSpeakingRep(
      "[00:00:01.000] Ade | Casting Manager: Thanks for joining and tell me what you want to accomplish with the business.\n[00:00:12.000] Prospect: We want to grow.\n[00:00:20.000] Ade | Casting Manager: What has prevented that growth and what timeline are you working toward?",
      extendedRoster[3],
      extendedRoster,
    );
    expect(result).toMatchObject({ status: "resolved", resolved: extendedRoster[3], substituted: false });
    expect(result.allowedSpeakerLabels).toEqual(["Ade | Casting Manager"]);
  });

  it("attributes an absent assigned rep's call to the known substitute who actually handled it", () => {
    const result = resolveSpeakingRep(
      "[00:00:01.000] Ezekiel Campbell: I am covering for Samantha today because she is running late.\n[00:00:12.000] Prospect: No problem.\n[00:00:20.000] Ezekiel Campbell: Tell me what you are hoping the show will help you accomplish and what is getting in the way.",
      roster[0],
      roster,
    );
    expect(result).toMatchObject({ status: "resolved", substituted: true, resolved: roster[1], confidence: "high" });
  });

  it("quarantines an ambiguous multi-rep call instead of assigning blame", () => {
    const result = resolveSpeakingRep(
      "[00:00:01.000] Samantha Forcash: I will start with the discovery questions and understand your goals today.\n[00:00:12.000] Ezekiel Campbell: I will handle the pricing and explain all of the options after that.\n[00:00:30.000] Samantha Forcash: What outcome matters most to you over the next year?\n[00:00:40.000] Ezekiel Campbell: And what budget have you set aside to achieve that outcome?",
      roster[0],
      roster,
    );
    expect(result).toMatchObject({ status: "quarantine", reason: "multiple_rep_speakers_ambiguous", resolved: null });
  });

  it("quarantines generic or unmapped speaker labels", () => {
    const result = resolveSpeakingRep(
      "[00:00:01.000] Casting Team: Thank you for joining and tell me about your goals today.\n[00:00:20.000] Prospect: I want to grow the business.\n[00:00:30.000] Casting Team: What has stopped that growth and what timeline do you have in mind?",
      { email: "casting@example.com", name: "Casting Team" },
      roster,
    );
    expect(result).toMatchObject({ status: "quarantine", reason: "unmapped_or_insufficient_rep_speech" });
  });
});
