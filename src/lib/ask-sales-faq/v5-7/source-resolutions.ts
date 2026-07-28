import type { V4SystemicNeed } from "@/lib/ask-sales-faq/v4/systemic/types";

type V57SourceResolution = {
  id: string;
  matches: (text: string) => boolean;
  controllingPolicyIds: string[];
  excludedPolicyIds: string[];
  basis: string;
};

function completeNeedText(need: V4SystemicNeed) {
  return [need.authorityText, need.originalRequestText, need.text].filter(Boolean).join(" ");
}

const resolutions: V57SourceResolution[] = [{
  id: "payment-plan-filming-newer-same-authority",
  matches: (text) => /\b(?:film|filming|studio)\b/i.test(text) &&
    /\b(?:payment\s+plan|installment|paid\s+in\s+full|full\s+payment|delinquent)\b/i.test(text),
  controllingPolicyIds: ["operational_09864438bb225c32"],
  excludedPolicyIds: [
    "operational_ac919fb89d05a670",
    "operational_7fc7abe4206048fe",
    "claim_2c2ff8fc9358ae9d",
  ],
  basis: "Madeline's July 9 payment-plan rule is newer and more specifically conditioned than the conflicting May 28 full-payment rule from the same authority.",
}, {
  id: "same-day-discount-versus-upgrade-carry-forward",
  matches: (text) => /\b(?:\$?2,?000|2k)\b/i.test(text) && /\bdiscount\b/i.test(text) &&
    /\b(?:tomorrow|next\s+day|later\s+day|overnight|carry\s+over|carried\s+over|expire|same\s+day)\b/i.test(text) &&
    !/\bupgrade\b/i.test(text),
  controllingPolicyIds: ["operational_0c97b61cb3fa71c2", "claim_9b524458e0f9c673"],
  excludedPolicyIds: [
    "claim_028cf371215a8cc5__a5",
    "claim_9ecfb269cce72cbe__a3",
    "operational_7b181f9ffd6300c7",
  ],
  basis: "A next-day discount-expiration question is a different relationship from carrying an already-earned discount into a later package upgrade.",
}, {
  id: "minor-call-with-guardian",
  matches: (text) => /\b(?:minor|child|children|teen|teenager|\d{1,2}[- ]?year[- ]?old)\b/i.test(text) &&
    /\b(?:mother|father|parent|guardian|consent|present)\b/i.test(text) &&
    /\b(?:call|audition|interview|continue|proceed|participate)\b/i.test(text),
  controllingPolicyIds: ["v57src-minor-call-with-guardian"],
  excludedPolicyIds: ["owner-call2-baseline-package-sequence"],
  basis: "The exact minor-participation rule controls when a parent or guardian is present and consents; generic business-owner eligibility does not answer that relationship.",
}, {
  id: "pre-call-investment-disclosure",
  matches: (text) => /\b(?:investment|price|pricing|cost|minimum|range)\b/i.test(text) &&
    /\b(?:before|prior\s+to|joining|join)\b/i.test(text) &&
    /\b(?:call\s*2|call\s*two|scheduled\s+call|zoom\s+call|spouse)\b/i.test(text),
  controllingPolicyIds: ["operational_2aa0381baee79196"],
  excludedPolicyIds: ["claim_09e9af3ee2e1c686__a1"],
  basis: "The source directly governs investment disclosure before the scheduled Zoom call, including a spouse asking for a range.",
}, {
  id: "license-options-document-permission",
  matches: (text) => /\b(?:license[- ]options|reuse\s+license|license\s+(?:document|doc))\b/i.test(text) &&
    /\b(?:send|share|review|compare|writing|written)\b/i.test(text),
  controllingPolicyIds: ["operational_78f77231bab08f9a"],
  excludedPolicyIds: [],
  basis: "The exact document-usage record governs permission and sales-process advice; this is not a request to locate or modify a live artifact.",
}, {
  id: "spanish-episode-current-policy",
  matches: (text) => /\bspanish\b/i.test(text) && /\b(?:episode|show|film|filming|record|produce)\b/i.test(text),
  controllingPolicyIds: ["operational_af4f8f85e3cfde7b"],
  excludedPolicyIds: [],
  basis: "The latest approved Spanish-episode record directly answers the current availability question while remaining bounded to the reviewed snapshot.",
}, {
  id: "legal-dispensary-current-rule",
  matches: (text) => /\bdispensar(?:y|ies)\b/i.test(text) && /\b(?:legal|eligible|qualif|allowed|fit)\b/i.test(text),
  controllingPolicyIds: ["operational_a9104608f5f69c32"],
  excludedPolicyIds: ["operational_3c0ac04d87edd192"],
  basis: "Madeline's July 8 dispensary rule is newer and directly answers legal-business eligibility without importing the older medicinal-content conditions.",
}, {
  id: "contract-before-call-two-current-advice",
  matches: (text) => /\b(?:contract|agreement)\b/i.test(text) && /\b(?:before|prior\s+to)\b/i.test(text) &&
    /\b(?:call\s*2|call\s*two|lawyer|attorney|legal\s+review)\b/i.test(text) && /\b(?:send|share|review)\b/i.test(text),
  controllingPolicyIds: ["operational_a4bda59185566d1d"],
  excludedPolicyIds: ["operational_95ddcec72a090d31"],
  basis: "The July 7 rule preserves both parts of the decision: sending before Call 2 is allowed but not advised.",
}, {
  id: "no-business-notes-require-qualification",
  matches: (text) => /\b(?:no|without|lack(?:s|ing)?)\s+(?:a\s+)?business\b/i.test(text) &&
    /\b(?:notes?|dial[- ]?out|without\s+calling|before\s+calling|disqualif|unqualified)\b/i.test(text),
  controllingPolicyIds: ["operational_bcd766a411262ca1"],
  excludedPolicyIds: ["operational_1df9f29a7119d9a9"],
  basis: "The July 10 rule directly requires the qualifying questions before disqualification and supersedes a broader June response with an unrelated fitness-coaching example.",
}, {
  id: "stop-reply-phone-only-contact-boundary",
  matches: (text) => /\b(?:replied|reply|texted|texts?)\s+["'“”]?stop\b|\bstop\s+(?:reply|request|message)\b/i.test(text) &&
    /\b(?:call|calling|contact|reach|try)\b/i.test(text),
  controllingPolicyIds: ["operational_a3fafbb7a306f3dc"],
  excludedPolicyIds: ["operational_8b61b93c6ed8d271", "operational_c81af81bd9679394"],
  basis: "Madeline's July 13 rule is the newest exact channel boundary: a phone call may be attempted, while SMS and email remain prohibited after STOP.",
}, {
  id: "stop-reply-opt-out-information-procedure",
  matches: (text) => /\b(?:replied|reply|texted|texts?)\s+["'“”]?stop\b|\bstop\s+(?:reply|request|message)\b/i.test(text) &&
    /\b(?:information|info|anything\s+else|opt[- ]?out|unsubscribe|keap|channel|do\s+anything)\b/i.test(text),
  controllingPolicyIds: ["operational_356efec7010d355c", "operational_7e87d8960485a9e5"],
  excludedPolicyIds: [],
  basis: "The reusable back-end procedure is to post the person's information in the official opt-out channel; the tech team handles Keap.",
}];

export function matchingV57SourceResolutions(need: V4SystemicNeed) {
  const text = completeNeedText(need);
  return resolutions.filter((resolution) => resolution.matches(text));
}

export function v57ControllingPolicyIds(need: V4SystemicNeed) {
  return new Set(matchingV57SourceResolutions(need).flatMap((resolution) => resolution.controllingPolicyIds));
}

export function v57ExcludedPolicyIds(need: V4SystemicNeed) {
  return new Set(matchingV57SourceResolutions(need).flatMap((resolution) => resolution.excludedPolicyIds));
}

export function v57SourceResolutionTrace(need: V4SystemicNeed) {
  return matchingV57SourceResolutions(need).map((resolution) => ({
    id: resolution.id,
    controllingPolicyIds: resolution.controllingPolicyIds,
    excludedPolicyIds: resolution.excludedPolicyIds,
    basis: resolution.basis,
  }));
}
