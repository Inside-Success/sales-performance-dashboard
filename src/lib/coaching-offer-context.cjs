// Shared by the dashboard and the generated n8n coaching requests. Keep this
// dependency-free so the same resolver can be embedded in both workflows.
const REALITY_SHOW_EXAMPLES = [
  "entrepreneurs island",
  "business race",
  "mansion of money",
  "flipping fortune",
  "flipping for fortune",
  "startup lockdown",
  "millionaire match house",
];

const MAIN_SHOW_EXAMPLES = [
  "inside success",
  "legacy makers",
  "women in power",
  "kingdom creators",
  "operation ceo",
  "mompreneurs",
  "blue collar america",
];

function normalizeOfferText(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function hasPhrase(value, phrase) {
  return (` ${value} `).includes(` ${phrase} `);
}

function readOfferField(payload, names) {
  if (!payload || typeof payload !== "object") return "";
  for (const candidate of [payload, payload.metadata, payload.fields, payload.source_metadata]) {
    if (!candidate || typeof candidate !== "object") continue;
    for (const name of names) {
      const value = candidate[name];
      if (typeof value === "string" && value.trim()) return value;
    }
  }
  return "";
}

function resolveCoachingOfferFamily(input) {
  const payload = input.sourcePayload || {};
  const show = normalizeOfferText(input.showName || readOfferField(payload, ["show_name", "Show Name", "showName"]));
  const title = normalizeOfferText(input.meetingTitle || readOfferField(payload, ["meeting_title", "Meeting Title", "meetingTitle"]));
  const format = normalizeOfferText(readOfferField(payload, ["show_format", "show_type", "program_type", "offer_family", "Show Format"]));
  const transcript = normalizeOfferText(input.transcriptText).slice(0, 120000);
  const named = `${show} ${title}`;

  // Explicit offer identity outranks general wording such as a comparison made
  // during the call. Never use a person's name as a show signal.
  if (/\b(next level ceo|nl ceo|nlceo|daymond john)\b/.test(named) || /\b(next level ceo|nl ceo|nlceo)\b/.test(format)) {
    return { family: "next_level_ceo", reason: "explicit_show_identity" };
  }
  if (/\b(reality show|reality series|reality tv)\b/.test(format) || REALITY_SHOW_EXAMPLES.some((name) => hasPhrase(named, name))) {
    return { family: "reality", reason: "explicit_show_identity" };
  }
  if (/\b(reality show|reality series|reality tv)\b/.test(named)) {
    return { family: "reality", reason: "explicit_reality_metadata" };
  }
  if (MAIN_SHOW_EXAMPLES.filter((name) => name !== "inside success").some((name) => hasPhrase(show, name)) || /\b(legacy makers|women in power)\b/.test(title)) {
    return { family: "main_istv", reason: "explicit_show_identity" };
  }

  // This permits a future show without adding its name to the examples. Require
  // multiple format cues; a passing mention of another show is insufficient.
  const realityMentions = (transcript.match(/\b(reality show|reality series|reality tv)\b/g) || []).length;
  const realityFormatCues = [
    /\b(eliminat\w*|contestant\w*|competition|challenge\w*)\b/,
    /\b(film\w* on location|film\w* for [0-9]+ days|cast members? in the show)\b/,
    /\b(season one|first season|cast of the show)\b/,
  ].filter((pattern) => pattern.test(transcript)).length;
  if (realityMentions >= 2 && realityFormatCues >= 1) {
    return { family: "reality", reason: "multiple_transcript_format_cues" };
  }
  if (/\b(next level ceo|nl ceo|nlceo)\b/.test(transcript) && !realityMentions) {
    return { family: "next_level_ceo", reason: "transcript_show_identity" };
  }
  if (hasPhrase(show, "inside success") || hasPhrase(title, "inside success")) {
    return { family: "main_istv", reason: "generic_main_metadata" };
  }
  return { family: "unknown", reason: "insufficient_show_evidence" };
}

function realityCoachingReference() {
  return [
    "REALITY OFFER CONTEXT FOR SALES COACHING ONLY (source: ISTV Reality TV Show Cast Master FAQ and Reality Shows Packages, reviewed 2026-09-23).",
    "The six named launch shows are examples, not an exhaustive list of future reality shows. Do not infer show format from a price alone.",
    "Reality Standard is $20,000 and Reality VIP is $30,000. The $12,000 Lite tier and the main ISTV same-day discount must not be presented as reality-show terms.",
    "The reality Call 1 focuses on fit, story, Green Light and booking Call 2. Call 2 reviews approval, uses the relevant reality license video, and discusses the offer, objections, agreement and payment. There is no regular cohort deadline for reality.",
    "A separate $30,000 reality license video is not required; the rep may explain the VIP upgrade after the $20,000 video.",
    "The FAQ describes filming as generally 7-14 consecutive days, with exact dates and location determined by production. Only mention duration when it matters to the call; never turn an estimate into a guaranteed schedule.",
    "The individual trailer has a 100,000 promotional-view guarantee. Do not turn it into guaranteed episode viewers, leads, revenue, a named streaming platform, a fixed prize, or an exact amount of screen time.",
    "Use these facts to avoid incorrect coaching examples, not to score compliance or criticize a rep for a disputed policy claim. Judge selling behavior from the full transcript, credit counterevidence, and do not invent offer exceptions.",
  ].join("\n");
}

module.exports = { resolveCoachingOfferFamily, realityCoachingReference };
