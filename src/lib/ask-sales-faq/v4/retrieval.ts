import { getV4BlockedTopics, getV4Corpus, getV4MainShowNames, policyEvidenceText } from "@/lib/ask-sales-faq/v4/corpus";
import { v4BlockedTopicDecisionMatch } from "@/lib/ask-sales-faq/v4/boundaries";
import type { V4BlockedCandidate, V4Candidate, V4RetrievalResult } from "@/lib/ask-sales-faq/v4/types";
import type { V3Policy, V3TurnResolution } from "@/lib/ask-sales-faq/v3/types";

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "been", "but", "by", "can", "could", "did", "do", "does", "for", "from", "had", "has",
  "have", "how", "i", "if", "in", "is", "it", "me", "my", "of", "on", "or", "our", "should", "so", "that", "the", "their", "them", "then",
  "there", "these", "they", "this", "those", "to", "us", "was", "we", "were", "what", "when", "where", "which", "who", "why", "will", "with",
  "would", "you", "your",
]);

const CONCEPTS: string[][] = [
  ["price", "pricing", "cost", "package", "offer", "fee"],
  ["payment", "installment", "instalment", "plan", "split", "deposit", "finance"],
  ["refund", "cancel", "cancellation", "chargeback", "moneyback"],
  ["qualify", "qualification", "eligible", "eligibility", "fit", "audition", "applicant"],
  ["apple", "amazon", "roku", "platform", "tier1", "placement", "distribution"],
  ["license", "rights", "reuse", "ownership", "content", "footage", "media"],
  ["guarantee", "promise", "claim", "proof", "compliance"],
  ["text", "sms", "message", "zoomphone", "phone"],
  ["contract", "agreement", "signature", "sign", "edit", "redline"],
  ["franchise", "franchisee", "franchisor"],
  ["nonprofit", "charity", "foundation"],
  ["doctor", "physician", "hospital", "practice"],
  ["lawyer", "attorney", "legal", "firm"],
  ["current", "active", "latest", "today", "now"],
  ["show", "series", "program", "episode"],
  ["recording", "recorded", "zoom", "call"],
  ["commercial", "business", "company", "brand"],
  ["email", "mail", "inbox"],
  ["link", "url", "checkout"],
  ["cohort", "deadline", "greenlight", "reschedule"],
  ["script", "scripting", "scriptwriter", "scriptwriting"],
];

function normalize(value: string) {
  return value.toLowerCase()
    .replace(/next\s+level\s+ceo/g, " nlceo ")
    .replace(/daymond\s+john/g, " dj ")
    .replace(/tier[\s-]*1/g, " tier1 ")
    .replace(/zoom\s+phone/g, " zoomphone ")
    .replace(/[^a-z0-9$%]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stem(token: string) {
  if (token.length <= 4) return token;
  if (/^freelanc(?:e|er|ers|ing)$/.test(token)) return "freelance";
  if (/^slides?$/.test(token)) return "slide";
  return token
    .replace(/ies$/, "y")
    .replace(/(?:ing|ers|er|ed|es|s)$/, "")
    .replace(/(?:tion|ment)$/, "");
}

const CONCEPT_BY_TOKEN = new Map<string, string[]>();
for (const group of CONCEPTS) {
  for (const token of group) CONCEPT_BY_TOKEN.set(stem(token), group);
}

function tokens(value: string) {
  return normalize(value).split(" ").filter((token) => token.length > 1 && !STOP_WORDS.has(token)).map(stem);
}

function expandTokens(input: string[]) {
  const expanded = new Set(input);
  for (const token of input) {
    const group = CONCEPT_BY_TOKEN.get(token);
    if (group) for (const member of group) expanded.add(stem(member));
  }
  return [...expanded];
}

function trigrams(value: string) {
  const text = `  ${normalize(value)}  `;
  const output = new Set<string>();
  for (let index = 0; index <= text.length - 3; index += 1) output.add(text.slice(index, index + 3));
  return output;
}

function jaccard(left: Set<string>, right: Set<string>) {
  if (!left.size || !right.size) return 0;
  let overlap = 0;
  for (const item of left) if (right.has(item)) overlap += 1;
  return overlap / (left.size + right.size - overlap);
}

function tokenOverlap(query: string[], document: string[]) {
  if (!query.length || !document.length) return { score: 0, matched: [] as string[] };
  const documentSet = new Set(document);
  const matched = [...new Set(query.filter((token) => documentSet.has(token)))];
  return { score: matched.length / Math.sqrt(query.length * Math.max(1, new Set(document).size)), matched };
}

function directionalFamilyCoverage(query: string[], policy: V3Policy) {
  const uniqueQuery = [...new Set(query)];
  return [policy.title, ...policy.question_families].reduce((best, value) => {
    const familyTokens = [...new Set(tokens(value))];
    const matched = tokenOverlap(uniqueQuery, familyTokens).matched;
    const score = matched.length / Math.max(1, Math.min(uniqueQuery.length, familyTokens.length));
    return score > best.score || (score === best.score && matched.length > best.matched.length) ? { score, matched } : best;
  }, { score: 0, matched: [] as string[] });
}

function bm25(query: string[], document: string[], documentFrequency: Map<string, number>, documentCount: number, averageLength: number) {
  if (!query.length || !document.length) return 0;
  const termFrequency = new Map<string, number>();
  for (const token of document) termFrequency.set(token, (termFrequency.get(token) || 0) + 1);
  const k1 = 1.2;
  const b = 0.75;
  let score = 0;
  for (const token of new Set(query)) {
    const frequency = termFrequency.get(token) || 0;
    if (!frequency) continue;
    const frequencyInDocuments = documentFrequency.get(token) || 0;
    const idf = Math.log(1 + (documentCount - frequencyInDocuments + 0.5) / (frequencyInDocuments + 0.5));
    score += idf * ((frequency * (k1 + 1)) / (frequency + k1 * (1 - b + b * (document.length / Math.max(1, averageLength)))));
  }
  return score;
}

function scopeScore(policy: V3Policy, turn: V3TurnResolution) {
  if (turn.excludedScopes.some((scope) => policy.product_scopes.includes(scope))) return -10;
  if (turn.productScope === "unknown") return policy.product_scopes.includes("product_agnostic") ? 0.5 : 0;
  if (turn.productScope === "comparison") {
    return policy.product_scopes.includes("main_istv") || policy.product_scopes.includes("dj_nlceo") ? 1 : 0;
  }
  if (policy.product_scopes.includes(turn.productScope)) return 2;
  if (policy.product_scopes.includes("product_agnostic")) return 0.75;
  return -2;
}

function qualityBoost(policy: V3Policy) {
  const quality = policy.quality_tier === "canonical" ? 1.4 : policy.quality_tier === "trusted_evidence" ? 0.9 : policy.quality_tier === "supporting" ? 0.5 : 0.1;
  const answerability = policy.answerability === "answer_evidence" ? 1 : policy.answerability === "route_or_support" ? 0.15 : -2;
  return quality + answerability + Math.min(1.2, Math.max(0, policy.authority - 80) / 30);
}

function queryCoverageSignal(policy: V3Policy, query: string, turn: V3TurnResolution) {
  const normalizedQuery = normalize(query);
  const evidence = policyEvidenceText(policy).toLowerCase();
  let score = 0;
  if (/\b(?:prices?|pricing|costs?)\b/.test(normalizedQuery) && (evidence.match(/\$\s*\d/g) || []).length >= 2) score += 4;
  if (/\b(?:payment plans?|installments?|instalments?)\b/.test(normalizedQuery) && /\b(?:payment plans?|listed plans?|installments?|instalments?)\b|\$\s*[\d,.]+\s*x\s*\d/i.test(evidence)) score += 4;
  if (/\b(?:doctor|physician|\bmd\b)\b/.test(normalizedQuery) && /\b(?:doctor|physician)\b/i.test(evidence)) score += 2;
  if (/\b(?:nurse|\brn\b)\b/.test(normalizedQuery) && /\bnurse\b/i.test(evidence)) score += 2;
  if (/\b(?:watch|watchable|stream|on air|aired|airing)\b/.test(normalizedQuery) && /\b(?:watch|watchable|stream|on air|aired|airing|episode availability)\b/i.test(evidence)) score += 3;
  if (/\b(?:tier1|apple tv|amazon prime|tubi|platform)\b/.test(normalizedQuery) && /\b(?:tier[ -]?1|apple tv|amazon prime|tubi|platform)\b/i.test(evidence)) score += 3;
  if (turn.productScope !== "unknown" && turn.productScope !== "comparison" && policy.product_scopes.includes(turn.productScope)) score += 2;
  return score;
}

type GovernedPriorityFamily =
  | "main_prices"
  | "main_payments"
  | "same_day_discount"
  | "dj_offers"
  | "tier_one_boundary"
  | "app_devices"
  | "show_list"
  | "watchability"
  | "episode_viewing_path"
  | "nlceo_social_assets_boundary"
  | "roi_boundary"
  | "language_boundary"
  | "season_capacity"
  | "call_1_flow"
  | "post_sale_handoff"
  | "contract_before_call_2"
  | "stop_reinstatement"
  | "existing_client_cross_show"
  | "reuse_license_purpose"
  | "zoom_phone_payment_link"
  | "fathom_zoom_recording"
  | "main_cross_show_reapply"
  | "keap_missing_show_recovery"
  | "studio_tour_guest_limit"
  | "unlisted_payment_split"
  | "freelancer_qualification"
  | "public_calendar_fallback"
  | "previously_claimed_twenty_percent_lead"
  | "six_month_training"
  | "finance_route"
  | "internal_stats_sharing"
  | "future_launch_qualification"
  | "vip_repeat_episode"
  | "scriptwriter_process"
  | "event_access_handoff"
  | "twenty_percent_recording"
  | "twenty_percent_templates_timing"
  | "nlceo_cohort_boundary"
  | "podcast_purpose_format"
  | "partner_payment"
  | "recurring_invoice"
  | "repeat_disqualified";

function policyMatchesPriorityFamily(policy: V3Policy, family: GovernedPriorityFamily) {
  const key = policy.decision_key;
  const policyKey = policy.policy_key;
  const decision = normalize(policy.decision);
  switch (family) {
    case "main_prices":
      return key === "istv-nlceo-pricing-and-same-day-discount-answer-1";
    case "main_payments":
      return key === "istv-nlceo-pricing-and-same-day-discount-answer-2";
    case "same_day_discount":
      return key.startsWith("istv-nlceo-pricing-and-same-day-discount-answer-4") ||
        (policyKey.startsWith("istv-nlceo-pricing-and-same-day-discount") && /same day discount/.test(decision));
    case "dj_offers":
      return key === "dj-nlceo-current-offer-overview";
    case "tier_one_boundary":
      return key === "vip-license-platform-coverage";
    case "app_devices":
      return key === "istv-app-download-devices";
    case "show_list":
      return key === "current-show-source-latest-approved-show-list-1";
    case "watchability":
      return key === "current-show-list-watchability-boundary" || key === "current-show-watchability-route";
    case "episode_viewing_path":
      return policy.id === "claim_70baa6ddc112bd58";
    case "nlceo_social_assets_boundary":
      return policy.id === "claim_3a43cb9eed71cb37";
    case "roi_boundary":
      return key === "roi-questions" ||
        (policyKey.startsWith("platform-proof-and-claims-boundaries") && /do not promise roi/.test(decision));
    case "language_boundary":
      return key.startsWith("production-language-and-translation-boundary-answer-1") ||
        key.startsWith("production-language-and-translation-boundary-what-reps-can-say-1");
    case "season_capacity":
      return key === "show-season-capacity";
    case "call_1_flow":
      return policy.title === "Call 1 Flow: Answer" || policy.title === "Call 1 Flow: Escalation rule";
    case "post_sale_handoff":
      return policy.title === "Post-Sale Handoff After Close: Answer";
    case "contract_before_call_2":
      return policy.id === "claim_6b3311cee0cd4b18__a2";
    case "stop_reinstatement":
      return policy.id === "claim_d2519c5b8045823b";
    case "existing_client_cross_show":
      return policy.id === "claim_606e9d59e3cd964f";
    case "reuse_license_purpose":
      return policy.id === "claim_74f78173844719e2" || policy.id === "claim_b3d565ada1ff6fd8";
    case "zoom_phone_payment_link":
      return policy.id === "owner-zoom-phone-payment-link-email-only";
    case "fathom_zoom_recording":
      return policy.id === "owner-fathom-zoom-recording-prohibited";
    case "main_cross_show_reapply":
      return policy.id === "owner-main-istv-cross-show-reapply-wait";
    case "keap_missing_show_recovery":
      return policy.id === "owner-keap-missing-show-name-recovery";
    case "studio_tour_guest_limit":
      return policy.id === "claim_4d14d445a904a4af";
    case "unlisted_payment_split":
      return policy.id === "owner-unlisted-payment-split-boundary";
    case "freelancer_qualification":
      return policy.id === "claim_59be9c344b9359a4";
    case "public_calendar_fallback":
      return policy.id === "claim_d93982445e426907" || policy.id === "claim_5af708598311071c";
    case "previously_claimed_twenty_percent_lead":
      return policy.id === "v3src_previously_claimed_twenty_percent_lead";
    case "six_month_training":
      return policy.id === "owner-six-month-training-discontinued";
    case "finance_route":
      return policy.id === "claim_f2bddec7b84e1829__a1";
    case "internal_stats_sharing":
      return policy.id === "claim_49827b5abfa86d45" || policy.id === "claim_848ba0ca58988282__a2";
    case "future_launch_qualification":
      return policy.id === "claim_aa93466af64a3cdd";
    case "vip_repeat_episode":
      return policy.id === "claim_313aa422c956e5c1";
    case "scriptwriter_process":
      return policy.id === "claim_5996647e28cf3b69" ||
        policy.id === "claim_9829630199781d19" ||
        policy.id === "owner-scriptwriter-scheduling-fulfillment-route";
    case "event_access_handoff":
      return policy.id === "claim_e35c3076026455e6" ||
        policy.id === "claim_d33f7f1813b3f7a5" ||
        policy.id === "claim_9e04ab861ce2702f";
    case "twenty_percent_recording":
      return policy.id === "owner-twenty-percent-recording-and-disclosure";
    case "twenty_percent_templates_timing":
      return policy.id === "claim_3585b16e8ef643a9" || policy.id === "v3src_confirmation_calendar_day_before";
    case "nlceo_cohort_boundary":
      return policy.id === "claim_bb04a794e0a74ea5__a4";
    case "podcast_purpose_format":
      return policy.id === "owner-podcast-purpose-and-current-format";
    case "partner_payment":
      return policy.id === "claim_51695e7c59d2608a";
    case "recurring_invoice":
      return policy.id === "claim_754c01ed0089dc82";
    case "repeat_disqualified":
      return policy.id === "claim_a5945bc4fd156d47" || policy.id === "claim_4c5932f5c97e68ed";
  }
}

export function resolveV4PriorityPolicyFamily(corpus: V3Policy[], family: GovernedPriorityFamily) {
  return corpus.filter((policy) => policyMatchesPriorityFamily(policy, family));
}

function governedPriorityPolicyIds(corpus: V3Policy[], query: string, turn: V3TurnResolution) {
  const normalizedQuery = normalize(query);
  const compactQuery = normalizedQuery.replace(/\s+/g, "");
  const families = new Set<GovernedPriorityFamily>();
  const asksPricing = /\b(?:prices?|pricing|costs?|packages?|offers?|payments?|payment plans?|installments?|instalments?)\b/.test(normalizedQuery);
  const explicitDj = turn.productScope === "dj_nlceo" || /\b(?:dj|nlceo)\b/.test(normalizedQuery);
  const explicitMain = turn.productScope === "main_istv" || /\bmain istv\b/.test(normalizedQuery);
  const namesActiveShowInStatusQuestion = getV4MainShowNames().some((showName) => {
    const normalizedName = normalize(showName).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
    const actionBeforeName = new RegExp(`\\b(?:are\\s+(?:we|they)|do\\s+we|is\\s+(?:the\\s+)?show)\\s+(?:still\\s+|currently\\s+)?(?:(?:run|offer)(?:ning|ing|ed)?\\s+(?:the\\s+)?|cast(?:ing)?\\s+(?:for\\s+)?(?:the\\s+)?)${normalizedName}\\b`);
    const nameBeforeAction = new RegExp(`\\b(?:is|are)\\s+(?:the\\s+)?${normalizedName}\\s+(?:still\\s+|currently\\s+)?(?:running|casting|offered|available)\\b`);
    return actionBeforeName.test(normalizedQuery) || nameBeforeAction.test(normalizedQuery);
  });
  const hasTwentyPercentContext = /(?:20%|\b20\s*percent\b|\btwenty\s+percent\b)/.test(normalizedQuery);

  if (asksPricing && (!explicitDj || explicitMain)) {
    families.add("main_prices");
    families.add("main_payments");
  }
  if (asksPricing && (!explicitMain || explicitDj)) families.add("dj_offers");
  if (/\$20(?:000|k)\b/.test(compactQuery) &&
    (/\b(?:pre promo|pre promotional|promotional|promotion)\b.{0,60}\b(?:views?|viewership)\b|\b(?:views?|viewership)\b.{0,60}\b(?:pre promo|pre promotional|promotional|promotion)\b/.test(normalizedQuery))) {
    families.add("main_prices");
  }
  if (/\b(?:same day|same-day)\b.{0,40}\bdiscount\b|\bdiscount\b.{0,40}\b(?:same day|same-day)\b/.test(normalizedQuery)) {
    families.add("same_day_discount");
  }
  if (/\b(?:tier1|apple tv|amazon prime|tubi|platform placement|streaming platforms?|streaming plaforms?)\b|\bvip\b.{0,60}\b(?:cover|covers|include|includes|advantages?|benefits?)\b|\b(?:cover|covers|include|includes|advantages?|benefits?)\b.{0,60}\bvip\b/.test(normalizedQuery)) {
    families.add("tier_one_boundary");
  }
  if (/\b(?:download|install)\b.{0,40}\b(?:istv|isn)(?:\s+app)?\b|\bget\b.{0,40}\b(?:istv|isn)?\s*app\b|\b(?:roku|fire stick|apple tv)\b.{0,40}\bapp\b|\b(?:which|what)\s+devices?\b.{0,40}\b(?:support|run|use)\b.{0,20}\bapp\b|\bapp\b.{0,30}\b(?:devices?|roku|fire stick|apple tv)\b/.test(normalizedQuery)) {
    families.add("app_devices");
  }
  if (/\b(?:watch|watchable|stream|streaming|on air|aired|airing|episode availability)\b/.test(normalizedQuery)) {
    families.add("watchability");
  }
  if (/\b(?:live|currently live|sendable|available)\b.{0,80}\bepisodes?\b|\bepisodes?\b.{0,80}\b(?:live|currently live|sendable|available|view|watch)\b/.test(normalizedQuery)) {
    families.add("episode_viewing_path");
  }
  if (/\b(?:current|active|approved|available|latest)\b.{0,35}\bshow(?:s| list)?\b|\bwhat shows\b|\blist (?:of|the) shows\b|\bshows (?:we are|we re) currently casting\b/.test(normalizedQuery)) {
    families.add("show_list");
    families.add("watchability");
  }
  if (namesActiveShowInStatusQuestion) families.add("show_list");
  if (/\b(?:roi|return on investment|revenue guarantee|guaranteed leads?|fundrais|viewer numbers?|viewership|audience statistics?)\b/.test(normalizedQuery)) {
    families.add("roi_boundary");
  }
  if (/\b(?:spanish|non english|another language|translation|translate|translated|bilingual)\b/.test(normalizedQuery)) {
    families.add("language_boundary");
  }
  if (/\b(?:how many|multiple)\b.{0,35}\b(?:seasons?|episodes?(?: per season| for (?:a|the) show)?)\b|\bseason capacity\b/.test(normalizedQuery)) {
    families.add("season_capacity");
  }
  if (/\b(?:approved guidance (?:for|on)|guidance (?:for|on))\s+call\s*1 flow\b|\bcall\s*1 flow\b/.test(normalizedQuery)) {
    families.add("call_1_flow");
  }
  if (/\b(?:approved guidance (?:for|on)|guidance (?:for|on))\s+post sale handoff after close\b|\bpost sale handoff after close\b/.test(normalizedQuery)) {
    families.add("post_sale_handoff");
  }
  if (/\b(?:send|share|provide)\b.{0,80}\b(?:contract|agreement)\b.{0,80}\b(?:before call 2|legal|review)\b|\b(?:contract|agreement)\b.{0,80}\b(?:legal|review)\b.{0,80}\bbefore call 2\b/.test(normalizedQuery)) {
    families.add("contract_before_call_2");
  }
  if (/\b(?:texted|replied|said|wrote) stop\b|\bstop\b.{0,80}\b(?:reinstat|resubscrib|contact|book)\w*\b/.test(normalizedQuery)) {
    families.add("stop_reinstatement");
  }
  if (/\b(?:existing|current|already)\b.{0,50}\b(?:istv )?(?:client|customer|cast member)\b.{0,120}\b(?:another|different|new)\b.{0,40}\bshow\b|\b(?:another|different|new)\b.{0,40}\bshow\b.{0,120}\b(?:existing|current|already)\b.{0,50}\b(?:client|customer|cast member)\b/.test(normalizedQuery)) {
    families.add("existing_client_cross_show");
  }
  if (/\b(?:commercial )?reuse license\b/.test(normalizedQuery) &&
    /\b(?:why|purpose|cover|covers|decline|declines|declined|greenlit|greenlight|reuse|republish)\w*\b/.test(normalizedQuery)) {
    families.add("reuse_license_purpose");
  }
  if (/\bpayment link\b/.test(normalizedQuery) &&
    /\b(?:zoom phone|sms|text|message|email)\b/.test(normalizedQuery)) {
    families.add("zoom_phone_payment_link");
  }
  if (/\bfathom\b/.test(normalizedQuery) &&
    /\bzoom\b/.test(normalizedQuery) &&
    /\b(?:record|recording|transcript|summary|summaries|coaching|backup|call review)\w*\b/.test(normalizedQuery)) {
    families.add("fathom_zoom_recording");
  }
  if (/\b(?:different|another|new)\b.{0,40}\b(?:main )?istv show\b|\b(?:legacy makers|america s authors)\b/.test(normalizedQuery) &&
    /\b(?:reapply|reapplication|apply now|wait|waiting|canceled call2|cancelled call2|could not make the investment|different show)\b/.test(normalizedQuery)) {
    families.add("main_cross_show_reapply");
  }
  if (/\b(?:show name|which show)\b/.test(normalizedQuery) &&
    /\bkeap\b/.test(normalizedQuery) &&
    /\b(?:missing|blank|calendar|find|recover|update)\w*\b/.test(normalizedQuery)) {
    families.add("keap_missing_show_recovery");
  }
  if (/\b(?:studio tour|tour the studio|studio walkthrough)\b/.test(normalizedQuery) &&
    /\b(?:guest|guests|friend|friends|sign|signing|film|filming|shoot)\w*\b/.test(normalizedQuery)) {
    families.add("studio_tour_guest_limit");
  }
  const moneyAmounts = normalizedQuery.match(/\$\s*\d+(?:\.\d+)?\s*k?\b/g) || [];
  if (moneyAmounts.length >= 2 && /\b(?:first|remaining|balance|later|weeks?|months?|contract|split)\b/.test(normalizedQuery)) {
    families.add("unlisted_payment_split");
  }
  if (/\bfreelanc(?:e|er|ers|ing)\b/.test(normalizedQuery) && /\b(?:qualif|business|entrepreneur|call\s*2)\w*\b/.test(normalizedQuery)) {
    families.add("freelancer_qualification");
  }
  if (/\b(?:public calendar|oncehub)\b/.test(normalizedQuery) && /\b(?:later|next week|outside|missing|only allows?|unavailable)\b/.test(normalizedQuery)) {
    families.add("public_calendar_fallback");
  }
  if (/\b(?:dial out|20percent|twenty percent)\b/.test(normalizedQuery) && /\b(?:another|other|original) rep\b/.test(normalizedQuery) && /\b(?:no show|no showed|previously claimed|rebook|contact)\b/.test(normalizedQuery)) {
    families.add("previously_claimed_twenty_percent_lead");
  }
  if (/\b(?:six month|weekly)\b.{0,80}\btraining\b|\btraining\b.{0,80}\b(?:six month|weekly)\b/.test(normalizedQuery)) {
    families.add("six_month_training");
  }
  if (/\b(?:ach|wire|invoice|billing|refund|duplicate charge|payment status|auto draft|automatic(?:ally)? draft|future payments?|card requirement)\b/.test(normalizedQuery)) {
    families.add("finance_route");
  }
  if (/\b(?:stats?|statistics|social reach|combined following)\b/.test(normalizedQuery) &&
    /\b(?:slides?|decks?|screenshots?|photos?|images?)\b/.test(normalizedQuery) &&
    /\b(?:send|share|reference|show|take|taking|photograph|screenshot|client|prospect|external)\w*\b/.test(normalizedQuery)) {
    families.add("internal_stats_sharing");
  }
  if (/\b(?:pre launch|prelaunch|not launched|not launch|launch(?:es|ing)? in|future launch)\b/.test(normalizedQuery) &&
    /\b(?:call\s*1|qualif\w*|fit|greenlit?|greenlight|eligible|audition|disqualif\w*)\b/.test(normalizedQuery)) {
    families.add("future_launch_qualification");
  }
  const vipMentions = normalizedQuery.match(/\bvip\b/g)?.length || 0;
  if (vipMentions >= 2 &&
    (/\b(?:second|another|additional|repeat)\b.{0,40}\bepisodes?\b|\bepisodes?\b.{0,40}\b(?:second|another|additional|repeat)\b/.test(normalizedQuery)) &&
    /(?:50%|\b(?:discount|half off|percent off|off)\b)/.test(normalizedQuery)) {
    families.add("vip_repeat_episode");
  }
  if (/\b(?:scriptwriter|script writer|scriptwriting|script writing|scripting|script)\b/.test(normalizedQuery) &&
    /\b(?:process|paired|pairing|assigned|book|booking|schedule|scheduling|timing|when|receive|delivery|delivered|available|filming)\b/.test(normalizedQuery)) {
    families.add("scriptwriter_process");
  }
  if (/\b(?:events?|mastermind|red carpet)\b/.test(normalizedQuery) &&
    /\baccess\b/.test(normalizedQuery) &&
    /\b(?:call\s*2|sales?|onboarding|after (?:the )?sale|explain|explained|discuss|discussed)\b/.test(normalizedQuery)) {
    families.add("event_access_handoff");
  }
  if (hasTwentyPercentContext &&
    /\b(?:dial(?:ing)? out|dialout|outbound|list|lead)\b/.test(normalizedQuery) &&
    /\brecord(?:ed|ings?)?\b/.test(normalizedQuery)) {
    families.add("twenty_percent_recording");
  }
  if (hasTwentyPercentContext &&
    /\b(?:dial(?:ing)? out|dialout|outbound|list|lead)\b/.test(normalizedQuery) &&
    /\b(?:email|sms|text|message|template|wording|confirmation)\w*\b/.test(normalizedQuery) &&
    /\b(?:night before|morning of|day before|when|timing|template|wording)\b/.test(normalizedQuery)) {
    families.add("twenty_percent_templates_timing");
  }
  if (/\b(?:daymond john|next level ceo|nlceo|dj)\b/.test(normalizedQuery) &&
    /\bcohort\b/.test(normalizedQuery)) {
    families.add("nlceo_cohort_boundary");
  }
  if (/\bpodcast\b/.test(normalizedQuery) &&
    /\b(?:lead generation|generate leads|questions|structure|format|designed|interview|interviewer|recorded)\b/.test(normalizedQuery)) {
    families.add("podcast_purpose_format");
  }
  if (/\b(?:daymond john|next level ceo|nlceo|dj)\b/.test(normalizedQuery) &&
    /\b(?:social|promotional)\b.{0,60}\b(?:assets?|package|management|deliverables?|promise|promising)\b|\b(?:assets?|package|management|deliverables?|promise|promising)\b.{0,60}\b(?:social|promotional)\b/.test(normalizedQuery)) {
    families.add("nlceo_social_assets_boundary");
  }
  if (/\b(?:business partner|partner|family member|decision maker|third party)\b.{0,90}\b(?:pay|payment|paid)\w*\b|\b(?:pay|payment|paid)\w*\b.{0,90}\b(?:business partner|partner|family member|decision maker|third party)\b/.test(normalizedQuery)) {
    families.add("partner_payment");
  }
  if (/\b(?:recurring|installment)\b.{0,80}\b(?:invoice|ledger|commission|payment)\w*\b|\b(?:invoice|ledger|commission)\w*\b.{0,80}\brecurring\b/.test(normalizedQuery)) {
    families.add("recurring_invoice");
  }
  if (/\b(?:recently|repeatedly|keeps?)\b.{0,80}\bdisqualif\w*\b|\bdisqualif\w*\b.{0,100}\b(?:reapply|applying again|repeat booking|keeps? applying)\b/.test(normalizedQuery)) {
    families.add("repeat_disqualified");
  }
  return new Set([...families].flatMap((family) => resolveV4PriorityPolicyFamily(corpus, family).map((policy) => policy.id)));
}

function ranked<T>(items: T[], score: (item: T) => number) {
  return [...items].sort((left, right) => score(right) - score(left));
}

function reciprocalRankMaps(
  policies: V3Policy[],
  signals: Map<string, { lexical: number; family: number; character: number; field: number; coverage: number }>,
) {
  const sources = ["lexical", "family", "character", "field", "coverage"] as const;
  const result = new Map<string, Record<string, number>>();
  for (const source of sources) {
    const order = ranked(policies, (policy) => signals.get(policy.id)?.[source] || 0);
    order.forEach((policy, index) => {
      const score = signals.get(policy.id)?.[source] || 0;
      if (score <= 0) return;
      const current = result.get(policy.id) || {};
      current[source] = index + 1;
      result.set(policy.id, current);
    });
  }
  return result;
}

export function retrieveV4Policies(turn: V3TurnResolution, limit = 32): V4RetrievalResult {
  const startedAt = Date.now();
  const corpus = getV4Corpus();
  const query = turn.standaloneQuestion;
  const queryTokens = tokens(query);
  const expanded = expandTokens(queryTokens);
  const queryTrigrams = trigrams(query);
  const documents = new Map(corpus.map((policy) => [policy.id, tokens(policyEvidenceText(policy))]));
  const averageLength = corpus.reduce((total, policy) => total + (documents.get(policy.id)?.length || 0), 0) / Math.max(1, corpus.length);
  const documentFrequency = new Map<string, number>();
  for (const document of documents.values()) for (const token of new Set(document)) documentFrequency.set(token, (documentFrequency.get(token) || 0) + 1);
  const governedPriorityIds = governedPriorityPolicyIds(corpus, query, turn);

  const signals = new Map<string, { lexical: number; family: number; familyCoverage: number; familyMatched: string[]; character: number; field: number; coverage: number; matched: string[]; lexicalMatched: string[]; scope: number }>();
  for (const policy of corpus) {
    const document = documents.get(policy.id) || [];
    const lexical = bm25(expanded, document, documentFrequency, corpus.length, averageLength);
    const family = Math.max(0, ...[policy.title, ...policy.question_families].map((value) => tokenOverlap(queryTokens, tokens(value)).score));
    const familyCoverage = directionalFamilyCoverage(queryTokens, policy);
    const character = Math.max(0, ...[policy.title, ...policy.question_families].map((value) => jaccard(queryTrigrams, trigrams(value))));
    const fields = tokenOverlap(expanded, tokens([...policy.domains, ...policy.actions, ...policy.entities, policy.decision_key].join(" ")));
    const lexicalMatched = tokenOverlap(queryTokens, document).matched;
    const scope = scopeScore(policy, turn);
    const coverage = queryCoverageSignal(policy, query, turn);
    signals.set(policy.id, { lexical, family, familyCoverage: familyCoverage.score, familyMatched: familyCoverage.matched, character, field: fields.score, coverage, matched: fields.matched, lexicalMatched, scope });
  }

  const eligiblePolicies = corpus.filter((policy) => {
    const signal = signals.get(policy.id)!;
    const meaningfulSignal = governedPriorityIds.has(policy.id) || signal.lexical > 0 || signal.family >= 0.12 || signal.familyCoverage >= 0.25 || signal.character >= 0.18 || signal.field > 0 || signal.coverage > 0;
    return meaningfulSignal && signal.scope > -10;
  });
  const controllingDecisionKeys = new Set(
    eligiblePolicies
      .filter((policy) => policy.specificity_priority > 0 && (signals.get(policy.id)?.lexicalMatched.length || 0) >= 2)
      .map((policy) => policy.decision_key),
  );
  const applicablePolicies = eligiblePolicies.filter(
    (policy) => !policy.blocked_for_decision_keys.some((key) => controllingDecisionKeys.has(key)),
  );
  const ranks = reciprocalRankMaps(applicablePolicies, signals);
  const candidates = applicablePolicies.map((policy) => {
    const signal = signals.get(policy.id)!;
    const rankSources = ranks.get(policy.id) || {};
    const reciprocalRankScore = Object.values(rankSources).reduce((total, rank) => total + 1 / (50 + rank), 0);
    const score = reciprocalRankScore * 100 + signal.family * 2.5 + signal.familyCoverage * 4 + signal.character * 1.5 + signal.field * 2 + signal.coverage * 0.8 + signal.scope + qualityBoost(policy);
    return {
      policy,
      rank: 0,
      score,
      reciprocalRankScore,
      lexicalScore: signal.lexical,
      familyScore: signal.family,
      characterScore: signal.character,
      fieldScore: signal.field,
      scopeScore: signal.scope,
      matchedTerms: [...new Set([...signal.matched, ...signal.lexicalMatched])].slice(0, 16),
      rankSources,
    } satisfies V4Candidate;
  }).sort((left, right) => right.score - left.score || right.policy.authority - left.policy.authority);

  const perDecision = new Map<string, number>();
  const diversifiedByScore = candidates.filter((candidate) => {
    const seen = perDecision.get(candidate.policy.decision_key) || 0;
    if (seen >= 3) return false;
    perDecision.set(candidate.policy.decision_key, seen + 1);
    return true;
  });
  const priority = candidates.filter((candidate) => governedPriorityIds.has(candidate.policy.id));
  const exactFamilyByScore = candidates.filter((candidate) => {
    const signal = signals.get(candidate.policy.id)!;
    return signal.familyMatched.length >= 2 && (signal.familyCoverage >= 0.45 || (signal.familyMatched.length >= 3 && signal.familyCoverage >= 0.34));
  }).sort((left, right) => {
    const leftSignal = signals.get(left.policy.id)!;
    const rightSignal = signals.get(right.policy.id)!;
    return rightSignal.familyCoverage - leftSignal.familyCoverage || rightSignal.familyMatched.length - leftSignal.familyMatched.length || right.score - left.score;
  });
  const exactFamilyPerDecision = new Map<string, number>();
  const exactFamily = exactFamilyByScore.filter((candidate) => {
    const seen = exactFamilyPerDecision.get(candidate.policy.decision_key) || 0;
    if (seen >= 2) return false;
    exactFamilyPerDecision.set(candidate.policy.decision_key, seen + 1);
    return true;
  }).slice(0, 12);
  const included = new Set<string>();
  const diversified = [...priority, ...exactFamily, ...diversifiedByScore]
    .filter((candidate) => {
      if (included.has(candidate.policy.id)) return false;
      included.add(candidate.policy.id);
      return true;
    })
    .slice(0, Math.max(1, Math.min(limit, 60)))
    .map((candidate, index) => ({ ...candidate, rank: index + 1 }));

  const blocked = getV4BlockedTopics().flatMap((topic) => {
    const match = v4BlockedTopicDecisionMatch(topic, query, {
      productScope: turn.productScope,
      excludedScopes: turn.excludedScopes,
    });
    if (!match.matches || match.matchKind === "none") return [];
    return [{
      topic,
      score: match.score,
      matchedTerms: [...match.matchedActions, ...match.matchedDomains, ...match.matchedSubjects],
      matchKind: match.matchKind,
    } satisfies V4BlockedCandidate];
  }).sort((left, right) => right.score - left.score).slice(0, 8);

  return {
    query,
    queryTokens,
    expandedTokens: expanded,
    candidates: diversified,
    blocked,
    corpusSize: corpus.length,
    stageTimings: { retrievalMs: Date.now() - startedAt },
  };
}
