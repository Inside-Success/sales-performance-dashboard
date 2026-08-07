import { describe, expect, it } from "vitest";
import {
  evidenceConfidence,
  getCallInsights,
  getManagerCallContextEntries,
  humanize,
  normalizeBehaviours,
  normalizeDimensions,
} from "@/lib/rep-scoring/presentation";

describe("rep scoring presentation", () => {
  it("keeps manager context while hiding workflow-internal audit payloads", () => {
    expect(getManagerCallContextEntries({
      Outcome: "Follow-up booked",
      Summary: "Prospect requested the contract.",
      Ensemble: { reviews: 3 },
      validation_corrections: ["Removed unsupported quote"],
      Attribution: { speakingRep: "Rep" },
      "Scorer Version": "rep-reviewer-v4.3",
    })).toEqual([
      ["Outcome", "Follow-up booked"],
      ["Summary", "Prospect requested the contract."],
    ]);
  });

  it("explains the deterministic contribution behind a score", () => {
    const dimensions = normalizeDimensions("Call 1", [
      { key: "discovery", applicability: "applicable", band: "Unacceptable", reason: "No discovery", evidence: [] },
      { key: "next_steps", applicability: "applicable", band: "Meets Expectations", reason: "Clear follow-up", evidence: [{ timestamp: "00:02:50", speaker: "Rep", quote: "Reach back out whenever you are ready." }] },
    ]);

    expect(dimensions[0]).toMatchObject({ label: "Discovery quality", weight: 0.3, points: 0, contribution: 0 });
    expect(dimensions[1]).toMatchObject({ label: "Clear next step", weight: 0.15, points: 75, contribution: 11.3 });
  });

  it("turns machine behavior names into manager-readable labels", () => {
    expect(humanize("confirmed_decision_maker_status")).toBe("Confirmed decision maker status");
    expect(normalizeBehaviours([{ name: "asked_budget_question", status: "met" }])[0]).toMatchObject({
      label: "Asked budget question",
      status: "met",
    });
  });

  it("normalizes V5 checkpoint statuses and stored weights", () => {
    const dimensions = normalizeDimensions("Call 1", [
      { key: "progression_decision", label: "Correct progression decision", weight: 0.15, applicability: "applicable", status: "completed", reason: "Correctly rejected an unsuitable prospect." },
      { key: "next_steps_prework", label: "Concrete next step", weight: 0.1, applicability: "not_observable", status: "missed" },
    ]);

    expect(dimensions[0]).toMatchObject({ label: "Correct progression decision", weight: 0.15, points: 100, contribution: 15 });
    expect(dimensions[1]).toMatchObject({ applicability: "not_observable", weight: 0.1, points: 20 });
    expect(getCallInsights("Call 1", dimensions)).toEqual({ coachingPriority: "Correct progression decision", strongestArea: "Correct progression decision" });
  });

  it("keeps sample confidence factual", () => {
    expect(evidenceConfidence(1)).toBe("1 call only");
    expect(evidenceConfidence(3)).toBe("Early evidence");
    expect(evidenceConfidence(15)).toBe("Strong evidence");
  });

  it("identifies the weakest and strongest scored dimensions", () => {
    expect(getCallInsights("Call 2+", [
      { key: "pricing", band: "Needs Improvement" },
      { key: "contract_and_close", band: "Excellent" },
    ])).toEqual({ coachingPriority: "Pricing explanation", strongestArea: "Contract and close" });
  });
});
