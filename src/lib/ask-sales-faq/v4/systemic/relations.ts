import type { V4SystemicNeed, V4SystemicPolicy } from "@/lib/ask-sales-faq/v4/systemic/types";

export type V4SystemicRelation =
  | "permission"
  | "requirement"
  | "eligibility"
  | "definition"
  | "inclusion"
  | "price_amount"
  | "payment_option"
  | "discount"
  | "timing_start"
  | "duration"
  | "deadline"
  | "status"
  | "limit"
  | "procedure"
  | "routing"
  | "owner"
  | "location"
  | "artifact_identity"
  | "artifact_location"
  | "exception"
  | "consequence"
  | "comparison"
  | "other";

export type V4SystemicRequestKind = "knowledge" | "operational_action" | "current_lookup" | "artifact_request";

export type V4SystemicRelationCompatibility = "exact" | "compatible" | "unknown" | "incompatible";

const KNOWLEDGE_QUESTION = /\b(?:what\s+(?:is|are)\s+the\s+(?:rule|policy)|is\s+(?:it|this|that)\s+(?:allowed|permitted|required)|are\s+reps\s+allowed|can\s+(?:a|an|the|reps?|we|i)\b|should\s+(?:a|an|the|reps?|we|i)\b|must\s+(?:a|an|the|reps?|we|i)\b|do\s+(?:a|an|the|reps?|we|i)\s+have\s+to)\b/i;
const CURRENT_LOOKUP = /\b(?:current|currently|latest|today|right now|still|confirm|verify|check|trace|status|pending|cleared|received|went through)\b/i;
const OPERATIONAL_ACTION = /\b(?:send|submit|post|request|process|issue|confirm|verify|trace|locate|find|get|provide|share|refund|cancel|cancelled|canceled|pause|paused|stop|stopped|update|edit|merge|combine|replace|delete|remove|book|rebook|reschedule|schedule|upload|download|open|access|fix|repair|escalate)\b/i;
const ARTIFACT_ACQUISITION_ACTION = /\b(?:send|request|issue|locate|find|get|provide|share|upload|download|open|access)\b/i;
const ARTIFACT = /\b(?:link|url|form|sheet|spreadsheet|document|template|email|message|pdf|letter|recording|video|episode|file|contract|agreement|script|media\s*kit|asset)\b/i;
const REP_ACTION_PERMISSION = /\b(?:(?:can|could|may)\s+(?:i|we|reps?|representatives?|the\s+reps?|the\s+representatives?)|(?:am|are|is)\s+(?:i|we|reps?|representatives?|the\s+reps?|the\s+representatives?)\s+allowed\s+to|(?:do|does)\s+(?:i|we|reps?|representatives?|the\s+reps?|the\s+representatives?)\s+have\s+permission\s+to)\s+(?:send|share|provide|text|email|call|discuss|mention|cancel|pause|stop|block|unsubscribe|book|rebook|reschedule|schedule|contact|notify|route|post|submit|request|process|issue|confirm|verify|trace|refund|update|edit|merge|combine|replace|delete|remove|upload|download|open|access|fix|repair|escalate)\b/i;

const normalizedValueCache = new Map<string, string>();
const MAX_RELATION_CACHE_ENTRIES = 4096;

function rememberRelationValue<T>(cache: Map<string, T>, key: string, value: T) {
  if (!cache.has(key) && cache.size >= MAX_RELATION_CACHE_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey !== undefined) cache.delete(oldestKey);
  }
  cache.set(key, value);
  return value;
}

function normalize(value: string) {
  const cached = normalizedValueCache.get(value);
  if (cached !== undefined) return cached;
  const normalized = value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9$%]+/g, " ").replace(/\s+/g, " ").trim();
  return rememberRelationValue(normalizedValueCache, value, normalized);
}

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, ninety: 90,
};

type DurationMeasurement = {
  amount: number;
  unit: "minute" | "hour" | "day" | "week" | "month" | "year";
  role: "handoff_window" | "deadline_window" | "reapplication_wait" | "availability_duration" | "session_duration" | "time_window" | "generic_duration";
};

const durationMeasurementCache = new Map<string, DurationMeasurement[]>();
const DURATION_MEASUREMENT_PATTERN = new RegExp(
  "\\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|ninety|\\d+(?:\\.\\d+)?)\\s+(minutes?|hours?|days?|weeks?|months?|years?)\\b",
  "gi",
);

function durationMeasurements(value: string): DurationMeasurement[] {
  const cached = durationMeasurementCache.get(value);
  if (cached) return cached;
  const text = normalize(value);
  const matches = [...text.matchAll(DURATION_MEASUREMENT_PATTERN)];
  const measurements = matches.flatMap((match) => {
    const amount = NUMBER_WORDS[match[1].toLowerCase()] ?? Number.parseFloat(match[1]);
    if (!Number.isFinite(amount)) return [];
    const unit = match[2].toLowerCase().replace(/s$/, "") as DurationMeasurement["unit"];
    const index = match.index || 0;
    const context = text.slice(Math.max(0, index - 110), Math.min(text.length, index + match[0].length + 110));
    const role: DurationMeasurement["role"] = /\b(?:pass off|passoff|hand off|handoff|covering rep|original rep|reclaim|reassign|join the call)\b/i.test(context)
      ? "handoff_window"
      : /\b(?:reapply|reapplication|apply again|waiting period)\b/i.test(context)
        ? "reapplication_wait"
        : /\b(?:deadline|cutoff|cut off|due|no later than|by sunday|within)\b/i.test(context)
          ? "deadline_window"
          : /\b(?:hosted|remain|stay|release term)\b|\b(?:available|access)\s+for\b|\baccess\b.{0,30}\b(?:lasts?|duration)\b/i.test(context)
            ? "availability_duration"
            : /\b(?:zoom|meeting|appointment|session|interview|licensing)\b.{0,50}\bcall\b|\bcall\b.{0,50}\b(?:zoom|meeting|appointment|session|interview|licensing)\b/i.test(context)
              ? "session_duration"
              : /\b(?:window|grace|wait|early|late|start time)\b/i.test(context)
                ? "time_window"
                : "generic_duration";
    return [{ amount, unit, role }];
  });
  return rememberRelationValue(durationMeasurementCache, value, measurements);
}

const DECISION_OBJECT_FACETS: Array<{ name: string; pattern: RegExp }> = [
  { name: "handoff", pattern: /\b(?:pass off|passoff|hand off|handoff|covering rep|original rep|reclaim(?: a)? call)\b/i },
  { name: "licensing", pattern: /\b(?:licensing terms?|reuse licen[cs]e|commercial reuse)\b/i },
  { name: "pre_call", pattern: /\b(?:pre call|before (?:the )?call|self booked prospect|booking confirmation)\b/i },
  { name: "post_greenlight_noncommit", pattern: /\b(?:greenlit|green lighted|greenlighted)\b.{0,180}\b(?:did not|didn't|does not|doesn't|not)\b.{0,80}\b(?:commit|pay|sign|book)|\b(?:monday|sunday 11 59|cohort deadline)\b.{0,180}\b(?:rejection|noncommit|did not commit|didn't commit)\b/i },
  { name: "onboarding", pattern: /\bonboard\w*\b/i },
  { name: "recording", pattern: /\brecording\b/i },
  { name: "episode_media", pattern: /\b(?:episode|watchable video|network video|documentary|podcast)\b/i },
  { name: "crm_record", pattern: /\b(?:keap|hubspot|oncehub|crm record|calendar record)\b/i },
  { name: "stats_reporting", pattern: /\b(?:daily stats|eod stats|end of day stats|dial list|call stats)\b/i },
  { name: "reapplication", pattern: /\b(?:reapply|reapplication|apply again)\b/i },
  { name: "contract", pattern: /\b(?:contract|agreement)\b/i },
  { name: "payment", pattern: /\b(?:payment|ach|wire|invoice|refund|deposit|installment)\b/i },
  { name: "post_call_notes", pattern: /\b(?:post[- ]?call|after (?:the )?call)\b.{0,100}\b(?:note|record|document|keap|sheet|report)\b|\b(?:note|record|document|keap|sheet|report)\b.{0,100}\b(?:post[- ]?call|after (?:the )?call)\b/i },
  { name: "lead_ownership", pattern: /\b(?:already booked|booked (?:by|with) another rep|assigned rep|lead ownership|ownership credit|who gets credit|which rep owns)\b/i },
  { name: "outreach_sequence", pattern: /\b(?:outreach|follow[- ]?up|text|sms|email|call)\b.{0,100}\b(?:sequence|cadence|sop|steps?|order)\b|\b(?:sequence|cadence|sop|steps?|order)\b.{0,100}\b(?:outreach|follow[- ]?up|text|sms|email|call)\b/i },
  { name: "call_volume", pattern: /\b(?:more|generate|increase|build|create)\b.{0,80}\b(?:calls?|call volume|appointments?)\b|\b(?:calls?|call volume|appointments?)\b.{0,80}\b(?:more|generate|increase|build|create)\b/i },
  { name: "technical_report", pattern: /\b(?:totals?|numbers?|counts?|stats?|dashboard|report)\b.{0,100}\b(?:chang|wrong|incorrect|glitch|bug|fix|repair)\w*\b|\b(?:chang|wrong|incorrect|glitch|bug|fix|repair)\w*\b.{0,100}\b(?:totals?|numbers?|counts?|stats?|dashboard|report)\b/i },
  { name: "social_visibility", pattern: /\b(?:social (?:media|profile|visibility|presence)|online presence|private profile|followers?|instagram|tiktok|facebook|youtube)\b/i },
  { name: "negative_search_result", pattern: /\b(?:google|web|online)\s+search\b.{0,100}\b(?:negative|criminal|charge|bad result|adverse)\w*\b|\b(?:negative|criminal|charge|bad result|adverse)\w*\b.{0,100}\b(?:google|web|online)\s+search\b/i },
  { name: "political_candidate", pattern: /\b(?:political candidate|candidate for (?:public )?office|running for office|elected official|political topic)\b/i },
  { name: "extremist_content", pattern: /\b(?:extremis\w*|hate toward|hate speech|nazi|racis\w*|terroris\w*)\b/i },
  { name: "franchise_approval", pattern: /\bfranchise\w*\b.{0,100}\b(?:brand|franchisor|approval|approve)\w*\b|\b(?:brand|franchisor)\b.{0,100}\bfranchise\w*\b/i },
  { name: "union_approval", pattern: /\b(?:sag[- ]?aftra|union|guild)\b.{0,100}\b(?:approval|approve|permission)\w*\b|\b(?:approval|approve|permission)\w*\b.{0,100}\b(?:sag[- ]?aftra|union|guild)\b/i },
];

const decisionObjectFacetCache = new Map<string, Set<string>>();

function decisionObjectFacets(value: string) {
  const cached = decisionObjectFacetCache.get(value);
  if (cached) return cached;
  const text = normalize(value);
  const facets = new Set(DECISION_OBJECT_FACETS.filter(({ pattern }) => pattern.test(text)).map(({ name }) => name));
  return rememberRelationValue(decisionObjectFacetCache, value, facets);
}

type ArtifactKind =
  | "pre_call_message"
  | "post_greenlight_noncommit_message"
  | "greenlight_letter"
  | "rejection_message"
  | "onboarding_message"
  | "booking_confirmation"
  | "contract"
  | "payment_link"
  | "recording"
  | "episode_media"
  | "upgrade_form"
  | "stats_sheet"
  | "generic_script_or_template";

const artifactKindCache = new Map<string, Set<ArtifactKind>>();

function artifactKinds(value: string) {
  const cached = artifactKindCache.get(value);
  if (cached) return cached;
  const text = normalize(value);
  const kinds = new Set<ArtifactKind>();
  const hasMessageArtifact = /\b(?:letter|email|message|template|link|url|pdf)\b/i.test(text);
  if (hasMessageArtifact && /\b(?:greenlit|green lighted|greenlighted)\b/i.test(text) && /\b(?:did not|didn t|does not|doesn t|not)\b.{0,80}\b(?:commit|pay|sign|book)|\b(?:monday|sunday 11 59|cohort deadline)\b/i.test(text)) {
    kinds.add("post_greenlight_noncommit_message");
  }
  if (hasMessageArtifact && /\b(?:pre call|before (?:the )?call|self booked prospect)\b/i.test(text)) kinds.add("pre_call_message");
  if (hasMessageArtifact && /\bgreen\s*light\s+letter\b|\bgreenlight\s+letter\b/i.test(text)) kinds.add("greenlight_letter");
  if (hasMessageArtifact && /\b(?:rejection|rejected|decline|denial)\b/i.test(text)) kinds.add("rejection_message");
  if (hasMessageArtifact && /\bonboard\w*\b/i.test(text)) kinds.add("onboarding_message");
  if (hasMessageArtifact && /\b(?:booking|appointment)\b.{0,80}\b(?:confirm|confirmation)\b|\bconfirmation\b.{0,80}\b(?:booking|appointment)\b/i.test(text)) kinds.add("booking_confirmation");
  if (/\b(?:contract|agreement)\b/i.test(text)) kinds.add("contract");
  if (/\b(?:payment|checkout)\s+(?:link|url|page)\b/i.test(text)) kinds.add("payment_link");
  if (/\brecording\b/i.test(text)) kinds.add("recording");
  if (/\b(?:episode|watchable video|network video|documentary|podcast)\b/i.test(text)) kinds.add("episode_media");
  if (/\bupgrade\b.{0,80}\b(?:form|sheet|spreadsheet)\b|\b(?:form|sheet|spreadsheet)\b.{0,80}\bupgrade\b/i.test(text)) kinds.add("upgrade_form");
  if (/\b(?:daily stats|eod stats|end of day stats)\b.{0,80}\b(?:sheet|spreadsheet|form|link)\b/i.test(text)) kinds.add("stats_sheet");
  if (!kinds.size && /\b(?:script|template)\b/i.test(text)) kinds.add("generic_script_or_template");
  return rememberRelationValue(artifactKindCache, value, kinds);
}

function durationRoleCompatible(left: DurationMeasurement["role"], right: DurationMeasurement["role"]) {
  return left === right || left === "generic_duration" || right === "generic_duration" ||
    (left === "time_window" && ["handoff_window", "deadline_window", "reapplication_wait"].includes(right)) ||
    (right === "time_window" && ["handoff_window", "deadline_window", "reapplication_wait"].includes(left));
}

export function v4SystemicDecisionObjectErrors(request: string, evidence: string) {
  const errors: string[] = [];
  const asksForContractClauseMeaning = /\bwhat\s+does\s+(?:the\s+)?(?:contract|agreement)\s+mean\b|\b(?:contract|agreement)\b.{0,80}\b(?:mean|meaning|define|definition)\b/i.test(request);
  const requestedMeasurements = durationMeasurements(request);
  const evidenceMeasurements = durationMeasurements(evidence);
  for (const requested of requestedMeasurements) {
    if (!evidenceMeasurements.length) continue;
    const covered = evidenceMeasurements.some((candidate) =>
      candidate.amount === requested.amount && candidate.unit === requested.unit && durationRoleCompatible(requested.role, candidate.role),
    );
    if (!covered) {
      errors.push(`the requested ${requested.amount}-${requested.unit} ${requested.role.replace(/_/g, " ")} is not established by the evidence`);
    }
  }

  const requestedArtifacts = artifactKinds(request);
  const evidenceArtifacts = artifactKinds(evidence);
  if (!asksForContractClauseMeaning && ARTIFACT.test(request) && requestedArtifacts.size && evidenceArtifacts.size &&
      ![...requestedArtifacts].some((kind) => evidenceArtifacts.has(kind))) {
    errors.push("the evidence refers to a different artifact kind or lifecycle stage than the requested artifact");
  }

  const requestedFacets = decisionObjectFacets(request);
  const evidenceFacets = decisionObjectFacets(evidence);
  const exclusiveFacets = new Set(["handoff", "licensing", "pre_call", "post_greenlight_noncommit", "onboarding", "recording", "episode_media", "crm_record", "stats_reporting", "reapplication", "contract", "post_call_notes", "lead_ownership", "outreach_sequence", "call_volume", "technical_report", "social_visibility", "negative_search_result", "political_candidate", "extremist_content", "franchise_approval", "union_approval"]);
  const requestedExclusive = [...requestedFacets].filter((facet) => exclusiveFacets.has(facet));
  const evidenceExclusive = [...evidenceFacets].filter((facet) => exclusiveFacets.has(facet));
  const genericStorageFacets = new Set(["crm_record"]);
  const relevantRequestedExclusive = requestedExclusive.filter((facet) =>
    !(asksForContractClauseMeaning && facet === "contract"),
  );
  const requestedSpecific = relevantRequestedExclusive.filter((facet) => !genericStorageFacets.has(facet));
  const evidenceSpecific = evidenceExclusive.filter((facet) => !genericStorageFacets.has(facet));
  const incompatibleSpecificObjects = requestedSpecific.length && evidenceSpecific.length &&
    !requestedSpecific.some((facet) => evidenceSpecific.includes(facet));
  if (incompatibleSpecificObjects || (
    relevantRequestedExclusive.length && evidenceExclusive.length &&
    !relevantRequestedExclusive.some((facet) => evidenceExclusive.includes(facet))
  )) {
    errors.push("the evidence governs a different decision object than the request");
  }
  return [...new Set(errors)];
}

export function v4SystemicDecisionObjectScore(request: string, evidence: string) {
  if (v4SystemicDecisionObjectErrors(request, evidence).length) return -36;
  const requestedFacets = decisionObjectFacets(request);
  const evidenceFacets = decisionObjectFacets(evidence);
  const facetMatches = [...requestedFacets].filter((facet) => evidenceFacets.has(facet)).length;
  const requestedArtifacts = artifactKinds(request);
  const evidenceArtifacts = artifactKinds(evidence);
  const artifactMatch = [...requestedArtifacts].some((kind) => evidenceArtifacts.has(kind));
  const requestedMeasurements = durationMeasurements(request);
  const evidenceMeasurements = durationMeasurements(evidence);
  const measurementMatch = requestedMeasurements.some((requested) => evidenceMeasurements.some((candidate) =>
    candidate.amount === requested.amount && candidate.unit === requested.unit && durationRoleCompatible(requested.role, candidate.role),
  ));
  return Math.min(8, facetMatches * 3) + (artifactMatch ? 7 : 0) + (measurementMatch ? 6 : 0);
}

export function v4SystemicArtifactIdentityProcedureCompatible(request: string, evidence: string) {
  const requested = artifactKinds(request);
  const supplied = artifactKinds(evidence);
  if (!requested.size || ![...requested].some((kind) => supplied.has(kind))) return false;
  return /\b(?:use|called|named|same|approved|correct|right|replace|swap|select|choose)\b/i.test(evidence);
}

export function v4SystemicRelation(value: unknown, fallback: V4SystemicRelation = "other"): V4SystemicRelation {
  const relation = String(value || "");
  return [
    "permission", "requirement", "eligibility", "definition", "inclusion", "price_amount", "payment_option", "discount",
    "timing_start", "duration", "deadline", "status", "limit", "procedure", "routing", "owner", "location",
    "artifact_identity", "artifact_location", "exception", "consequence", "comparison", "other",
  ].includes(relation) ? relation as V4SystemicRelation : fallback;
}

export function v4SystemicRequestKind(value: unknown, fallback: V4SystemicRequestKind = "knowledge"): V4SystemicRequestKind {
  const kind = String(value || "");
  return ["knowledge", "operational_action", "current_lookup", "artifact_request"].includes(kind)
    ? kind as V4SystemicRequestKind
    : fallback;
}

export function inferV4SystemicRequestKind(value: string): V4SystemicRequestKind {
  const text = normalize(value);
  const explicitKnowledgeDecision = REP_ACTION_PERMISSION.test(text) ||
    /\b(?:what\s+(?:is|are)\s+the\s+(?:rule|policy)|is\s+(?:it|this|that)\s+(?:allowed|permitted|required)|are\s+reps\s+allowed|must\s+(?:i|we|reps?)\b|do\s+(?:i|we|reps?)\s+need\s+to)\b/i.test(text);
  if (explicitKnowledgeDecision) return "knowledge";
  const asksForProcedure = /^(?:what\s+(?:is|are)\s+(?:the\s+)?(?:correct\s+)?(?:process|procedure|steps?|workflow)|how\s+(?:do|does|should|can|to)\b)/i.test(text);
  const asksForArtifact = ARTIFACT.test(text) && (
    ARTIFACT_ACQUISITION_ACTION.test(text) ||
    /^(?:(?:i|we)\s+)?(?:need|want|am looking for|are looking for)\b/i.test(text)
  );
  if (asksForArtifact) return "artifact_request";
  // "How do I verify/check/sign ...?" asks for a reusable procedure. It does
  // not ask the bot to assert that a particular live record is in that state.
  if (asksForProcedure && !/\b(?:where|which channel)\b/i.test(text)) return "knowledge";
  // A policy question can contain an asserted live-state word without asking
  // the bot to inspect a live record. For example, "the contract is signed;
  // do I need to wait for ACH to clear before onboarding?" asks for the rule,
  // not the status of that payment. Resolve explicit deontic wording before
  // the broad current-lookup vocabulary below.
  const asksForRequirement = /\b(?:do|does)\s+(?:i|we|a|an|the|reps?|representatives?)\s+need\s+to\b|\b(?:must|should)\s+(?:i|we|a|an|the|reps?|representatives?)\b|\b(?:am|are|is)\s+(?:i|we|a|an|the|reps?|representatives?)\s+required\s+to\b|\bshould\b/i.test(text);
  if (asksForRequirement && !/\b(?:which channel|where (?:do|should|can) (?:i|we) (?:post|send|submit|request))\b/i.test(text)) {
    return "knowledge";
  }
  const currentOperation = CURRENT_LOOKUP.test(text) &&
    /\b(?:ach|wire|payment|transaction|invoice|refund|charge|letter|greenlight|recording|booking|appointment|record|contract|status)\b/i.test(text);
  if (currentOperation) return "current_lookup";
  const explicitOperationalRequest = /^(?:please\s+)?(?:send|submit|post|request|process|issue|confirm|verify|trace|refund|cancel|pause|update|edit|merge|combine|replace|delete|remove|book|rebook|reschedule|schedule|upload|download|open|access|fix|repair|escalate)\b|^(?:how|where)\s+(?:do|can|should)\s+(?:i|we)\s+(?:send|submit|post|request|process|issue|confirm|verify|trace|refund|cancel|update|edit|book|rebook|reschedule|schedule|upload|download|access|fix|escalate)\b/i.test(text);
  if (explicitOperationalRequest) return "operational_action";
  if (inferV4SystemicRelation(text) === "routing") return "operational_action";
  if (KNOWLEDGE_QUESTION.test(text) && !/\b(?:which channel|where (?:do|should|can) (?:i|we) (?:post|send|submit|request)|who (?:can|should) (?:send|process|confirm|fix))\b/i.test(text)) {
    return "knowledge";
  }
  if (/^(?:determine|explain|state|tell me)\s+(?:if|whether)\b/i.test(text)) return "knowledge";
  if (/^(?:what|when|why|how (?:early|late|long|much|many|soon)|can|could|should|would|will|do|does|did|is|are|must|may|who|which|whether)\b/i.test(text)) return "knowledge";
  return OPERATIONAL_ACTION.test(text) ? "operational_action" : "knowledge";
}

export function inferV4SystemicRelation(value: string): V4SystemicRelation {
  const text = normalize(value);
  if (!text) return "other";
  // A proposed amount/date combination is a payment-policy decision even when
  // the user phrases the output as "which contract". The contract is
  // downstream of whether the split is an approved option.
  if (/\b(?:payment plan|installment|instalment|split payment|payment option|payment schedule|custom plan|custom split|first payment|remaining balance|pay (?:the )?remaining|one amount now)\b/i.test(text)) return "payment_option";
  if (/\b(?:placement|hosting|episode)\s+guarantee\b.{0,100}\b(?:year|month|week|day)s?\b|\b(?:year|month|week|day)s?\b.{0,100}\b(?:placement|hosting|episode)\s+guarantee\b/i.test(text)) return "duration";
  if (/\b(?:what|which)\s+(?:approved\s+)?(?:option|method|tool|script|process)\b.{0,120}\b(?:use|follow|choose|select)\b/i.test(text)) return "procedure";
  // Preserve procedural intent when a sentence contains an incidental status
  // fact such as "the lead is available next week".
  if (/^(?:what\s+(?:is|are)\b.{0,100}\b(?:process|procedure|steps?|workflow|sequence|cadence|sop)|how\s+(?:do|does|should|can|to)\b|what\s+(?:do|should)\s+(?:i|we|reps?)\s+do\b)/i.test(text)) return "procedure";
  if (/^(?:(?:i|we)\s+)?(?:need|want|am looking for|are looking for)\b.{0,100}\b(?:form|link|url|document|template|pdf|letter|recording|video|episode|file|contract|agreement|script|asset)\b/i.test(text)) return "artifact_identity";
  if (/^(?:please\s+)?(?:send|provide|share|give|get|request|download)\b.{0,100}\b(?:form|link|url|document|template|pdf|letter|recording|video|episode|file|contract|agreement|script|asset)\b/i.test(text)) return "artifact_identity";
  if (/\b(?:which|what)\s+(?:exact\s+)?(?:form|link|url|document|template|pdf|letter|recording|video|episode|file|contract|agreement|script|asset)\b|\bidentify\s+(?:the\s+)?(?:right|correct|current|exact)\b/i.test(text)) return "artifact_identity";
  // Asking whether a live/current episode exists to send is an exact media
  // lookup. It is not an ownership question merely because the requested
  // episode features somebody who "owns" a business or nonprofit.
  if (/\b(?:do|does)\s+(?:we|i)\s+have\b.{0,180}\b(?:live|current|available|watchable|sendable)?\s*(?:episode|video|recording)\b/i.test(text) ||
      /\b(?:live|current|available|watchable|sendable)\s+(?:episode|video|recording)\b.{0,180}\b(?:send|share|show)\b/i.test(text)) return "artifact_identity";
  // Having permission or entitlement to access an artifact is not the same
  // relationship as asking where that artifact lives. Keeping these separate
  // prevents access-boundary warnings from being promoted as location answers.
  if (/\b(?:has|have|had|having|given|granted|denied)\s+access\s+to\b|\baccess\s+(?:is|isn't|is not|was|wasn't|was not)\s+(?:allowed|available|granted|permitted|restricted|denied)\b/i.test(text)) return "permission";
  if (/\b(?:where|locate|find|access|download|get)\b.{0,80}\b(?:form|link|url|document|template|pdf|letter|recording|video|episode|file|contract|agreement|script|asset)\b/i.test(text)) return "artifact_location";
  if (/\b(?:which|what)\s+channel\b|\bwhere\s+(?:do|should|can)\s+(?:i|we|reps?)\s+(?:post|send|submit|request|escalate)\b|\bwhere\s+(?:does|do)\s+(?:a|the|this|that|these|those)?\s*(?:request|requests?)\b.{0,100}\bgo\b|\broute\b/i.test(text)) return "routing";
  // "Are recurring invoices automated or sent by reps?" is an ownership
  // decision about who performs the action, not a lookup of a particular
  // invoice's live status.
  if (/\binvoices?\b.{0,140}\b(?:automated|automatic|manually|manual|sent by|issued by)\b|\b(?:automated|automatic|manually|manual)\b.{0,140}\binvoices?\b/i.test(text)) return "owner";
  if (/\bwho\s+(?:exactly\s+)?(?:must|should|can|will)\s+(?:verify|review|check|confirm|approve|handle|own|send|issue|provide)\b/i.test(text)) return "owner";
  if (/\bwho\s+(?:is|are)\s+(?:the\s+)?(?:current\s+)?(?:manager|owner|person|team)\b.{0,140}\b(?:notify|contact|tell|inform)\b/i.test(text)) return "owner";
  // Do not let an incidental state word (signed, received, pending, cleared)
  // erase a policy requirement such as whether the rep must wait or proceed.
  // Price, timing, inclusion, and eligibility checks below still retain their
  // more specific relation before the general requirement fallback.
  const containsDeonticDecision = /\b(?:required|requirement|must\b|need to|have to|mandatory|obligated|should\b)\b/i.test(text);
  if (/\b(?:current(?:ly)?\b.{0,60}\bstatus|still (?:active|available|casting|offered)|status of|is .* (?:active|available|casting|offered)|cleared|received|went through|pending)\b/i.test(text) && !containsDeonticDecision) return "status";
  // "Should X be explained during Call 2 or onboarding?" asks which workflow
  // stage/process the rep should follow. It is not asking when an event starts.
  if (
    /\bshould\b.{0,140}\b(?:be\s+)?(?:explain(?:ed)?|discuss(?:ed)?|share(?:d)?|provide(?:d)?|tell)\b.{0,140}\b(?:during|at|in|after|before)\b/i.test(text) ||
    /\b(?:details?|information)\b.{0,100}\b(?:provided|explained|discussed|shared)\b.{0,100}\b(?:during|at|in|after|before)\b/i.test(text)
  ) return "procedure";
  if (/\b(?:when\s+(?:is|are|was|were|does|do|will|should|can)|what\s+is\s+(?:the\s+)?(?:confirmed\s+|current\s+|next\s+)?date|confirmed\s+date|event\s+date|how soon|begin|start|first appear|go live|release|publish|air)\b/i.test(text) &&
    !/\bhow long\b/i.test(text) &&
    !/\b(?:start|begin)\s+(?:with|by)\b/i.test(text)) return "timing_start";
  if (/\b(?:how long|how much time|how many (?:days?|weeks?|months?|years?|hours?|minutes?)|for how long|duration|lasts?|remain|stay|hosted for|available for)\b/i.test(text)) return "duration";
  if (/\b(?:deadline|cutoff|cut off|no later than|by when|latest (?:time|date)|due date|must .* by)\b/i.test(text)) return "deadline";
  if (/\b(?:earliest (?:time|date)|how early|first time)\b/i.test(text)) return "timing_start";
  if (/\b(?:how many|maximum|max\b|minimum|min\b|cap\b|limit\b|quota\b|per (?:day|week|month))\b/i.test(text)) return "limit";
  if (/\b(?:how much|what (?:does|will|would) .* cost|what (?:is|are) (?:the )?(?:price|pricing|fee|amount|total)|price amount|total (?:price|cost)|fee amount|cost of)\b/i.test(text)) return "price_amount";
  if (/\b(?:discount|promotion|promo|money off|percentage off|half off)\b/i.test(text)) return "discount";
  if (/\b(?:what happens|what will happen|result|consequence|then what|after .* (?:miss|fail|decline|reject|no[- ]?show))\b/i.test(text)) return "consequence";
  if (/\b(?:exception|except|special case|override|waive|waiver|circumstance)\b/i.test(text)) return "exception";
  // An explicit request for permission to take an operational action is about
  // the rep's authority, even when the object of that action happens to be an
  // applicant described with eligibility vocabulary. For example, "Can I
  // cancel an audition for someone I disqualified?" is not asking whether the
  // applicant qualifies.
  if (REP_ACTION_PERMISSION.test(text)) return "permission";
  // An explicit must/need/have-to question asks for a requirement even when
  // the subject happens to be a greenlight or qualification workflow.
  const eligibilityDecision = /\b(?:qualif(?:y|ies|ied|ication)|eligible|eligibility|fit for|good fit|not a fit|approve|approved|greenlight|dq|disqualif(?:y|ies|ied|ication))\b/i.test(text);
  // In an explicit either/or eligibility choice, incidental "must" wording
  // describes one proposed qualification path. The requested output is still
  // which applicant type qualifies, not an unrelated procedural requirement.
  if (eligibilityDecision && /\bor\b/i.test(text)) return "eligibility";
  if (/\b(?:does|do)\b.{0,100}\b(?:franchise|franchisor|brand)\b.{0,100}\bneed\s+(?:brand\s+)?approval\b|\b(?:franchise|franchisor|brand)\b.{0,100}\bneed\s+(?:brand\s+)?approval\b/i.test(text)) return "requirement";
  if (/\b(?:required|requirement|must\b|need to|have to|mandatory|obligated)\b/i.test(text)) return "requirement";
  if (/\bshould\b/i.test(text) && !eligibilityDecision) return "requirement";
  if (/\b(?:included|include|comes with|receive|entitled|benefit|access to)\b/i.test(text)) return "inclusion";
  if (eligibilityDecision) return "eligibility";
  if (/\b(?:do|does)\s+(?:i|we|reps?|representatives?|the rep|the representative)\s+(?:send|issue|provide|book|schedule|invoice|contact|notify)\b/i.test(text)) return "owner";
  if (/\bshould\s+(?:i|we|you|they|he|she|it|the|a|an|reps?|clients?|prospects?|applicants?)\b/i.test(text)) return "requirement";
  if (/\b(?:allowed|allow|permitted|permission|may\b|can\b|prohibited|forbidden|not allowed)\b/i.test(text)) return "permission";
  if (/\b(?:who (?:owns|handles|approves|confirms|verifies|reviews|checks|sends|issues|provides|books|schedules|invoices|contacts|notifies|is responsible)|who should (?:own|handle|approve|confirm|verify|review|check|send|issue|provide|book|schedule|invoice|contact|notify)|owner of|owned by|ownership|responsible for|point of contact|(?:rep|team|department) owns?)\b/i.test(text)) return "owner";
  if (/\b(?:where (?:is|are)|location|address|stored|storage)\b/i.test(text)) return "location";
  if (/\b(?:difference|compare|versus|vs\b|which is better)\b/i.test(text)) return "comparison";
  if (/\b(?:how (?:do|does|should|can|to)|process|procedure|steps?|workflow|handle|what (?:do|should) (?:i|we|reps?) do)\b/i.test(text)) return "procedure";
  if (/\b(?:what is|what are|define|means?|meaning)\b/i.test(text)) return "definition";
  return "other";
}

export function inferV4SystemicPolicyRelations(policy: Pick<V4SystemicPolicy, "title" | "question_families" | "decision" | "actions">) {
  // Question wording alone can hide the relation supplied by the answer. For
  // example, "Can Call 2 happen Monday?" is answered with "Call 2 must happen
  // before Sunday". Always inspect the decision as well as the question.
  const relationSources = [...policy.question_families, policy.title, policy.decision, ...policy.actions];
  const relations: V4SystemicRelation[] = relationSources
    .map(inferV4SystemicRelation)
    .filter((relation) => relation !== "other");
  // Imperative policy prose encodes a procedure/requirement even when it omits
  // modal words. This is source typing, not an inference about the user's case.
  if (
    /(?:^|[.!?]\s+|:\s*)(?:yes[,;:]?\s+)?(?:do not|don't|never|always|present|use|route|send|contact|ask|confirm|verify|schedule|book|keep|tell|treat|evaluate|follow|complete|check)\b/i.test(policy.decision) ||
    /\b(?:the\s+)?(?:rep|reps|you|they)\s+(?:should|must)\s+(?:use|route|send|contact|ask|confirm|verify|schedule|book|keep|tell|follow|complete|check)\b/i.test(policy.decision)
  ) {
    relations.push("procedure", "requirement");
  }
  const relationCorpusText = relationSources.join(" ");
  if (
    /\b(?:current|approved)\s+(?:show|program)\s+(?:list|catalog)\b/i.test(relationCorpusText) ||
    /\bcurrent\b.{0,100}\b(?:sales|casting)(?:\s+and\s+(?:casting|sales))?\s+availability\b/i.test(relationCorpusText)
  ) {
    relations.push("status");
  }
  if (
    /\b(?:client\s+)?invoices?\b.{0,120}\b(?:automated|sent|issued|provided)\b/i.test(relationCorpusText) ||
    /\b(?:reps?|representatives?|sales|finance|team)\b.{0,80}\b(?:send|issue|provide|book|schedule|invoice|contact|notify)\b/i.test(relationCorpusText)
  ) {
    relations.push("owner");
  }
  return [...new Set(relations.length ? relations : ["other" as const])];
}

const COMPATIBLE_RELATIONS: Array<Set<V4SystemicRelation>> = [
  new Set(["permission", "exception"]),
  new Set(["requirement", "procedure"]),
  new Set(["owner", "routing"]),
  new Set(["location", "artifact_location"]),
];

const STRICT_RELATION_FAMILIES: Array<Set<V4SystemicRelation>> = [
  new Set(["timing_start", "duration", "deadline", "status"]),
  new Set(["price_amount", "payment_option", "discount"]),
  new Set(["artifact_identity", "artifact_location", "location", "status"]),
  new Set(["eligibility", "permission", "requirement", "procedure", "consequence"]),
  new Set(["limit", "duration", "deadline"]),
];

export function v4SystemicRelationCompatibility(need: V4SystemicRelation, policyRelations: V4SystemicRelation[]): V4SystemicRelationCompatibility {
  if (policyRelations.includes(need)) return "exact";
  if (need === "other" || policyRelations.includes("other")) return "unknown";
  if (COMPATIBLE_RELATIONS.some((group) => group.has(need) && policyRelations.some((relation) => group.has(relation)))) return "compatible";
  if (STRICT_RELATION_FAMILIES.some((group) => group.has(need) && policyRelations.some((relation) => group.has(relation)))) return "incompatible";
  return "unknown";
}

const normalizedPolicyTextCache = new WeakMap<object, string>();

function rawPolicyText(policy: Pick<V4SystemicPolicy, "title" | "question_families" | "decision" | "actions" | "entities">) {
  return [policy.title, ...policy.question_families, policy.decision, ...policy.actions, ...policy.entities].join(" ");
}

function policyText(policy: Pick<V4SystemicPolicy, "title" | "question_families" | "decision" | "actions" | "entities">) {
  const cached = normalizedPolicyTextCache.get(policy);
  if (cached) return cached;
  const normalized = normalize(rawPolicyText(policy));
  normalizedPolicyTextCache.set(policy, normalized);
  return normalized;
}

type MoneyFact = { currency: string | null; amount: number };

function moneyFacts(value: string): MoneyFact[] {
  const matches = [...value.matchAll(/(?:([$£€])\s*(\d[\d,]*(?:\.\d+)?)\s*([kK])?|\b(\d+(?:\.\d+)?)\s*([kK])\b)/g)];
  const facts = matches.flatMap((match) => {
    const numeric = match[2] || match[4];
    const parsed = Number.parseFloat(numeric.replace(/,/g, ""));
    if (!Number.isFinite(parsed)) return [];
    const amount = Math.round(parsed * (match[3] || match[5] ? 1000 : 1) * 100) / 100;
    return [{ currency: match[1] || null, amount }];
  });
  return facts.filter((fact, index) => facts.findIndex((candidate) =>
    candidate.amount === fact.amount && candidate.currency === fact.currency,
  ) === index);
}

function moneyFactCovered(requested: MoneyFact, evidence: MoneyFact[]) {
  return evidence.some((candidate) => candidate.amount === requested.amount && (
    !requested.currency || !candidate.currency || requested.currency === candidate.currency
  ));
}

function hasCanceledCall2ForInvestmentInability(value: string) {
  const canceledCall2 = /\bcancel(?:ed|led|ing)?\b.{0,160}\bcall\s*2\b|\bcall\s*2\b.{0,160}\bcancel(?:ed|led|ing)?\b/i.test(value);
  const inability = /\b(?:cannot|can't|could not|couldn't|unable to|not able to|did not have|didn't have|does not have|doesn't have|insufficient|not enough|no)\b.{0,50}\b(?:afford|invest|investment|funds?|money)\b|\b(?:afford|invest|investment|funds?|money)\b.{0,50}\b(?:unavailable|insufficient|not available)\b/i.test(value);
  const contrary = /\b(?:can|could|was able to|is able to)\s+(?:afford|invest|make (?:the )?investment)\b/i.test(value);
  return canceledCall2 && inability && !contrary;
}

function hasEarlyStageNoLaunchCondition(value: string) {
  return /\b(?:early stage|very early stages|startup)\b/i.test(value) &&
    /\b(?:not|never|hasn't|haven't|has not|have not)\b.{0,50}\b(?:launch|launched|online|website|social)|\bno\s+(?:online presence|launched company|website|social media)\b/i.test(value);
}

function hasRepeatedDisqualificationCondition(value: string) {
  return /\b(?:disqualif\w*|not a good candidate)\b/i.test(value) &&
    /\b(?:keeps? (?:applying|booking)|repeat(?:ed|edly)? (?:application|booking|return)|applied multiple times|again and again)\b/i.test(value);
}

const CONDITIONAL_REAPPLICATION = /\b(?:reapply|reapplication|apply again|waiting period|wait\s+(?:at least\s+)?(?:three|3|six|6)\s+months?)\b/i;
const MATERIAL_REAPPLICATION_CONDITIONS: Array<{ label: string; matches: (value: string) => boolean }> = [
  { label: "canceled Call 2 because of inability to invest", matches: hasCanceledCall2ForInvestmentInability },
  { label: "a no-show", matches: (value) => /\bno[- ]?show(?:ed|s|ing)?\b/i.test(value) },
  {
    label: "a missed payment or signature deadline",
    matches: (value) => /\b(?:miss(?:ed|es|ing)?|fail(?:ed|s|ing)?|does not|doesn't|did not|didn't)\b.{0,100}\b(?:pay|payment|sign|signature|deadline|sunday)\b|\b(?:pay|payment|sign|signature|deadline|sunday)\b.{0,100}\b(?:miss(?:ed|es|ing)?|fail(?:ed|s|ing)?|does not|doesn't|did not|didn't)\b/i.test(value),
  },
  { label: "a rejection or not-fit decision", matches: (value) => /\b(?:reject(?:ed|ion)?|not[- ]?(?:a\s+)?fit|disqualif\w*)\b/i.test(value) },
  { label: "an early-stage no-launch case", matches: hasEarlyStageNoLaunchCondition },
  { label: "repeated disqualification and reapplication", matches: hasRepeatedDisqualificationCondition },
];

export function v4SystemicMaterialQualifierErrors(need: Pick<V4SystemicNeed, "text" | "authorityText" | "originalRequestText" | "retrievalQueries" | "actions" | "entities" | "relation">, policy: V4SystemicPolicy) {
  const rawNeedText = [need.text, ...need.retrievalQueries, ...need.actions, ...need.entities].join(" ");
  // Material prerequisites must come from the user's guarded atomic need, not
  // from model-generated retrieval expansions, actions, or entities. Those
  // expansions may improve recall but cannot make an unstated condition true.
  const authoritativeNeedText = need.originalRequestText || need.authorityText || need.text;
  const rawEvidence = rawPolicyText(policy);
  const needText = normalize(rawNeedText);
  const evidence = policyText(policy);
  const errors: string[] = [];

  const decisionRelation = inferV4SystemicRelation(policy.decision);
  if (need.relation === "artifact_location" && decisionRelation === "permission") {
    errors.push("an artifact-access permission boundary does not establish the requested artifact location");
  }

  const modalityGroups = [
    ["phone", /\b(?:phone|zoom phone|telephone)\b/i],
    ["zoom", /\bzoom\b/i],
    ["sms", /\b(?:sms|text message|texting)\b/i],
    ["email", /\b(?:email|e mail)\b/i],
  ] as const;
  const requestedModalities = modalityGroups.filter(([, pattern]) => pattern.test(needText));
  if (requestedModalities.length === 1 && !requestedModalities[0][1].test(evidence) && modalityGroups.some(([, pattern]) => pattern.test(evidence))) {
    errors.push(`requested ${requestedModalities[0][0]} modality is not established by the evidence`);
  }

  const stageGroups = [
    ["Call 1", /\bcall\s*(?:1|one)\b/i],
    ["Call 2", /\bcall\s*(?:2|two)\b/i],
    ["onboarding", /\bonboard\w*\b/i],
    ["after filming", /\b(?:after|post)\s+film\w*\b/i],
    ["before filming", /\b(?:before|pre)\s+film\w*\b/i],
  ] as const;
  const requestedStages = stageGroups.filter(([, pattern]) => pattern.test(needText));
  const evidenceStages = stageGroups.filter(([, pattern]) => pattern.test(evidence));
  const stageAlternativeResolved = requestedStages.length >= 2 && /\bor\b/i.test(needText) &&
    requestedStages.some(([label]) => evidenceStages.some(([evidenceLabel]) => evidenceLabel === label));
  if (!stageAlternativeResolved) {
    for (const [label, pattern] of stageGroups) {
      if (pattern.test(needText) && !pattern.test(evidence) && evidenceStages.length) {
        errors.push(`requested ${label} workflow stage is not established by the evidence`);
        break;
      }
    }
  }

  if (/\block[ -]?in\b/i.test(needText) && !/\block[ -]?in\b/i.test(evidence)) {
    errors.push("a lock-in payment is not established as the license or payment state covered by the evidence");
  }
  if (/\bday of\b/i.test(needText) && !/\b(?:day of|same day|appointment day)\b/i.test(evidence)) {
    errors.push("the requested day-of timing is not established by the evidence");
  }
  const zoomDifficulty = /\b(?:difficult\w*|struggl\w*|trouble|hard time|first time|unfamiliar\w*|maneuver\w*)\b.{0,80}\bzoom\b|\bzoom\b.{0,80}\b(?:difficult\w*|struggl\w*|trouble|hard time|first time|unfamiliar\w*|maneuver\w*)\b/i.test(needText);
  if (zoomDifficulty && !/\b(?:difficult\w*|struggl\w*|trouble|hard time|first time|unfamiliar\w*|maneuver\w*|assist\w*)\b/i.test(evidence)) {
    errors.push("the requested Zoom-difficulty scenario is not established by the evidence");
  }

  const requestsControlledWordingMutation = /\b(?:change|edit|update|rewrite|modify)\b.{0,100}\b(?:wording|template|text|message)\b|\b(?:wording|template|text|message)\b.{0,100}\b(?:change|edit|update|rewrite|modify|leave unchanged)\b/i.test(needText);
  const evidenceAuthorizesControlledWordingMutation = /\b(?:change|edit|update|rewrite|modify|leave)\b.{0,120}\b(?:wording|template|text|message)\b|\b(?:wording|template|text|message)\b.{0,120}\b(?:change|edit|update|rewrite|modify|leave unchanged)\b/i.test(evidence);
  if (requestsControlledWordingMutation && !evidenceAuthorizesControlledWordingMutation) {
    errors.push("the cited policy fact does not authorize modifying the controlled wording");
  }

  const requestsCrossSystemKeapHubspotWorkflow = /\bkeap\b/i.test(needText) && /\bhubspot\b/i.test(needText);
  if (requestsCrossSystemKeapHubspotWorkflow && (!/\bkeap\b/i.test(evidence) || !/\bhubspot\b/i.test(evidence))) {
    errors.push("single-system evidence does not establish the requested Keap-to-HubSpot workflow");
  }

  const technicalControls = [
    ["backup payment link", /\b(?:backup|alternate|alternative|secondary)\s+(?:payment\s+)?link\b/i],
    ["agree-to-terms control", /\b(?:agree|accept|consent)(?:[- ]to[- ]terms)?\s+(?:button|checkbox|control)\b|\bterms?\s+(?:button|checkbox|control)\b/i],
  ] as const;
  for (const [label, pattern] of technicalControls) {
    if (pattern.test(needText) && !pattern.test(evidence)) {
      errors.push(`the requested ${label} failure is not established by the evidence`);
    }
  }

  const asksForCompletedAgreementLocation = need.relation === "artifact_location" &&
    /\b(?:signed|executed|completed)\s+(?:agreement|contract)\b|\b(?:agreement|contract)\b.{0,60}\b(?:signed|executed|completed)\b/i.test(needText);
  const evidenceLocatesCompletedAgreement =
    /\b(?:signed|executed|completed)\s+(?:agreements?|contracts?)\b.{0,140}\b(?:find|locat|view|stored?|zapped?|channel|record|keap|folder|repository)\w*\b|\b(?:find|locat|view|stored?|zapped?|channel|record|keap|folder|repository)\w*\b.{0,140}\b(?:signed|executed|completed)\s+(?:agreements?|contracts?)\b/i.test(evidence);
  if (asksForCompletedAgreementLocation && !evidenceLocatesCompletedAgreement) {
    errors.push("a missing-contract recovery link does not establish where the completed signed agreement is stored");
  }

  const missingContractAutomation = /\b(?:contract|agreement)\b.{0,140}\b(?:does\s*not|doesn't|did\s*not|didn't|not|missing|fail\w*)\b.{0,90}\b(?:populate|generate|appear|arrive|send)\w*\b|\b(?:does\s*not|doesn't|did\s*not|didn't|fail(?:ed|s)?\s+to|unable\s+to)\b.{0,80}\b(?:populate|generate|appear|arrive|send)\w*\b.{0,90}\b(?:contract|agreement)\b/i.test(needText);
  const evidenceSuppliesContractRecovery = /\b(?:contract|agreement)\b.{0,160}\b(?:does\s*not|doesn't|did\s*not|didn't|missing|fail\w*)\b.{0,100}\b(?:populate|generate|appear|arrive|send)\w*\b|\b(?:manual\w*|separate\w*|fallback|recover\w*|resend\w*|reissue\w*)\b.{0,100}\b(?:contract|agreement)\b/i.test(evidence);
  if (missingContractAutomation && !evidenceSuppliesContractRecovery) {
    errors.push("a general contract-signing requirement does not establish the requested recovery process when contract automation fails");
  }

  if (CONDITIONAL_REAPPLICATION.test(rawEvidence)) {
    const evidenceConditions = MATERIAL_REAPPLICATION_CONDITIONS.filter(({ matches }) => matches(rawEvidence));
    if (evidenceConditions.length && !evidenceConditions.some(({ matches }) => matches(authoritativeNeedText))) {
      errors.push(`the reapplication rule requires an unstated trigger (${evidenceConditions.map(({ label }) => label).join("; ")})`);
    }
  }

  const highRiskNumericRelation = ["price_amount", "payment_option", "discount", "procedure", "exception"].includes(need.relation) &&
    /\b(?:pay|payment|deposit|lock[ -]?in|upgrade|discount|refund|price|pricing|installment|split)\b/i.test(needText);
  if (highRiskNumericRelation) {
    const requestedMoney = moneyFacts(rawNeedText);
    const evidenceMoney = moneyFacts(rawEvidence);
    // A source can safely answer an arbitrary proposed amount combination when
    // it explicitly governs every unlisted combination. Requiring that such a
    // boundary repeat the user's exact numbers defeats the point of the rule.
    const establishesGenericUnlistedCombinationBoundary =
      /\bany combination of payment amounts? or dates? that is not one of the current listed plans\b/i.test(evidence) ||
      /\bproposed payment split\b.{0,120}\bnot one of (?:the )?(?:current )?(?:listed|approved) (?:plans?|options?)\b/i.test(evidence);
    if (
      requestedMoney.length &&
      !establishesGenericUnlistedCombinationBoundary &&
      requestedMoney.some((amount) => !moneyFactCovered(amount, evidenceMoney))
    ) {
      errors.push("the request's material payment amount is not covered by the evidence");
    }
  }
  errors.push(...v4SystemicDecisionObjectErrors(authoritativeNeedText, rawEvidence));
  return [...new Set(errors)];
}

export function v4SystemicNeedPolicyRelationErrors(need: V4SystemicNeed, policy: V4SystemicPolicy) {
  const relations = inferV4SystemicPolicyRelations(policy);
  const artifactProcedureCompatible = need.relation === "artifact_identity" &&
    v4SystemicArtifactIdentityProcedureCompatible(need.authorityText || need.text, rawPolicyText(policy));
  const compatibility = artifactProcedureCompatible ? "compatible" : v4SystemicRelationCompatibility(need.relation, relations);
  const materialErrors = v4SystemicMaterialQualifierErrors(need, policy);
  const correctsManualArtifactPremise = ["artifact_identity", "artifact_location"].includes(need.relation) &&
    /\b(?:automatic|automatically|no need to manually|do not manually|not sent manually|without manual)\w*\b/i.test(policy.decision) &&
    ARTIFACT.test(policy.decision) &&
    materialErrors.length === 0;
  const exactRelationshipRequired = new Set<V4SystemicRelation>([
    "price_amount", "payment_option", "discount", "timing_start", "duration", "deadline", "status", "limit",
    "routing", "owner", "location", "artifact_identity", "artifact_location",
  ]).has(need.relation);
  return [
    ...(!correctsManualArtifactPremise && compatibility === "incompatible"
      ? [`the evidence answers ${relations.join("/")} rather than the requested ${need.relation} relationship`]
      : !correctsManualArtifactPremise && compatibility === "unknown" && exactRelationshipRequired
        ? [`the evidence does not establish the requested ${need.relation} relationship`]
      : []),
    ...materialErrors,
  ];
}

export function v4SystemicMaterialQuestionClauses(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return [];
  const initial = normalized
    .split(/(?<=[?])\s+|\s*;\s*|\s+\b(?:also|additionally)\b[:,]?\s*/i)
    .map((clause) => clause.trim())
    .filter(Boolean);
  const split = initial.flatMap((clause) => {
    const conjunction = /\s+\band\b\s+(?=(?:what|how|when|where|who|which|whether|can|could|should|would|will|do|does|is|are)\b)/gi;
    const condition = /\b(?:if|unless|provided(?:\s+that)?|as\s+long\s+as)\b/gi;
    const invertedQuestion = /\b(?:can|could|should|would|will|do|does|is|are|must|may)\s+(?:i|we|you|they|he|she|it|the|a|an|reps?|clients?|prospects?|applicants?)\b/i;
    const parts: string[] = [];
    let start = 0;
    for (const match of clause.matchAll(conjunction)) {
      const boundary = match.index ?? 0;
      const prefix = clause.slice(start, boundary);
      const conditions = [...prefix.matchAll(condition)];
      const lastCondition = conditions[conditions.length - 1];
      if (lastCondition) {
        const conditionalTail = prefix.slice((lastCondition.index ?? 0) + lastCondition[0].length);
        const conditionClosed = /[,;?]/.test(conditionalTail);
        const mainQuestionStartedInsideLeadingCondition =
          !prefix.slice(0, lastCondition.index ?? 0).trim() && invertedQuestion.test(conditionalTail);
        if (!conditionClosed && !mainQuestionStartedInsideLeadingCondition) continue;
      }
      parts.push(clause.slice(start, boundary).trim());
      start = boundary + match[0].length;
    }
    parts.push(clause.slice(start).trim());
    return parts.filter(Boolean);
  });
  return [...new Set(split)].slice(0, 6);
}

export function v4SystemicClauseCoverage(clause: string, needs: Array<Pick<V4SystemicNeed, "text" | "retrievalQueries">>) {
  const stop = new Set(["a", "an", "and", "are", "as", "at", "be", "can", "do", "does", "for", "from", "how", "i", "if", "in", "is", "it", "of", "on", "or", "should", "that", "the", "this", "to", "we", "what", "when", "where", "who", "will", "with"]);
  const comparable = (term: string) => term
    .replace(/^(?:reapply|reapplying|reapplies|reapplied|applying|applies|applied)$/, "apply")
    .replace(/^(?:disqualified|disqualifying)$/, "disqualify")
    .replace(/^(?:someone|person)$/, "person")
    .replace(/^(?:recently|previously)$/, "recent")
    .replace(/(?:ing|ied|ed|es|s)$/i, (suffix) => suffix === "ied" ? "y" : "");
  const terms = normalize(clause).split(" ").filter((term) => term.length > 2 && !stop.has(term)).map(comparable);
  if (!terms.length) return 1;
  const needTerms = new Set(normalize(needs.flatMap((need) => [need.text, ...need.retrievalQueries]).join(" "))
    .split(" ")
    .filter((term) => term.length > 2 && !stop.has(term))
    .map(comparable));
  return [...new Set(terms)].filter((term) => needTerms.has(term)).length / new Set(terms).size;
}
