/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS is embedded in n8n Code nodes and run directly by Node. */
// Deterministic selection from the governed FAQ corpus. No model retrieval pass.
const knowledge=require('../../src/lib/ask-sales-faq/revamp/knowledge-additions.json');
const SOURCE_IDS=[
 'onboarding-value-first-coaching','contract-copy-request-2026-09-18',
 'contract-list-current-source-limits','current-minimum-first-payment-by-product-2026-10-01',
 'main-anniversary-prices-2026-10-01','regular-deposit-no-split-across-days-2026-10-01',
 'regular-lite-video-corrections-2026-10-03','no-small-hold-or-payment-reset-2026-10-05',
 'main-lite-complete-deliverables','main-standard-complete-deliverables',
 'main-package-addons-current-boundary','main-show-versus-tier-deliverables',
 'dj-intro-digital-license','reality-no-cohort-2026-09-18',
 'reality-onboarding-process','reality-call2-video-required',
 'reality-no-returning-client-discount-2026-09-29','reality-guests-and-accommodation-2026-10-03',
 'reality-mini-documentary-production-2026-10-03','reality-housing-by-show-2026-10-12',
 'reality-approval-service-use-2026-10-24','reality-pr-specifics-2026-10-24',
 'reality-custom-contracts-2026-10-24','reality-back-to-back-calls-2026-10-21',
];
const common=`Policy snapshot reviewed October 29, 2026. Source review dates are not automatic effective dates. The future recommendation must respect current rules; historical conduct is judged only against rules shown to apply then. Unknown details remain unknown. Do not automatically use current promotions to criticise old calls.
Mike/Rich review corrections (10-report review document 1hKsoaMHix0gvcUOhTwSRegGcp1d20_my5YVBX_vee3o): no custom contract changes; no payment plans displayed on screen; recommend the relevant licence based on discovery instead of presenting all three. Reality has no documentary cohort deadline. Do not extend a show-specific price, schedule, benefit or exception to another family.
Call 2 script 1kKDjGpCWrVAaLh6cKTSZKJ_YZEqtczHUcpuYFTAt3jo: use the suitable licence video, build on Green Light/story/goals, make an appropriate commitment ask, allow the prospect to respond, handle concerns and confirm actual payment/next steps. Old numerical examples in this script do not override current approved commercial sources. This is a method, not a verbatim sequence or universal checklist. Do not require a new value bridge before every scripted ask.
No recommendation of guaranteed leads, revenue, ROI, fame, exact screen time, unconfirmed distribution, celebrity access, artificial scarcity or invented deadlines. Do not encourage borrowing, financial distress or pressure after an informed refusal. Terms advice must stay within the identified product and agreement. If the specific permitted payment arrangement is not established, use generic wording about applicable approved options without inventing numbers.`;
const liveReality=`October 29 direct read: Reality FAQ 1flX8PyJiZQYiOrItCfvcRVNpCQM2-FchSLhf2UpvAJU and Reality Shows Packages 1piWUsDLE4ON9kaHybWoXy3xGWu1PsqoeMBNYn4zz38Y currently both list Standard $20,000 including an approximately 20-minute on-set personal mini-documentary/interview. This is not the separate full studio documentary package. VIP $30,000 adds benefits including conditional early-elimination immunity for episode 2 (not a win or whole-season guarantee), additional social assets and a five-minute producer interview. Guest access is production/show-specific; guests spectate, not cast participation or unlimited on-set access. Do not promise celebrity access unconditionally.
Most filming is approximately 7–14 consecutive days, with dates/location set by production. Published example calendars are explicitly approximate and not booking guarantees. No regular documentary cohort deadline or regular documentary onboarding call. Use the reality welcome/production handoff. 100,000 views refers to the individual promotional trailer, not episode viewers, customers or revenue. Named third-party platforms are not guaranteed without the specific agreement. Payment may be in full or approved 2/3/4-payment arrangements; balance is due before filming. Refund/transfer terms depend on the actual agreement and scoped approved guidance. Do not invent unused-service refunds or custom terms.`;
const liveDj=`October 29 direct read: Contract Automation List MC, Daymond John's Next Level CEO tab, lists Lite $10,000, Standard $15,000 and VIP $20,000 plus specific instalment links. It also contains separately labelled discounted $8,000/$12,000/$16,000 links. Their existence does NOT establish universal discount eligibility. Do not prescribe a discount without applicable authorization. This family has its own contract/payment links and benefits; never import main ISTV anniversary or reality terms. Use the selected applicable product plan, not a universal $2,500 minimum or custom schedule.`;
function policyPack(){
 // One stable cached reference includes all families: headers can be stale and
 // calls can switch offers. The existing writer/reviewer identify applicability.
 const selected=SOURCE_IDS.map(id=>{const r=knowledge.find(r=>r.id===id);if(!r)throw Error('Missing governed policy '+id);return r;});
 return common+'\n\nOFFER APPLICABILITY: Treat metadata and transcript headers as hints, not proof. Identify the offer actually being discussed from the complete conversation. A reality package may include a mini-documentary; that alone is not a separate main documentary sale. When multiple separate offers are actually discussed, use mixed and keep each term attached to its own offer. Never use a passing comparison to select another offer. If identity remains unclear, omit specific commercial recommendations.\n\nREALITY ONLY:\n'+liveReality+'\n\nNEXT LEVEL CEO ONLY:\n'+liveDj+'\n\nSCOPED GOVERNED RULES (apply only the listed scopes; shared applies across families):\n'+selected.map(r=>'SCOPE: '+r.scopes.join(', ')+'\n'+r.title+'\n'+r.text+'\nSources: '+r.sourceIds.join(' | ')+'\nReviewed: '+r.reviewedAt).join('\n\n');
}
module.exports={policyPack,SOURCE_IDS,common,liveReality,liveDj};
