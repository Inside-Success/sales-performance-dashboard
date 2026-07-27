import { createHash } from "node:crypto";

import type { V4SystemicPolicy } from "@/lib/ask-sales-faq/v4/systemic/types";
import { getV511KnowledgeVersion, getV511OperationalPolicyCount } from "@/lib/ask-sales-faq/v5-11/knowledge";

type ReviewedPolicyInput = {
  id: string;
  decisionKey: string;
  title: string;
  questions: string[];
  decision: string;
  scopes?: V4SystemicPolicy["product_scopes"];
  domains: string[];
  actions: string[];
  entities: string[];
  sourceIds: string[];
  approvedBy: string[];
  searchText: string;
  effectiveAt: string;
  routeKey?: V4SystemicPolicy["route_key"];
};

function reviewedPolicy(input: ReviewedPolicyInput): V4SystemicPolicy {
  return {
    id: input.id,
    decision_key: input.decisionKey,
    policy_key: input.id,
    title: input.title,
    question_families: input.questions,
    decision: input.decision,
    product_scopes: input.scopes || ["unknown"],
    domains: input.domains,
    actions: input.actions,
    entities: input.entities,
    risk_level: "high",
    answerability: "answer_evidence",
    quality_tier: "trusted_evidence",
    quality_flags: ["source_reviewed_correction", "isolated_v512", "complete_conditional_rule"],
    route_key: input.routeKey || null,
    route_channel: null,
    route_reason: "",
    authority: 9.9,
    effective_at: input.effectiveAt,
    last_reviewed: "2026-07-27",
    source: {
      kind: "owner_confirmed_isolated_overlay",
      article_id: null,
      ids: [...input.sourceIds, `source-review:2026-07-27:${input.decisionKey}`],
      approved_by: input.approvedBy,
    },
    search_text: input.searchText,
    specificity_priority: 150,
    blocked_for_decision_keys: [],
    systemic: {
      temporalRisk: "stable",
      scopeRisk: "scoped",
      sourceClass: "authoritative_operational_qna",
      ownerReviewRequired: false,
      sourceIds: [...input.sourceIds, `source-review:2026-07-27:${input.decisionKey}`],
    },
  };
}

/**
 * These records repair already-revealed V5.11 failures and are regression
 * evidence only. They normalize the controlling decision into a standalone
 * answer so a bare source reply such as "yes" cannot be copied with the wrong
 * polarity when the user's question is phrased differently.
 */
export const V512_SOURCE_REVIEWED_POLICIES: readonly V4SystemicPolicy[] = Object.freeze([
  reviewedPolicy({
    id: "v512src-studio-visit-virtual-walkthrough",
    decisionKey: "prospect-studio-visit-and-virtual-walkthrough",
    title: "Prospect studio visit and approved virtual alternative",
    questions: [
      "May a prospect visit or tour the studio before deciding or filming?",
      "What should a rep offer instead of an informal studio pop-in?",
    ],
    decision: "No. Do not arrange an unplanned studio visit or in-person tour for a prospect before their filming date. Send the approved virtual studio walkthrough instead.",
    scopes: ["main_istv"],
    domains: ["studio access", "prospect proof", "virtual walkthrough"],
    actions: ["decline studio visit", "share virtual walkthrough"],
    entities: ["prospect", "Miami studio", "virtual studio walkthrough"],
    sourceIds: ["slack:C0AUQKNR8CF:1783618660.735119"],
    approvedBy: ["Madeline"],
    searchText: "prospect informal pop in stop by visit tour Miami studio before deciding signing filming approved virtual walkthrough instead",
    effectiveAt: "2026-07-08T00:00:00+05:00",
  }),
  reviewedPolicy({
    id: "v512src-call1-no-audition-no-wait",
    decisionKey: "call1-no-show-before-audition-reschedule",
    title: "Call 1 no-show before the first audition",
    questions: [
      "Must someone who no-showed Call 1 without completing the audition wait before rescheduling?",
      "Can a first audition that never happened be rescheduled the following week?",
    ],
    decision: "No. If the first audition was never conducted, the prospect does not have to wait 90 days and may reschedule the Call 1 for the following week.",
    domains: ["Call 1", "no-show", "rescheduling"],
    actions: ["reschedule Call 1"],
    entities: ["prospect", "first audition", "90-day wait"],
    sourceIds: ["slack:C0AUQKNR8CF:1780936358.795779"],
    approvedBy: ["Rich"],
    searchText: "Call 1 no show first audition never conducted reschedule following next week no 90 day wait",
    effectiveAt: "2026-06-08T00:00:00+05:00",
  }),
  reviewedPolicy({
    id: "v512src-physical-therapist-three-practices",
    decisionKey: "best-doctors-physical-therapist-three-practices",
    title: "Physical therapist who owns three practices",
    questions: [
      "Does a physical therapist who owns three practices qualify for America's Best Doctors?",
      "Can a physiotherapist with three owned practices be considered for the doctors show?",
    ],
    decision: "Yes. A physical therapist who owns three practices can qualify for America's Best Doctors. This does not guarantee final acceptance or establish a blanket rule for other physical therapists.",
    scopes: ["main_istv"],
    domains: ["eligibility", "America's Best Doctors"],
    actions: ["assess show fit"],
    entities: ["physical therapist", "three practices", "America's Best Doctors"],
    sourceIds: ["slack:C0AUQKNR8CF:1778765168.125759"],
    approvedBy: ["Rich"],
    searchText: "physical therapist physiotherapist owns three 3 practices qualifies America's Best Doctors eligibility",
    effectiveAt: "2026-05-14T00:00:00+05:00",
  }),
  reviewedPolicy({
    id: "v512src-cross-offer-first-call-owner",
    decisionKey: "cross-offer-first-call1-owner-and-selling-boundary",
    title: "Lead ownership across ISTV and Daymond John offers",
    questions: [
      "Which rep continues when separate ISTV and DJ reps both completed Call 1?",
      "May a non-DJ rep sell the Daymond John offer?",
    ],
    decision: "The rep who conducted the first Call 1 or held the first booking should continue, and the second rep should cancel. A non-DJ rep must not sell the Daymond John offer, and the same offer-authorization boundary applies in reverse.",
    scopes: ["comparison"],
    domains: ["lead ownership", "cross-offer authorization"],
    actions: ["continue lead", "cancel duplicate booking"],
    entities: ["ISTV rep", "Daymond John rep", "Call 1", "prospect"],
    sourceIds: ["slack:C0AUQKNR8CF:1782767217.475259"],
    approvedBy: ["Rich"],
    searchText: "prospect booked completed Call 1 both ISTV Daymond John DJ different reps first booking first Call 1 continues second cancels non DJ cannot sell DJ",
    effectiveAt: "2026-06-29T00:00:00+05:00",
  }),
  reviewedPolicy({
    id: "v512src-americas-authors-paid-collaboration-fit",
    decisionKey: "americas-authors-paid-book-collaboration-fit",
    title: "Paid book-collaboration organizer fit for America's Authors",
    questions: [
      "Can someone who runs paid book collaborations qualify for America's Authors?",
      "Can a full-time employee with a real paid author business be a fit for America's Authors?",
    ],
    decision: "Yes. Someone who runs legitimate paid book collaborations and wants to expand beyond their region can be a fit for America's Authors, and may also benefit from networking at the Mastermind event. Continue the normal fit and greenlight process.",
    scopes: ["main_istv"],
    domains: ["eligibility", "America's Authors"],
    actions: ["assess show fit"],
    entities: ["author", "paid book collaborations", "America's Authors"],
    sourceIds: ["slack:C0AUQKNR8CF:1781805618.036689"],
    approvedBy: ["Rich"],
    searchText: "America's Authors fit full time works paid book collaborations expand region mastermind networking",
    effectiveAt: "2026-06-18T00:00:00+05:00",
  }),
  reviewedPolicy({
    id: "v512src-attorney-contract-review-sequence",
    decisionKey: "attorney-contract-review-live-walkthrough-and-fallback",
    title: "Attorney contract-review handling",
    questions: [
      "What should a rep do when a prospect wants an attorney to review the contract?",
      "May the approved contract PDF be sent when the prospect still insists on legal review?",
    ],
    decision: "First walk the prospect through the contract and resolve their questions live on the call. If they still insist on attorney review, send the approved contract PDF only as a last resort and schedule another call to continue the close. Do not infer that contract amendments are allowed.",
    domains: ["contract", "attorney review", "closing process"],
    actions: ["review contract live", "send approved contract PDF", "schedule follow-up call"],
    entities: ["prospect", "attorney", "contract PDF"],
    sourceIds: ["slack:C0AUQKNR8CF:1781724244.202269"],
    approvedBy: ["Rich"],
    searchText: "prospect attorney lawyer legal review contract agreement first walk through live call last resort send approved PDF schedule another follow up close",
    effectiveAt: "2026-06-17T00:00:00+05:00",
  }),
  reviewedPolicy({
    id: "v512src-payment-link-debit-card",
    decisionKey: "payment-link-debit-card-acceptance",
    title: "Debit-card acceptance through the credit-card payment link",
    questions: ["Can a client use a debit card through the credit-card payment link?"],
    decision: "Yes. The credit-card payment link also accepts a debit card.",
    domains: ["payment method", "payment link"],
    actions: ["accept debit-card payment"],
    entities: ["client", "debit card", "credit-card payment link"],
    sourceIds: ["slack:C0AUQKNR8CF:1780685756.920789"],
    approvedBy: ["Rich"],
    searchText: "client debit card credit card payment link accepts use allowed",
    effectiveAt: "2026-06-05T00:00:00+05:00",
  }),
  reviewedPolicy({
    id: "v512src-franchise-brand-approval",
    decisionKey: "franchise-owner-ultimate-brand-decision-maker-approval",
    title: "Franchise owner and ultimate brand approval",
    questions: ["Can a franchise owner proceed, or do they need approval from the ultimate brand decision-maker?"],
    decision: "A franchise owner can proceed, but they will probably need approval from the brand or ultimate decision-maker. Do not present the franchise owner's authority as automatically sufficient for the brand.",
    domains: ["franchise", "decision authority", "approval"],
    actions: ["assess decision authority"],
    entities: ["franchise owner", "brand", "ultimate decision-maker"],
    sourceIds: ["slack:C0AUQKNR8CF:1779383301.155399"],
    approvedBy: ["Rich"],
    searchText: "franchise owner franchisee proceed brand ultimate original decision maker approval authority",
    effectiveAt: "2026-05-21T00:00:00+05:00",
  }),
  reviewedPolicy({
    id: "v512src-passoff-recording-owner",
    decisionKey: "passoff-and-dummy-call-recording-location",
    title: "Recording ownership for pass-off and dummy calls",
    questions: ["Where should a rep get the recording for a pass-off call?"],
    decision: "For a pass-off call, ask the rep who originally owned the call to DM you the recording. Dummy-channel recordings are available in that channel.",
    domains: ["call recording", "pass-off process", "greenlight evidence"],
    actions: ["obtain call recording"],
    entities: ["pass-off call", "original rep", "dummy channel", "recording"],
    sourceIds: ["slack:C0AUQKNR8CF:1778016992.576449"],
    approvedBy: ["Rich"],
    searchText: "pass off call recording original rep owner DM dummy channel greenlight review where get",
    effectiveAt: "2026-05-05T00:00:00+05:00",
  }),
  reviewedPolicy({
    id: "v512src-missing-show-disposition-sales-tech",
    decisionKey: "missing-show-disposition-current-owner",
    title: "Missing show option in the Keap disposition form",
    questions: ["What should a rep do when Keap does not list the show in the disposition form?"],
    decision: "Do not guess the show or select Legacy Makers as a workaround. Report the missing show option in Sales Tech so the disposition form can be corrected.",
    domains: ["Keap", "lead disposition", "Sales Tech"],
    actions: ["report missing show option"],
    entities: ["rep", "Keap disposition form", "show", "Sales Tech"],
    sourceIds: ["slack:C0AUQKNR8CF:1781559513.875619"],
    approvedBy: ["Rich"],
    searchText: "Keap disposition form show missing not listed dropdown Legacy Makers do not guess report Sales Tech",
    effectiveAt: "2026-06-15T21:38:33.875Z",
    routeKey: "sales_tech",
  }),
  reviewedPolicy({
    id: "v512src-promotion-delivery-tracking",
    decisionKey: "promotion-view-delivery-and-tracking",
    title: "Promotional-view delivery and tracking method",
    questions: ["How are the guaranteed promotional views delivered and tracked?"],
    decision: "The guaranteed promotional views are delivered through a Facebook ad run from the official ISTV Instagram page, and the client receives dashboard access to track the campaign.",
    domains: ["promotion", "ad delivery", "campaign tracking"],
    actions: ["describe delivery", "describe tracking"],
    entities: ["Facebook ad", "official ISTV Instagram page", "client dashboard"],
    sourceIds: ["slack:C0AUQKNR8CF:1783083637.578129"],
    approvedBy: ["Madeline", "Rich"],
    searchText: "100000 guaranteed promotional views delivered Facebook ad official ISTV Instagram dashboard access track campaign",
    effectiveAt: "2026-07-03T00:00:00+05:00",
  }),
  reviewedPolicy({
    id: "v512src-background-review-description",
    decisionKey: "background-review-not-formal-full-check",
    title: "How reps should describe the background review",
    questions: ["Should a rep describe ISTV's screening as a formal full background check?"],
    decision: "No. Describe it as a background review using social profiles, Google searches, and similar checks, not as a formal full background check.",
    domains: ["background review", "approved claims"],
    actions: ["describe screening accurately"],
    entities: ["prospect", "social profiles", "Google searches", "background review"],
    sourceIds: ["slack:C0AUQKNR8CF:1780345948.508129"],
    approvedBy: ["Rich"],
    searchText: "background review social profiles Google searches not formal full background check prospect approval",
    effectiveAt: "2026-06-01T00:00:00+05:00",
  }),
  reviewedPolicy({
    id: "v512src-promotion-targeting",
    decisionKey: "promotion-audience-targeting-from-creative-and-location",
    title: "Promotion audience targeting",
    questions: [
      "Can the client choose the audience for the guaranteed promotional views?",
      "How is the promotional audience configured?",
    ],
    decision: "The audience is configured from the ad copy, creative text, and relevant business location. Do not promise that the client can manually choose demographics unless Fulfillment confirms a current option.",
    domains: ["promotion", "ad targeting"],
    actions: ["describe audience targeting"],
    entities: ["client", "ad copy", "creative", "location", "audience"],
    sourceIds: ["slack:C0AUQKNR8CF:1783083637.578129"],
    approvedBy: ["Madeline", "Rich"],
    searchText: "guaranteed promotional views client choose audience targeting ad copy creative graphics text keywords business location demographics",
    effectiveAt: "2026-07-03T00:00:00+05:00",
  }),
  reviewedPolicy({
    id: "v512src-promotion-timeline-fulfillment",
    decisionKey: "promotion-view-target-timeline-fulfillment-boundary",
    title: "Promotion view-target delivery timeline boundary",
    questions: [
      "How long does it take to reach the guaranteed promotional view target?",
      "May a rep promise a delivery range for promotional views?",
    ],
    decision: "Do not promise a delivery timeline for reaching the promotional view target. The current timing is a post-sale Fulfillment question and must be confirmed there.",
    domains: ["promotion", "delivery timeline", "post-sale"],
    actions: ["withhold timeline promise", "route timing confirmation"],
    entities: ["promotional views", "view target", "Fulfillment"],
    sourceIds: ["slack:C0AUQKNR8CF:1783083637.578129"],
    approvedBy: ["Madeline", "Rich"],
    searchText: "how long time timeline reach guaranteed promotion promotional 100000 view target do not promise post sale Fulfillment confirm",
    effectiveAt: "2026-07-03T00:00:00+05:00",
    routeKey: "fulfillment",
  }),
]);

export function getV512KnowledgeVersion() {
  const input = `${getV511KnowledgeVersion()}+v512_answer_fidelity_and_owner_routing_r1`;
  return `ask-sales-v512-${createHash("sha256").update(input).digest("hex").slice(0, 24)}`;
}

export function getV512OperationalPolicyCount() {
  return getV511OperationalPolicyCount() + V512_SOURCE_REVIEWED_POLICIES.length;
}
