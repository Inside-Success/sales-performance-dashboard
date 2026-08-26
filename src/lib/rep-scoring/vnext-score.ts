export const CALL2_DIMENSIONS = [
  "frame_and_control",
  "prospect_read_and_tailoring",
  "objection_handling",
  "close_mechanics_and_momentum",
] as const;

export type Call2Dimension = (typeof CALL2_DIMENSIONS)[number];
export type ExecutionBand = "absent" | "attempted" | "adequate" | "strong" | "exemplary" | "not_applicable";
export type ScoreConfidence = "high" | "medium" | "low";
export type CallPhase = "closing_call" | "post_sale_or_onboarding" | "scheduling_or_bridge" | "insufficient";
export type ExclusionCategory = "excluded_post_sale_or_onboarding" | "excluded_scheduling_or_bridge" | "insufficient_scoring_opportunity" | "model_marked_ineligible";
export type CriticalEvent =
  | "no_close_attempt"
  | "no_concrete_next_step"
  | "abandoned_primary_objection"
  | "lost_control_unrecovered"
  | "no_adaptation_after_clear_signal";

export type ScoreEvidence = {
  timestamp: string;
  quote: string;
};

export type DimensionAssessment = {
  band: ExecutionBand;
  evidence: ScoreEvidence | null;
  reason: string;
};

export type Call2ManagerAssessment = {
  eligible: boolean;
  ineligible_reason: string | null;
  call_phase: CallPhase;
  confidence: ScoreConfidence;
  dimensions: Record<Call2Dimension, DimensionAssessment>;
  critical_events: Array<{
    type: CriticalEvent;
    evidence: ScoreEvidence;
  }>;
  lead_context: {
    disposition: "engaged" | "neutral" | "resistant" | "hostile" | "disengaged";
    scoring_opportunity: "full" | "partial" | "insufficient";
    reason: string;
  };
  close_signals: {
    direct_commitment_ask: SignalAssessment;
    payment_or_deposit_action: SignalAssessment;
    agreement_confirmed: SignalAssessment;
    onboarding_or_handoff_confirmed: SignalAssessment;
    specific_followup_agreed: SignalAssessment;
  };
};

export type SignalAssessment = {
  present: boolean;
  evidence: ScoreEvidence | null;
};

export type DeterministicCall2Score = {
  eligible: true;
  score: number;
  uncappedScore: number;
  cap: number | null;
  appliedCriticalEvents: CriticalEvent[];
  applicableWeight: number;
  confidence: ScoreConfidence;
  ignoredCriticalEvents: CriticalEvent[];
  calibratedCloseBand: Exclude<ExecutionBand, "not_applicable">;
};

export type InvalidCall2Score = {
  eligible: false;
  reason: string;
  exclusionCategory: ExclusionCategory | null;
  managerMessage: string;
};

const BAND_POINTS: Record<Exclude<ExecutionBand, "not_applicable">, number> = {
  absent: 10,
  attempted: 32,
  adequate: 55,
  strong: 76,
  exemplary: 93,
};

const WEIGHTS: Record<Call2Dimension, number> = {
  frame_and_control: 20,
  prospect_read_and_tailoring: 25,
  objection_handling: 25,
  close_mechanics_and_momentum: 30,
};

const CRITICAL_CAPS: Record<CriticalEvent, number> = {
  no_close_attempt: 49,
  no_concrete_next_step: 54,
  abandoned_primary_objection: 59,
  lost_control_unrecovered: 49,
  no_adaptation_after_clear_signal: 64,
};

function normalizedText(value: string) {
  return value.replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').replace(/\s+/g, " ").trim().toLowerCase();
}

function evidenceIsGrounded(evidence: ScoreEvidence | null, transcript: string) {
  if (!evidence?.quote) return false;
  const words = (value: string) => normalizedText(value).match(/[a-z0-9]+(?:'[a-z0-9]+)*/g) || [];
  const quoteWords = words(evidence.quote);
  if (quoteWords.length < 2) return false;
  const lines = transcript.split(/\r?\n/);
  if (quoteWords.length < 5) {
    const exactMatches = lines.filter((line) => {
      if (!/\[[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]{1,3})?\]/.test(line)) return false;
      if (!line.slice(line.indexOf("]") + 1).includes(":")) return false;
      const lineWords = words(line);
      return lineWords.some((_, start) => quoteWords.every((word, offset) => lineWords[start + offset] === word));
    });
    return exactMatches.length === 1;
  }
  return lines.some((line) => {
    const timestamp = line.match(/\[[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]{1,3})?\]/)?.[0];
    if (!timestamp) return false;
    if (!line.slice(line.indexOf("]") + 1).includes(":")) return false;
    const lineWords = words(line);
    const longest = Math.min(10, quoteWords.length);
    return Array.from({ length: Math.max(0, longest - 4) }, (_, index) => longest - index).some((length) =>
      lineWords.some((_, start) => quoteWords.slice(0, length).every((word, offset) => lineWords[start + offset] === word)),
    );
  });
}

function excluded(reason: string, category: ExclusionCategory | null = null): InvalidCall2Score {
  const managerMessage = category === "excluded_post_sale_or_onboarding"
    ? "Excluded — post-sale or onboarding call; not included in the closer score."
    : category === "excluded_scheduling_or_bridge"
      ? "Excluded — scheduling or bridge call; not included in the closer score."
      : "Not scored — this call did not provide enough reliable Call 2 closing evidence.";
  return { eligible: false, reason, exclusionCategory: category, managerMessage };
}

function bandAtLeast(current: Exclude<ExecutionBand, "not_applicable">, floor: Exclude<ExecutionBand, "not_applicable">) {
  const order: Array<Exclude<ExecutionBand, "not_applicable">> = ["absent", "attempted", "adequate", "strong", "exemplary"];
  return order[Math.max(order.indexOf(current), order.indexOf(floor))];
}

export function computeCall2Score(
  assessment: Call2ManagerAssessment,
  transcript: string,
): DeterministicCall2Score | InvalidCall2Score {
  if (assessment.call_phase === "post_sale_or_onboarding") return excluded("post_sale_or_onboarding", "excluded_post_sale_or_onboarding");
  if (assessment.call_phase === "scheduling_or_bridge") return excluded("scheduling_or_bridge", "excluded_scheduling_or_bridge");
  if (!assessment.eligible) return excluded(assessment.ineligible_reason || "model_marked_ineligible", "model_marked_ineligible");
  if (assessment.lead_context.scoring_opportunity === "insufficient") {
    return excluded("insufficient_scoring_opportunity", "insufficient_scoring_opportunity");
  }

  const providedSignals = assessment.close_signals;
  if (!providedSignals) return excluded("missing_close_signals");
  const signals = structuredClone(providedSignals);
  for (const [name, signal] of Object.entries(signals)) {
    if (typeof signal?.present !== "boolean") return excluded(`invalid_close_signal:${name}`);
    if (signal.present && !evidenceIsGrounded(signal.evidence, transcript)) {
      signal.present = false;
      signal.evidence = null;
    }
  }

  let weightedPoints = 0;
  let applicableWeight = 0;
  for (const dimension of CALL2_DIMENSIONS) {
    const item = assessment.dimensions?.[dimension];
    if (!item) return excluded(`missing_dimension:${dimension}`);
    if (item.band === "not_applicable") {
      if (dimension !== "objection_handling") return excluded(`invalid_not_applicable:${dimension}`);
      continue;
    }
    if (!(item.band in BAND_POINTS)) return excluded(`invalid_band:${dimension}`);
    if (!evidenceIsGrounded(item.evidence, transcript)) return excluded(`ungrounded_dimension_evidence:${dimension}`);
    let calibratedBand = item.band;
    if (dimension === "close_mechanics_and_momentum") {
      const exemplarySequence = signals.payment_or_deposit_action.present && signals.agreement_confirmed.present && signals.onboarding_or_handoff_confirmed.present;
      const controlledContinuation = signals.direct_commitment_ask.present && signals.specific_followup_agreed.present
        && (signals.payment_or_deposit_action.present || signals.agreement_confirmed.present);
      const directAskWithNextStep = signals.direct_commitment_ask.present && signals.specific_followup_agreed.present;
      if (exemplarySequence) calibratedBand = bandAtLeast(calibratedBand, "exemplary");
      else if (controlledContinuation) calibratedBand = bandAtLeast(calibratedBand, "strong");
      else if (directAskWithNextStep) calibratedBand = bandAtLeast(calibratedBand, "adequate");
    }
    weightedPoints += BAND_POINTS[calibratedBand] * WEIGHTS[dimension];
    applicableWeight += WEIGHTS[dimension];
  }

  if (applicableWeight < 75) return excluded("insufficient_applicable_weight");

  const appliedCriticalEvents: CriticalEvent[] = [];
  const ignoredCriticalEvents: CriticalEvent[] = [];
  for (const event of assessment.critical_events || []) {
    if (!(event.type in CRITICAL_CAPS)) return excluded(`invalid_critical_event:${String(event.type)}`);
    if (!evidenceIsGrounded(event.evidence, transcript)) return excluded(`ungrounded_critical_event:${event.type}`);
    if ((event.type === "no_close_attempt" && signals.direct_commitment_ask.present)
      || (event.type === "no_concrete_next_step" && (signals.specific_followup_agreed.present || signals.payment_or_deposit_action.present))) {
      ignoredCriticalEvents.push(event.type);
      continue;
    }
    appliedCriticalEvents.push(event.type);
  }

  const uncappedScore = Math.round((weightedPoints / applicableWeight) * 10) / 10;
  const cap = appliedCriticalEvents.length
    ? Math.min(...appliedCriticalEvents.map((event) => CRITICAL_CAPS[event]))
    : null;
  const score = Math.round(Math.min(uncappedScore, cap ?? 100) * 10) / 10;
  const rawCloseBand = assessment.dimensions.close_mechanics_and_momentum.band as Exclude<ExecutionBand, "not_applicable">;
  const exemplarySequence = signals.payment_or_deposit_action.present && signals.agreement_confirmed.present && signals.onboarding_or_handoff_confirmed.present;
  const controlledContinuation = signals.direct_commitment_ask.present && signals.specific_followup_agreed.present
    && (signals.payment_or_deposit_action.present || signals.agreement_confirmed.present);
  const directAskWithNextStep = signals.direct_commitment_ask.present && signals.specific_followup_agreed.present;
  const calibratedCloseBand = exemplarySequence ? bandAtLeast(rawCloseBand, "exemplary")
    : controlledContinuation ? bandAtLeast(rawCloseBand, "strong")
      : directAskWithNextStep ? bandAtLeast(rawCloseBand, "adequate") : rawCloseBand;

  return {
    eligible: true,
    score,
    uncappedScore,
    cap,
    appliedCriticalEvents,
    applicableWeight,
    confidence: assessment.confidence,
    ignoredCriticalEvents,
    calibratedCloseBand,
  };
}

export function recentCall2Average(scoresNewestFirst: number[], windowSize = 5) {
  const window = scoresNewestFirst.filter(Number.isFinite).slice(0, windowSize);
  if (!window.length) return null;
  return Math.round((window.reduce((sum, value) => sum + value, 0) / window.length) * 10) / 10;
}
