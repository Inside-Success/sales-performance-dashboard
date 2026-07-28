import type { V4SystemicNeed, V4SystemicPolicy } from "@/lib/ask-sales-faq/v4/systemic/types";

type FocusContract = { id: string; request: RegExp; evidence: RegExp };

const FOCUS_CONTRACTS: FocusContract[] = [
  { id: "studio_address", request: /\bstudio\b[\s\S]{0,80}\b(?:address|location|located|where)\b|\b(?:address|location|located|where)\b[\s\S]{0,80}\bstudio\b|\b(?:inside\s+success|istv)\b[\s\S]{0,80}\b(?:address|location|located)\b/i, evidence: /\b(?:studio|inside\s+success|istv)\b[\s\S]{0,100}\b(?:address|location|located|collins\s+avenue|33139)\b/i },
  { id: "contract_delivery", request: /\bcontract\b[\s\S]{0,100}\b(?:send|sent|deliver|email|automatic|automatically|come\s+up|generate)\b|\b(?:send|sent|deliver|email|automatic|automatically|come\s+up|generate)\b[\s\S]{0,100}\bcontract\b/i, evidence: /\bcontract\b[\s\S]{0,120}\b(?:send|sent|deliver|email|automatic|automation|generate|pdf|link)\b|\b(?:send|sent|deliver|email|automatic|automation|generate|pdf|link)\b[\s\S]{0,120}\bcontract\b/i },
  { id: "contract_amendment", request: /\b(?:contract|agreement)\b[\s\S]{0,80}\b(?:amend|change|customiz|clause|term)\w*\b/i, evidence: /\b(?:contract|agreement)\b[\s\S]{0,100}\b(?:amend|change|customiz|clause|term)\w*\b/i },
  { id: "package_benefits", request: /\b(?:what\s+else|benefits?|advantages?|selling\s+points?|value)\b/i, evidence: /\b(?:benefits?|advantages?|deliverables?|features?|episode|views?|marketing|networking|social\s+assets?|support|value|mastermind|promo(?:tion)?)\b/i },
  { id: "content_rights", request: /\b(?:content|material|footage|reel|clip|episode)\b[\s\S]{0,100}\b(?:use|post|share|rights?|own|download|chop|edit|social)\w*\b|\b(?:use|post|share|rights?|own|download|chop|edit|social)\w*\b[\s\S]{0,100}\b(?:content|material|footage|reel|clip|episode)\b/i, evidence: /\b(?:content|material|footage|reel|clip|episode|social\s+asset)\b[\s\S]{0,120}\b(?:use|post|share|rights?|own|download|chop|edit|social|provide)\w*\b|\b(?:use|post|share|rights?|own|download|chop|edit|social|provide)\w*\b[\s\S]{0,120}\b(?:content|material|footage|reel|clip|episode|social\s+asset)\b/i },
  { id: "networking_or_marketing", request: /\b(?:networking|marketing)\b[\s\S]{0,80}\b(?:which|or|difference|purpose|is\s+it)\b|\b(?:which|or|difference|purpose|is\s+it)\b[\s\S]{0,80}\b(?:networking|marketing)\b/i, evidence: /\b(?:networking|marketing)\b/i },
  { id: "daily_stats", request: /\b(?:daily\s+(?:call\s+)?stats?|call\s+stats?|daily\s+numbers?)\b/i, evidence: /\b(?:daily\s+(?:call\s+)?stats?|call\s+stats?|daily\s+numbers?|stats\s+channel)\b/i },
  { id: "amazon_publish_timing", request: /\bamazon(?:\s+prime)?\b[\s\S]{0,100}\b(?:go\s+live|publish(?:ed|ing)?|when\s+will|how\s+long\s+(?:until|does\s+it\s+take)|timeline)\b|\b(?:go\s+live|publish(?:ed|ing)?|when\s+will|how\s+long\s+(?:until|does\s+it\s+take)|timeline)\b[\s\S]{0,100}\bamazon(?:\s+prime)?\b/i, evidence: /\bamazon(?:\s+prime)?\b[\s\S]{0,120}\b(?:go\s+live|publish|available\s+after|timing|timeline|after\s+filming|delivery)\b/i },
  { id: "call_waiting_no_show_sop", request: /\b(?:call\s*1|first\s+call|audition)\b[\s\S]{0,120}\b(?:not\s+(?:on|there)|hasn['’]?t\s+joined|isn['’]?t\s+there|waiting|wait|late)\b|\b(?:not\s+(?:on|there)|hasn['’]?t\s+joined|isn['’]?t\s+there|waiting|wait|late)\b[\s\S]{0,120}\b(?:call\s*1|first\s+call|audition)\b/i, evidence: /\b(?:(?:\d+|one|two|three|five|ten|fifteen)\s+minutes?|texts?|emails?|calls?|call\s+attempts?|contact|join|late)\b/i },
  { id: "price_objection", request: /\b(?:price|pricing|cost|expensive|afford)\b[\s\S]{0,80}\b(?:objection|pushback|concern|scam|review)\b|\b(?:objection|pushback|concern|scam|review)\b[\s\S]{0,80}\b(?:price|pricing|cost|expensive|afford)\b/i, evidence: /\b(?:objection|pushback|concern|scam|review|over[- ]?argue|defen[cs]e|public\s+proof|search\s+results?)\b/i },
  { id: "outbound_booking_communications", request: /\b(?:communications?|messages?)\b[\s\S]{0,100}\b(?:send|outbound|book(?:ed|ing)?)\b|\b(?:send|outbound|book(?:ed|ing)?)\b[\s\S]{0,100}\b(?:communications?|messages?)\b/i, evidence: /\b(?:text|sms|email|confirmation\s+message|pre[- ]?call\s+message|send)\b/i },
  { id: "dnc", request: /\b(?:dnc|do\s+not\s+contact|unsubscribed|opt(?:ed)?\s*out)\b|\bstop\b(?!\s+by)/i, evidence: /\b(?:dnc|do\s+not\s+contact|unsubscribed|opt(?:ed)?\s*out)\b|\bstop\b(?!\s+by)/i },
];

const CALL_1 = /\b(?:call\s*1|first\s+(?:call|audition)|audition\s+call)\b/i;
const CALL_2 = /\b(?:call\s*2|second\s+(?:call|closing\s+call)|closing\s+call)\b/i;

function clean(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function v513ImmutableNeedText(need: V4SystemicNeed) {
  const direct = clean([need.text, need.authorityText].filter(Boolean).join(" "));
  const contextual = /^(?:what|which|where|when|why|how|it|that|this|they|them|yes|no)\b/i.test(direct) || direct.length < 28;
  return clean([direct, contextual ? need.originalRequestText : "", ...need.actions, ...need.entities].filter(Boolean).join(" "));
}

function policyText(policy: V4SystemicPolicy) {
  // Validate what will actually be projected to the user. Broad titles or
  // question-family metadata must not make an unrelated decision look valid.
  return clean(policy.decision);
}

export function v513DecisionContractErrors(need: V4SystemicNeed, policy: V4SystemicPolicy) {
  const request = v513ImmutableNeedText(need);
  const evidence = policyText(policy);
  const errors: string[] = [];

  const asksPaymentContractSequence = /\bpayment\b/i.test(request) && /\bcontract\b/i.test(request) &&
    /\b(?:first|order|sequence|before|after|both|same\s+time)\b/i.test(request);

  for (const contract of FOCUS_CONTRACTS) {
    // A payment-versus-contract order question is answered by a sequencing
    // decision. It must not be forced through the separate delivery/automation
    // vocabulary merely because the rep used the word "send" or "link".
    if (contract.id === "contract_delivery" && asksPaymentContractSequence) continue;
    if (contract.request.test(request) && !contract.evidence.test(evidence)) errors.push(`focus_mismatch:${contract.id}`);
  }
  if (CALL_1.test(request) && CALL_2.test(evidence) && !CALL_1.test(evidence)) errors.push("stage_mismatch:call_1_to_call_2");
  if (CALL_2.test(request) && CALL_1.test(evidence) && !CALL_2.test(evidence)) errors.push("stage_mismatch:call_2_to_call_1");

  if (/\b(?:what\s+else|benefits?|advantages?|selling\s+points?)\b/i.test(request) &&
      /\b(?:amazon\s+prime|apple\s+tv|platform|placement|submission)\b/i.test(evidence) &&
      !/\b(?:deliverables?|features?|episode|views?|marketing|networking|social\s+assets?|support|mastermind|promo(?:tion)?)\b/i.test(evidence)) {
    errors.push("relationship_mismatch:benefits_vs_platform_boundary");
  }

  // A duration rule answers how long something remains available, not how long
  // it takes to become available. Keep these two Amazon relationships separate.
  if (/\bamazon(?:\s+prime)?\b/i.test(request) && /\b(?:go\s+live|publish|how\s+long\s+until|when\s+will)\b/i.test(request) &&
      /\b(?:duration|remain|minimum\s+of|years?|term|extension)\b/i.test(evidence) &&
      !/\b(?:go\s+live|publish|available\s+after|timing|timeline)\b/i.test(evidence)) {
    errors.push("relationship_mismatch:publication_timing_vs_duration");
  }

  // A discount request and a "20 percent dialing list" recording SOP share a
  // number but are different decisions. Never compose the outbound recording
  // procedure into an offer-discount answer merely because both say 20%.
  if (/\b(?:discount|offer\s+(?:the\s+)?20\s*(?:%|percent))\b/i.test(request) &&
      /\b(?:record(?:ed|ing)?|zoom\s+process|training\s+and\s+quality)\b/i.test(evidence) &&
      !/\b(?:discount|\$2k|\$2,000|off\s+the\s+price|reduced\s+price)\b/i.test(evidence)) {
    errors.push("relationship_mismatch:discount_vs_outbound_recording");
  }

  // Permission for one owner/partner to pay while another signs requires
  // evidence about both roles. A payer-only rule cannot decide signer validity.
  if (/\b(?:pay|payer|payment)\w*\b/i.test(request) && /\b(?:sign|signer|contract)\w*\b/i.test(request) &&
      /\b(?:other|different|one|another)\b/i.test(request) &&
      (!/\b(?:pay|payer|payment)\w*\b/i.test(evidence) || !/\b(?:sign|signer|contract)\w*\b/i.test(evidence))) {
    errors.push("relationship_mismatch:payer_vs_signer");
  }

  return [...new Set(errors)];
}
