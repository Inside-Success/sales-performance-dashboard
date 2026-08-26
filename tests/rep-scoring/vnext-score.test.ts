import { describe, expect, it } from "vitest";
import {
  computeCall2Score,
  recentCall2Average,
  type Call2ManagerAssessment,
  type ExecutionBand,
} from "@/lib/rep-scoring/vnext-score";

const transcript = [
  "[00:01:00.000] Rep: Here is how we will use this call.",
  "[00:06:00.000] Rep: You said visibility is the main gap, so this package gives you the reusable authority assets you described.",
  "[00:12:00.000] Prospect: I need to think about the price.",
  "[00:12:20.000] Rep: When you say price, is the concern the total investment or whether the value is clear?",
  "[00:20:00.000] Rep: Are you ready to secure the spot with the deposit today?",
].join("\n");

const evidence = (timestamp: string, quote: string) => ({ timestamp, quote });

function assessment(bands: [ExecutionBand, ExecutionBand, ExecutionBand, ExecutionBand]): Call2ManagerAssessment {
  return {
    eligible: true,
    ineligible_reason: null,
    call_phase: "closing_call",
    confidence: "high",
    lead_context: { disposition: "engaged", scoring_opportunity: "full", reason: "Full closing conversation." },
    dimensions: {
      frame_and_control: { band: bands[0], evidence: evidence("[00:01:00.000]", "Here is how we will use this call."), reason: "Clear frame." },
      prospect_read_and_tailoring: { band: bands[1], evidence: evidence("[00:06:00.000]", "You said visibility is the main gap"), reason: "Specific tailoring." },
      objection_handling: { band: bands[2], evidence: evidence("[00:12:20.000]", "is the concern the total investment or whether the value is clear?"), reason: "Clarified the objection." },
      close_mechanics_and_momentum: { band: bands[3], evidence: evidence("[00:20:00.000]", "Are you ready to secure the spot with the deposit today?"), reason: "Clear ask." },
    },
    critical_events: [],
    close_signals: {
      direct_commitment_ask: { present: true, evidence: evidence("[00:20:00.000]", "Are you ready to secure the spot with the deposit today?") },
      payment_or_deposit_action: { present: false, evidence: null },
      agreement_confirmed: { present: false, evidence: null },
      onboarding_or_handoff_confirmed: { present: false, evidence: null },
      specific_followup_agreed: { present: false, evidence: null },
    },
  };
}

describe("computeCall2Score", () => {
  it("computes a weighted score from rubric bands", () => {
    const result = computeCall2Score(assessment(["adequate", "strong", "strong", "strong"]), transcript);
    expect(result).toMatchObject({ eligible: true, score: 71.8, uncappedScore: 71.8, cap: null });
  });

  it("uses the full scale when the evidence supports the extremes", () => {
    expect(computeCall2Score(assessment(["absent", "absent", "absent", "absent"]), transcript)).toMatchObject({ score: 10 });
    expect(computeCall2Score(assessment(["exemplary", "exemplary", "exemplary", "exemplary"]), transcript)).toMatchObject({ score: 93 });
  });

  it("renormalizes only when no objection was present", () => {
    const item = assessment(["strong", "strong", "not_applicable", "adequate"]);
    item.dimensions.objection_handling.evidence = null;
    expect(computeCall2Score(item, transcript)).toMatchObject({ eligible: true, score: 67.6, applicableWeight: 75 });
  });

  it("rejects ungrounded evidence instead of publishing a score", () => {
    const item = assessment(["strong", "strong", "strong", "strong"]);
    item.dimensions.frame_and_control.evidence = evidence("[99:99:99.999]", "invented quote");
    expect(computeCall2Score(item, transcript)).toMatchObject({ eligible: false, reason: "ungrounded_dimension_evidence:frame_and_control" });
  });

  it("accepts an exact quote when code can recover the transcript timestamp", () => {
    const item = assessment(["strong", "strong", "strong", "strong"]);
    item.dimensions.frame_and_control.evidence = evidence("[00:00:59.000]", "Here is how we will use this call.");
    expect(computeCall2Score(item, transcript)).toMatchObject({ eligible: true, score: 76 });
  });

  it("accepts a concise two-word quote only when it is unique in the transcript", () => {
    const shortTranscript = `${transcript}\n[00:21:00.000] Prospect: Payment confirmed.`;
    const item = assessment(["strong", "strong", "strong", "exemplary"]);
    item.dimensions.close_mechanics_and_momentum.evidence = evidence("[00:21:00.000]", "Payment confirmed");
    expect(computeCall2Score(item, shortTranscript)).toMatchObject({ eligible: true, score: 81.1 });
    item.dimensions.close_mechanics_and_momentum.evidence = evidence("[00:20:59.000]", "Payment confirmed");
    expect(computeCall2Score(item, shortTranscript)).toMatchObject({ eligible: true, score: 81.1 });
    const duplicated = `${shortTranscript}\n[00:22:00.000] Rep: Payment confirmed.`;
    expect(computeCall2Score(item, duplicated)).toMatchObject({ eligible: false, reason: "ungrounded_dimension_evidence:close_mechanics_and_momentum" });
  });

  it("grounds a clean prefix while ignoring punctuation-only model drift", () => {
    const item = assessment(["strong", "strong", "strong", "strong"]);
    item.dimensions.frame_and_control.evidence = evidence("[00:00:59.000]", "Here is how we will use this call invented tail");
    expect(computeCall2Score(item, transcript)).toMatchObject({ eligible: true, score: 76 });
  });

  it("applies a hard cap only when the critical event has transcript evidence", () => {
    const item = assessment(["strong", "strong", "strong", "strong"]);
    item.critical_events = [{
      type: "no_concrete_next_step",
      evidence: evidence("[00:20:00.000]", "Are you ready to secure the spot with the deposit today?"),
    }];
    expect(computeCall2Score(item, transcript)).toMatchObject({ eligible: true, uncappedScore: 76, score: 54, cap: 54 });
  });

  it("fails closed when the call gives insufficient scoring opportunity", () => {
    const item = assessment(["adequate", "adequate", "not_applicable", "adequate"]);
    item.lead_context.scoring_opportunity = "insufficient";
    expect(computeCall2Score(item, transcript)).toMatchObject({ eligible: false, reason: "insufficient_scoring_opportunity" });
  });

  it("excludes post-sale calls with a manager-readable label", () => {
    const item = assessment(["strong", "strong", "not_applicable", "strong"]);
    item.call_phase = "post_sale_or_onboarding";
    const result = computeCall2Score(item, transcript);
    expect(result).toMatchObject({ eligible: false, exclusionCategory: "excluded_post_sale_or_onboarding" });
    if (result.eligible) throw new Error("Expected post-sale call to be excluded.");
    expect(result.managerMessage).toContain("not included in the closer score");
  });

  it("floors a controlled payment continuation at strong and ignores contradictory events", () => {
    const item = assessment(["adequate", "strong", "attempted", "attempted"]);
    item.close_signals.payment_or_deposit_action = { present: true, evidence: evidence("[00:20:00.000]", "secure the spot with the deposit today") };
    item.close_signals.specific_followup_agreed = { present: true, evidence: evidence("[00:20:00.000]", "Are you ready to secure the spot with the deposit today?") };
    item.critical_events = [{ type: "no_close_attempt", evidence: evidence("[00:20:00.000]", "Are you ready to secure the spot with the deposit today?") }];
    expect(computeCall2Score(item, transcript)).toMatchObject({ eligible: true, score: 60.8, calibratedCloseBand: "strong", ignoredCriticalEvents: ["no_close_attempt"] });
  });

  it("fails an ungrounded auxiliary signal closed without discarding grounded dimensions", () => {
    const item = assessment(["adequate", "strong", "attempted", "attempted"]);
    item.close_signals.payment_or_deposit_action = { present: true, evidence: evidence("[99:99:99.999]", "invented payment confirmation") };
    expect(computeCall2Score(item, transcript)).toMatchObject({ eligible: true, score: 47.6, calibratedCloseBand: "attempted" });
  });
});

describe("recentCall2Average", () => {
  it("uses only the five most recent scores", () => {
    expect(recentCall2Average([40, 50, 60, 70, 80, 100])).toBe(60);
  });

  it("returns null without scored Call 2s", () => {
    expect(recentCall2Average([])).toBeNull();
  });
});
