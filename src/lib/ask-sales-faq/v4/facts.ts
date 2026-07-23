const EXPLICIT_MONEY = /(?:\bUSD\s*)?\$\s*(\d+(?:,\d{3})*(?:\.\d+)?)\s*([km])?/gi;
const BARE_SCALED_MONEY = /\b(\d+(?:\.\d+)?)\s*([km])\b/gi;
const PERCENT = /\b(\d+(?:\.\d+)?)\s*%/gi;
const DURATION = /\b(\d+(?:\.\d+)?)[\s-]*(business[\s-]+)?(minutes?|mins?|hours?|hrs?|days?|weeks?|months?|years?)\b/gi;
const DURATION_RANGE = /\b(\d+(?:\.\d+)?)\s*(?:-|–|—|to|through)\s*(\d+(?:\.\d+)?)[\s-]*(business[\s-]+)?(minutes?|mins?|hours?|hrs?|days?|weeks?|months?|years?)\b/gi;
const MONEY_RANGE = /(?:\bUSD\s*)?(\$\s*)?(\d+(?:,\d{3})*(?:\.\d+)?)\s*([km])?\s*(?:-|–|—|to|through)\s*(?:\bUSD\s*)?(\$\s*)?(\d+(?:,\d{3})*(?:\.\d+)?)\s*([km])?\b/gi;
const COUNT = /\b(\d+(?:\.\d+)?\s*[km]?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+(payments?|installments?|instalments?|episodes?|seasons?|platforms?|shows?|calls?|texts?|emails?|greenlights?|leads?|clients?|prospects?|applicants?|followers?|viewers?|views?)\b/gi;
const COUNT_RANGE = /\b(\d+(?:\.\d+)?\s*[km]?)\s*(?:-|–|—|to|through)\s*(\d+(?:\.\d+)?\s*[km]?)\s+(payments?|installments?|instalments?|episodes?|seasons?|platforms?|shows?|calls?|texts?|emails?|greenlights?|leads?|clients?|prospects?|applicants?|followers?|viewers?|views?)\b/gi;
const ISO_DATE = /\b(\d{4})-(\d{2})-(\d{2})\b/g;
const NUMERIC_DATE = /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g;
const NAMED_DATE = /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?\b/gi;
const DEADLINE_WEEKDAY = /\b(?:(?:by|before|due|deadline|cutoff|closes?|closing)\s+(?:on\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)|(monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s+\w+){0,3}\s+(?:deadline|cutoff|closes?|closing|due))\b/gi;
const DEADLINE_TIME = /\b(?:by|before|due|deadline|cutoff|closes?|closing)\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)\b/gi;
const CHANNEL = /#[a-z0-9_-]+/gi;

const MONTHS: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

const WORD_NUMBERS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
};

export const V4_ALLOWED_ROUTE_CHANNELS = new Set([
  "#sales-questions-requests",
  "#sales-finance-requests",
  "#sales-tech-requests",
  "#greenlight-requests",
]);

export type V4TypedFact = {
  type: "money" | "percentage" | "duration" | "count" | "date" | "deadline" | "range";
  canonical: string;
  raw: string;
};

function scaledNumber(amount: string, scale = "") {
  const parsed = Number.parseFloat(amount.replace(/,/g, "").replace(/\s+/g, ""));
  const multiplier = scale.toLowerCase() === "m" ? 1_000_000 : scale.toLowerCase() === "k" ? 1_000 : 1;
  return Number.isFinite(parsed) ? parsed * multiplier : Number.NaN;
}

function compactNumber(value: string) {
  const match = value.trim().match(/^(\d+(?:\.\d+)?)\s*([km])?$/i);
  return match ? scaledNumber(match[1], match[2]) : Number.NaN;
}

function stableNumber(value: number) {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(6)));
}

function normalizedDurationUnit(value: string) {
  const unit = value.toLowerCase().replace(/s$/, "");
  return unit === "min" ? "minute" : unit === "hr" ? "hour" : unit;
}

function normalizedCountUnit(value: string) {
  const unit = value.toLowerCase().replace(/s$/, "");
  return unit === "instalment" || unit === "installment" ? "payment" : unit === "view" ? "viewer" : unit;
}

function parsedCount(value: string) {
  const word = WORD_NUMBERS[value.toLowerCase()];
  return word === undefined ? compactNumber(value) : word;
}

function validDate(year: number, month: number, day: number) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function canonicalDate(year: number | null, month: number, day: number) {
  const monthText = String(month).padStart(2, "0");
  const dayText = String(day).padStart(2, "0");
  return year === null ? `date:month-day:${monthText}-${dayText}` : `date:${year}-${monthText}-${dayText}`;
}

function overlaps(spans: Array<[number, number]>, start: number, end: number) {
  return spans.some(([left, right]) => start < right && end > left);
}

function pushFact(facts: V4TypedFact[], fact: V4TypedFact) {
  facts.push(fact);
}

export function extractV4TypedFacts(value: string): V4TypedFact[] {
  const facts: V4TypedFact[] = [];
  const explicitMoneySpans: Array<[number, number]> = [];

  for (const match of value.matchAll(EXPLICIT_MONEY)) {
    const amount = scaledNumber(match[1], match[2]);
    if (!Number.isFinite(amount)) continue;
    const start = match.index || 0;
    explicitMoneySpans.push([start, start + match[0].length]);
    pushFact(facts, { type: "money", canonical: `money:usd:${stableNumber(amount)}`, raw: match[0] });
  }
  for (const match of value.matchAll(BARE_SCALED_MONEY)) {
    const start = match.index || 0;
    if (overlaps(explicitMoneySpans, start, start + match[0].length)) continue;
    const following = value.slice(start + match[0].length).match(/^\s+([a-z]+)/i)?.[1] || "";
    if (/^(?:followers?|viewers?|views?|leads?|clients?|prospects?|applicants?)$/i.test(following)) continue;
    const amount = scaledNumber(match[1], match[2]);
    if (Number.isFinite(amount)) pushFact(facts, { type: "money", canonical: `money:usd:${stableNumber(amount)}`, raw: match[0] });
  }
  for (const match of value.matchAll(PERCENT)) {
    const amount = Number.parseFloat(match[1]);
    if (Number.isFinite(amount)) pushFact(facts, { type: "percentage", canonical: `percentage:${stableNumber(amount)}`, raw: match[0] });
  }
  for (const match of value.matchAll(DURATION)) {
    const amount = Number.parseFloat(match[1]);
    if (!Number.isFinite(amount)) continue;
    const unit = normalizedDurationUnit(match[3]);
    const business = match[2] ? "business-" : "";
    pushFact(facts, { type: "duration", canonical: `duration:${business}${unit}:${stableNumber(amount)}`, raw: match[0] });
  }
  for (const match of value.matchAll(DURATION_RANGE)) {
    const minimum = Number.parseFloat(match[1]);
    const maximum = Number.parseFloat(match[2]);
    if (!Number.isFinite(minimum) || !Number.isFinite(maximum)) continue;
    const unit = normalizedDurationUnit(match[4]);
    const business = match[3] ? "business-" : "";
    pushFact(facts, { type: "range", canonical: `range:duration:${business}${unit}:${stableNumber(minimum)}:${stableNumber(maximum)}`, raw: match[0] });
  }
  for (const match of value.matchAll(MONEY_RANGE)) {
    if (!match[1] && !match[3] && !match[4] && !match[6]) continue;
    const minimum = scaledNumber(match[2], match[3]);
    const maximum = scaledNumber(match[5], match[6]);
    if (!Number.isFinite(minimum) || !Number.isFinite(maximum)) continue;
    pushFact(facts, { type: "range", canonical: `range:money:usd:${stableNumber(minimum)}:${stableNumber(maximum)}`, raw: match[0] });
  }
  for (const match of value.matchAll(COUNT)) {
    const start = match.index || 0;
    // In "Call 1 episode" the numeral names the workflow stage; it is not a
    // claim that there is exactly one episode. Treating it as an episode count
    // causes a grounded answer to fail merely for preserving the user's Call 1
    // context.
    if (/\bcall\s*$/i.test(value.slice(Math.max(0, start - 12), start))) continue;
    const amount = parsedCount(match[1]);
    if (!Number.isFinite(amount)) continue;
    const unit = normalizedCountUnit(match[2]);
    pushFact(facts, { type: "count", canonical: `count:${unit}:${stableNumber(amount)}`, raw: match[0] });
  }
  for (const match of value.matchAll(COUNT_RANGE)) {
    const minimum = compactNumber(match[1]);
    const maximum = compactNumber(match[2]);
    if (!Number.isFinite(minimum) || !Number.isFinite(maximum)) continue;
    const unit = normalizedCountUnit(match[3]);
    pushFact(facts, { type: "range", canonical: `range:count:${unit}:${stableNumber(minimum)}:${stableNumber(maximum)}`, raw: match[0] });
  }
  for (const match of value.matchAll(ISO_DATE)) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (validDate(year, month, day)) pushFact(facts, { type: "date", canonical: canonicalDate(year, month, day), raw: match[0] });
  }
  for (const match of value.matchAll(NUMERIC_DATE)) {
    const month = Number(match[1]);
    const day = Number(match[2]);
    const year = Number(match[3]);
    if (validDate(year, month, day)) pushFact(facts, { type: "date", canonical: canonicalDate(year, month, day), raw: match[0] });
  }
  for (const match of value.matchAll(NAMED_DATE)) {
    const month = MONTHS[match[1].toLowerCase()];
    const day = Number(match[2]);
    const year = match[3] ? Number(match[3]) : null;
    const dateIsValid = year === null
      ? Number.isInteger(month) && day >= 1 && day <= new Date(Date.UTC(2024, month, 0)).getUTCDate()
      : validDate(year, month, day);
    if (dateIsValid) pushFact(facts, { type: "date", canonical: canonicalDate(year, month, day), raw: match[0] });
  }
  for (const match of value.matchAll(DEADLINE_WEEKDAY)) {
    const weekday = (match[1] || match[2]).toLowerCase();
    pushFact(facts, { type: "deadline", canonical: `deadline:weekday:${weekday}`, raw: match[0] });
  }
  for (const match of value.matchAll(DEADLINE_TIME)) {
    let hour = Number(match[1]);
    const minute = Number(match[2] || 0);
    const meridiem = match[3].toLowerCase().replace(/\./g, "");
    if (hour < 1 || hour > 12 || minute < 0 || minute > 59) continue;
    if (hour === 12) hour = 0;
    if (meridiem === "pm") hour += 12;
    pushFact(facts, { type: "deadline", canonical: `deadline:time:${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`, raw: match[0] });
  }

  return Array.from(new Map(facts.map((fact) => [`${fact.type}:${fact.canonical}`, fact])).values());
}

export function unsupportedV4TypedFacts(sentence: string, evidence: string) {
  const supported = new Set(extractV4TypedFacts(evidence).map((fact) => fact.canonical));
  return extractV4TypedFacts(sentence).filter((fact) => !supported.has(fact.canonical));
}

function guaranteePolarity(value: string) {
  const normalizedValue = value.toLowerCase().replace(/[’]/g, "'");
  let positive = false;
  let negative = false;
  const guarantee = /\b(?:guarantee(?:d|s|ing)?|promise(?:d|s|ing)?)\b/g;
  for (const match of normalizedValue.matchAll(guarantee)) {
    const start = match.index || 0;
    const prefix = normalizedValue.slice(Math.max(0, start - 55), start);
    const localNegative = /(?:\bno\s+|\bnot\s+(?:be\s+)?|\bnever\s+|\bwithout\s+(?:a\s+)?|\bcannot\s+(?:be\s+)?|\bcan't\s+(?:be\s+)?|\bdo(?:es)?n't\s+|\bdo(?:es)?\s+not\s+|\bisn't\s+|\baren't\s+|\bwon't\s+)(?:\w+\s+){0,2}$/.test(prefix);
    if (localNegative) negative = true;
    else positive = true;
  }
  return { positive, negative };
}

function permissionPolarity(value: string) {
  const normalizedValue = value.toLowerCase().replace(/[’]/g, "'");
  const negative = /\b(?:cannot|can't|may\s+not|must\s+not|not\s+(?:be\s+)?(?:allowed|permitted)|do(?:es)?\s+not|don't|doesn't|never|prohibit(?:ed|s)?|forbidden)\b/.test(normalizedValue);
  const positive = /\b(?:may|can|allowed|permitted|fine\s+to|okay\s+to|ok\s+to)\b/.test(normalizedValue) &&
    !/\b(?:cannot|can't|may\s+not|not\s+(?:be\s+)?(?:allowed|permitted))\b/.test(normalizedValue) ||
    /\b(?:is|are)\s+up\s+to\s+(?:the\s+)?reps?\b/.test(normalizedValue);
  return { positive, negative };
}

export function deterministicV4SentenceErrors(sentence: string, evidence: string, request = "") {
  const errors: string[] = [];
  const genericUnlistedPaymentBoundary =
    /\bany combination of payment amounts? or dates? that is not one of the current listed plans\b/i.test(evidence) ||
    /\bproposed payment split\b.{0,120}\bnot one of (?:the )?(?:current )?(?:listed|approved) (?:plans?|options?)\b/i.test(evidence);
  // Exact user-supplied amounts may be restated only while applying a cited
  // generic all-unlisted-splits rule. They never become evidence for a price,
  // approved plan, or other numeric policy claim.
  const typedFactEvidence = genericUnlistedPaymentBoundary ? `${evidence}\n${request}` : evidence;
  const unsupported = unsupportedV4TypedFacts(sentence, typedFactEvidence);
  if (unsupported.length) errors.push(`unsupported typed facts: ${unsupported.map((fact) => fact.raw).join(", ")}`);

  const evidenceChannels = new Set((evidence.match(CHANNEL) || []).map((channel) => channel.toLowerCase()));
  const unknownChannels = (sentence.match(CHANNEL) || []).filter((channel) =>
    !V4_ALLOWED_ROUTE_CHANNELS.has(channel.toLowerCase()) &&
    !evidenceChannels.has(channel.toLowerCase()),
  );
  if (unknownChannels.length) errors.push(`unapproved route channels: ${unknownChannels.join(", ")}`);

  const normalizedSentence = sentence.toLowerCase();
  const normalizedEvidence = evidence.toLowerCase();
  const saysAllThree = /\ball\s+(?:three|3)\b/.test(normalizedSentence);
  const evidenceSaysOne = /\b(?:any one|one of|at least one)\b/.test(normalizedEvidence);
  if (saysAllThree && evidenceSaysOne && !/\ball\s+(?:three|3)\b/.test(normalizedEvidence)) {
    errors.push("enumeration changed from one qualifying platform to all three");
  }

  const sentenceGuarantee = guaranteePolarity(sentence);
  const evidenceGuarantee = guaranteePolarity(evidence);
  if (sentenceGuarantee.positive && !evidenceGuarantee.positive) errors.push("unsupported positive guarantee language");
  if (sentenceGuarantee.negative && !evidenceGuarantee.negative) errors.push("unsupported negative guarantee boundary");

  const sentencePermission = permissionPolarity(sentence);
  const evidencePermission = permissionPolarity(evidence);
  if (sentencePermission.positive && evidencePermission.negative && !evidencePermission.positive) {
    errors.push("prohibitive evidence cannot authorize an unstated permission");
  }

  // Not mentioning an artifact is not evidence that it does not exist. This
  // matters when an authority card retires one program but also names current
  // replacement materials: a draft must not turn evidence silence into a
  // categorical "no material is available" answer.
  const claimsNoMaterial = /\b(?:no|not any)\b.{0,50}\b(?:additional|other|supporting|explanatory|training)?\s*(?:materials?|resources?|documents?|assets?|videos?)\b.{0,50}\b(?:available|exist|exists|provided|offered|found)\b|\b(?:materials?|resources?|documents?|assets?|videos?)\b.{0,50}\b(?:are|is)\s+(?:not|no longer)\s+available\b/i.test(sentence);
  const evidenceSaysNoMaterial = /\b(?:no|not any)\b.{0,50}\b(?:additional|other|supporting|explanatory|training)?\s*(?:materials?|resources?|documents?|assets?|videos?)\b.{0,50}\b(?:available|exist|exists|provided|offered|found)\b|\b(?:materials?|resources?|documents?|assets?|videos?)\b.{0,50}\b(?:are|is)\s+(?:not|no longer)\s+available\b/i.test(evidence);
  if (claimsNoMaterial && !evidenceSaysNoMaterial) errors.push("absence of evidence cannot establish that no material is available");

  // A source may describe podcast and documentary formats in the same card
  // while assigning Hollywood-documentary styling only to the documentary.
  // Do not let a fluent paraphrase move that design attribute onto a podcast.
  const podcastIndex = normalizedSentence.search(/\bpodcast(?:\s+episode)?(?:\s+structure)?\b/);
  const documentaryStyleIndex = normalizedSentence.search(/\b(?:hollywood[\s-]*documentary(?:[\s-]*style)?|documentary[\s-]*style|emotional storytelling)\b/);
  const evidenceSeparatesDocumentaryStyle = /\bdocumentary episode\b.{0,160}\b(?:hollywood[\s-]*documentary(?:[\s-]*style)?|documentary[\s-]*style|emotional storytelling)\b/i.test(evidence);
  if (podcastIndex >= 0 && documentaryStyleIndex > podcastIndex && evidenceSeparatesDocumentaryStyle) {
    const intervening = normalizedSentence.slice(podcastIndex, documentaryStyleIndex);
    const explicitlyChangesSubjectToDocumentary = /\bdocumentary(?:\s+episode)?\b/.test(intervening);
    const attributesStyleToPodcast = /\b(?:structure|designed|through|using|uses|follows|style)\b/.test(intervening);
    if (attributesStyleToPodcast && !explicitlyChangesSubjectToDocumentary) {
      errors.push("documentary-only style evidence cannot define the podcast structure");
    }
  }

  // "Freelancing alone is insufficient" is a one-way boundary. It does not
  // establish the stronger inverse that an established business is always a
  // mandatory prerequisite. Preserve that distinction in generated wording.
  const evidenceOnlyRejectsFreelancingAlone = /\bfreelanc(?:e|er|ers|ing)\b.{0,80}\b(?:alone|by itself)\b|\bsolely because\b.{0,80}\bfreelance\b/i.test(evidence);
  const evidenceRequiresEstablishedBusiness = /\b(?:without|unless)\b.{0,60}\b(?:established|genuine|official)\s+business\b|\b(?:must|need(?:s)?\s+to|required to)\s+have\b.{0,40}\b(?:established|genuine|official)\s+business\b/i.test(evidence);
  const sentenceRequiresEstablishedBusiness = /\b(?:without|unless)\b.{0,60}\b(?:established|genuine|official)\s+business\b|\b(?:must|need(?:s)?\s+to|required to)\s+have\b.{0,40}\b(?:established|genuine|official)\s+business\b/i.test(sentence);
  if (evidenceOnlyRejectsFreelancingAlone && sentenceRequiresEstablishedBusiness && !evidenceRequiresEstablishedBusiness) {
    errors.push("freelancing-alone evidence cannot create an absolute established-business prerequisite");
  }

  return errors;
}
