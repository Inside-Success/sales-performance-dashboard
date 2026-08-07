export const BAND_POINTS: Record<string, number> = {
  Unacceptable: 0,
  "Needs Improvement": 25,
  Developing: 50,
  "Meets Expectations": 75,
  Excellent: 100,
};

export const DIMENSION_LABELS: Record<string, string> = {
  discovery: "Discovery quality",
  qualification: "Qualification and fit",
  authority: "Decision authority",
  value: "Value alignment",
  next_steps: "Clear next step",
  agenda: "Agenda and call control",
  pricing: "Pricing explanation",
  objection_handling: "Objection handling",
  green_light_letter: "Green Light Letter positioning",
  onboarding: "Onboarding clarity",
  contract_and_close: "Contract and close",
};

export const DIMENSION_WEIGHTS: Record<string, Record<string, number>> = {
  "Call 1": {
    discovery: 0.3,
    qualification: 0.2,
    authority: 0.15,
    value: 0.2,
    next_steps: 0.15,
  },
  "Call 2+": {
    agenda: 0.1,
    pricing: 0.2,
    objection_handling: 0.2,
    green_light_letter: 0.15,
    onboarding: 0.15,
    contract_and_close: 0.2,
  },
};

export type EvidenceQuote = {
  timestamp: string;
  speaker: string;
  quote: string;
};

export type ScoreDimension = {
  key: string;
  label: string;
  applicability: string;
  band: string;
  reason: string;
  weight: number | null;
  points: number | null;
  contribution: number | null;
  evidence: EvidenceQuote[];
};

export type BehaviourCheck = {
  name: string;
  label: string;
  status: string;
  timestamp: string;
  speaker: string;
  quote: string;
  validationNote: string;
};

const INTERNAL_CALL_CONTEXT_KEYS = new Set([
  "attribution",
  "configversion",
  "ensemble",
  "model",
  "promptversion",
  "rubricversion",
  "scorerversion",
  "validationcorrections",
  "weightsversion",
  "transcriptreliability",
  "opportunity",
  "externalfactors",
  "findings",
  "validation",
  "callcontext",
  "sourcev43",
]);

const V5_STATUS_POINTS: Record<string, number> = {
  completed: 100,
  partial: 60,
  missed: 20,
};

const V5_STATUS_BANDS: Record<string, string> = {
  completed: "Excellent",
  partial: "Developing",
  missed: "Needs Improvement",
};

export function normalizeDimensions(callType: string, values: unknown[]): ScoreDimension[] {
  return values.flatMap((value) => {
    const object = asObject(value);
    if (!object) return [];
    const key = text(object.key || object.dimension || object.name);
    const status = text(object.status).toLowerCase();
    const band = text(object.band) || V5_STATUS_BANDS[status] || "";
    const storedWeight = number(object.weight);
    const storedPoints = number(object.points);
    const weight = storedWeight ?? DIMENSION_WEIGHTS[callType]?.[key] ?? null;
    const points = storedPoints ?? V5_STATUS_POINTS[status] ?? BAND_POINTS[band] ?? null;
    return [{
      key,
      label: text(object.label) || DIMENSION_LABELS[key] || humanize(key || "dimension"),
      applicability: text(object.applicability) || "applicable",
      band,
      reason: text(object.reason || object.rationale || object.explanation),
      weight,
      points,
      contribution: weight !== null && points !== null ? round(weight * points) : null,
      evidence: array(object.evidence).flatMap(normalizeEvidence),
    }];
  });
}

export function normalizeBehaviours(values: unknown[]): BehaviourCheck[] {
  return values.flatMap((value) => {
    const object = asObject(value);
    if (!object) return [];
    const name = text(object.name || object.behaviour || object.behavior || object.label);
    return [{
      name,
      label: humanize(name || "behavior check"),
      status: text(object.status) || "not_observed",
      timestamp: text(object.timestamp || object.time),
      speaker: text(object.speaker),
      quote: text(object.quote || object.evidence_quote || object.excerpt),
      validationNote: text(object.validation_note),
    }];
  });
}

export function getCallInsights(callType: string, dimensions: unknown[]) {
  const normalized = normalizeDimensions(callType, dimensions)
    .filter((dimension) => isApplicableDimension(dimension.applicability) && dimension.points !== null);
  const sorted = [...normalized].sort((a, b) => (a.points ?? 101) - (b.points ?? 101));
  return {
    coachingPriority: sorted[0]?.label || "Not enough evidence",
    strongestArea: sorted.at(-1)?.label || "Not enough evidence",
  };
}

export function isApplicableDimension(value: string) {
  return !["not_applicable", "not_observable", "unobservable"].includes(value.toLowerCase());
}

export function evidenceConfidence(nScored: number) {
  if (nScored >= 15) return "Strong evidence";
  if (nScored >= 8) return "Moderate evidence";
  if (nScored >= 3) return "Early evidence";
  return nScored === 1 ? "1 call only" : `${nScored} calls only`;
}

export function isEnoughEvidence(nScored: number) {
  return nScored >= 3;
}

export function getManagerCallContextEntries(context: Record<string, unknown>) {
  return Object.entries(context).filter(([key, value]) => {
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, "");
    return !INTERNAL_CALL_CONTEXT_KEYS.has(normalizedKey)
      && value !== null
      && value !== undefined
      && String(value).trim().length > 0;
  });
}

export function humanize(value: string) {
  const spaced = value.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : "Not available";
}

function normalizeEvidence(value: unknown): EvidenceQuote[] {
  const object = asObject(value);
  if (!object) return [];
  const quote = text(object.quote || object.evidence_quote || object.excerpt);
  if (!quote) return [];
  return [{
    timestamp: text(object.timestamp || object.time),
    speaker: text(object.speaker),
    quote,
  }];
}

function asObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function number(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}
