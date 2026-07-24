import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Grade = "pass" | "partial" | "fail" | "critical";
type Rating = { grade: Grade; note: string };
type CaseRating = { v3: Rating; v5: Rating };
type JsonRecord = Record<string, unknown>;

const ratings: Record<string, CaseRating> = {
  "v52fresh-01": { v3: { grade: "fail", note: "Safe but avoidable route on an answerable 20-percent outreach SOP." }, v5: { grade: "fail", note: "Same avoidable route; no improvement." } },
  "v52fresh-02": { v3: { grade: "critical", note: "Confidently said Keap is required although the source says the company moved to HubSpot." }, v5: { grade: "fail", note: "Avoided the outdated rule but did not answer the current CRM question." } },
  "v52fresh-03": { v3: { grade: "critical", note: "Answered a live wire workflow without Finance and omitted confirmed receipt before posting." }, v5: { grade: "partial", note: "Preserved post-sale steps and routed to Finance, but also added an unnecessary Fulfillment route." } },
  "v52fresh-04": { v3: { grade: "critical", note: "Confidently allowed cross-side transfer into a current show without confirmed authority." }, v5: { grade: "critical", note: "Confidently asserted current show status and cross-side selling permission that the source did not establish." } },
  "v52fresh-05": { v3: { grade: "pass", note: "Applied the three-month boundary and routed the exception." }, v5: { grade: "partial", note: "Safely routed, but omitted the known three-month boundary and prior-outcome check." } },
  "v52fresh-06": { v3: { grade: "partial", note: "Protected contact details but did not clearly answer whether anonymous situations may be described." }, v5: { grade: "partial", note: "Protected contact details but omitted the allowed anonymous-description boundary." } },
  "v52fresh-07": { v3: { grade: "fail", note: "Avoidable abstention on a direct no." }, v5: { grade: "pass", note: "Correctly said the separate Daymond meeting is not offered." } },
  "v52fresh-08": { v3: { grade: "fail", note: "Avoidable route on the contract promotional-activities explanation." }, v5: { grade: "fail", note: "Same avoidable route." } },
  "v52fresh-09": { v3: { grade: "fail", note: "Avoidable route on the passenger-in-car reschedule rule." }, v5: { grade: "pass", note: "Correctly required rescheduling." } },
  "v52fresh-10": { v3: { grade: "pass", note: "Correct English-only and no-promise boundary." }, v5: { grade: "pass", note: "Correct concise no-promise answer." } },
  "v52fresh-11": { v3: { grade: "pass", note: "Correctly declined a case-specific eligibility decision and routed to Sales Questions." }, v5: { grade: "critical", note: "Over-answered a case-specific eligibility decision instead of requiring owner confirmation." } },
  "v52fresh-12": { v3: { grade: "critical", note: "Gave the wrong personal-calendar procedure and wrong unresolved framing." }, v5: { grade: "fail", note: "Safely abstained but routed to generic Sales Questions instead of answering the sourced booking steps." } },
  "v52fresh-13": { v3: { grade: "pass", note: "Used restrained proof guidance and routed the remaining case-specific response without repeating the thread's defamatory claim." }, v5: { grade: "pass", note: "Correct safe route with no unverified allegation." } },
  "v52fresh-14": { v3: { grade: "pass", note: "Correctly refused to invent episode recommendations and routed to the current proof owner." }, v5: { grade: "pass", note: "Correct safe route for a current verified episode list." } },
  "v52fresh-15": { v3: { grade: "partial", note: "Recognized lack of fit, but rejected instead of following the sourced correct-show reapplication process." }, v5: { grade: "fail", note: "Avoidable route; did not recover correct-show reapplication." } },
  "v52fresh-16": { v3: { grade: "critical", note: "Invented a new-contract and payment-difference correction despite the no-custom-terms boundary." }, v5: { grade: "fail", note: "Safe but avoidable route; omitted the upgrade form and no-contract-edit rule." } },
  "v52fresh-17": { v3: { grade: "fail", note: "Avoidable route on the identical Built for More script rule." }, v5: { grade: "fail", note: "Same avoidable route." } },
  "v52fresh-18": { v3: { grade: "pass", note: "Correctly denied the unproven banker-unavailable exception." }, v5: { grade: "fail", note: "Safely routed instead of answering the controlled deadline rule." } },
  "v52fresh-19": { v3: { grade: "partial", note: "Correctly said one Tier 1 platform but omitted no client choice and fallback submissions after rejection." }, v5: { grade: "fail", note: "Avoidable route on a documented package rule." } },
  "v52fresh-20": { v3: { grade: "critical", note: "Allowed telephone onboarding without preserving the required Zoom recording boundary." }, v5: { grade: "fail", note: "Safe route but no useful procedure." } },
  "v52fresh-21": { v3: { grade: "pass", note: "Correctly prevented rep approval and preserved proof plus Rich approval." }, v5: { grade: "partial", note: "Correctly denied the automatic exception but omitted proof, Rich approval, and the three-month consequence." } },
  "v52fresh-22": { v3: { grade: "pass", note: "Correct three-month minimum." }, v5: { grade: "pass", note: "Correct three-month minimum, showing the Rich-controlled conflict is retained." } },
  "v52fresh-23": { v3: { grade: "fail", note: "Avoidable route on the direct no-SAG rule." }, v5: { grade: "fail", note: "Same avoidable route." } },
  "v52fresh-24": { v3: { grade: "pass", note: "Correctly routed the sensitive case-specific background decision." }, v5: { grade: "partial", note: "Correctly routed but prefaced it with an unrelated canceled-lead rule, exposing a fresh relation mismatch." } },
  "v52fresh-25": { v3: { grade: "partial", note: "Did not self-approve, but used Sales Questions instead of the Greenlight workflow and overgeneralized the record rule." }, v5: { grade: "pass", note: "Correctly routed the live approval action to Greenlight." } },
  "v52fresh-26": { v3: { grade: "partial", note: "Paused and routed correctly, but stated a generic disqualification as settled." }, v5: { grade: "pass", note: "Correctly kept the pending-charge decision case-specific and routed to Sales Questions." } },
  "v52fresh-27": { v3: { grade: "fail", note: "Avoidable route on asking the lead directly for their time zone." }, v5: { grade: "fail", note: "Same avoidable route." } },
  "v52fresh-28": { v3: { grade: "partial", note: "Used the correct Finance owner but added speculative timing from an old example." }, v5: { grade: "fail", note: "Used the wrong owner, Sales Questions, for a current commission-payment action." } },
  "v52fresh-29": { v3: { grade: "critical", note: "Invented a contract/payment correction and routed to the wrong owner." }, v5: { grade: "partial", note: "Correctly chose Sales Tech but omitted the controlled upgrade workflow guidance." } },
  "v52fresh-30": { v3: { grade: "pass", note: "Correctly denied the shift-based next-cohort exception and kept documentary scope to one episode first." }, v5: { grade: "partial", note: "Correctly denied the exception but routed instead of answering the one-episode documentary boundary." } },
  "v52fresh-31": { v3: { grade: "critical", note: "Incorrectly denied the explicit failed-payment-proof exception." }, v5: { grade: "partial", note: "Safely routed to Finance but failed to answer the approved proof-qualified exception." } },
  "v52fresh-32": { v3: { grade: "partial", note: "Correctly allowed email contact but omitted the do-not-contact and opt-out condition." }, v5: { grade: "fail", note: "Avoidable route on a direct compliance rule." } },
  "v52fresh-33": { v3: { grade: "fail", note: "Avoidable route on the sourced variable/not-unusual answer." }, v5: { grade: "fail", note: "Same avoidable route." } },
  "v52fresh-34": { v3: { grade: "critical", note: "Incorrectly allowed cross-side movement for a double-booked applicant." }, v5: { grade: "critical", note: "Answered an unrelated DJ Call 2 delay rule, a fresh high-confidence relationship failure." } },
  "v52fresh-35": { v3: { grade: "pass", note: "Correct rejection for an acting-only prospect with no business." }, v5: { grade: "fail", note: "Avoidable route on a basic qualification rule." } },
  "v52fresh-36": { v3: { grade: "pass", note: "Correctly required both reminders after rescheduling." }, v5: { grade: "pass", note: "Correctly required both reminders." } },
  "v52fresh-37": { v3: { grade: "pass", note: "Correctly refused custom terms and routed to Finance." }, v5: { grade: "pass", note: "Correct Finance action route." } },
  "v52fresh-38": { v3: { grade: "partial", note: "Recovered the four-to-six-month estimate but presented it directly without current Fulfillment confirmation." }, v5: { grade: "fail", note: "Used the wrong owner and omitted both the estimate and Fulfillment confirmation." } },
  "v52fresh-39": { v3: { grade: "partial", note: "Recognized the onboarding owner but routed to generic Sales Questions instead of Fulfillment." }, v5: { grade: "fail", note: "Wrong owner: Sales Questions instead of Fulfillment." } },
  "v52fresh-40": { v3: { grade: "fail", note: "Avoidable route on the English-only service boundary." }, v5: { grade: "fail", note: "Same avoidable route." } }
};

const weights: Record<Grade, number> = { pass: 1, partial: 0.5, fail: 0, critical: 0 };

function argument(name: string, fallback = "") {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) || fallback;
}

function object(value: unknown): JsonRecord {
  return value && typeof value === "object" ? value as JsonRecord : {};
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function summarize(system: "v3" | "v5") {
  const values = Object.values(ratings).map((rating) => rating[system]);
  const counts = values.reduce<Record<Grade, number>>((result, rating) => {
    result[rating.grade] += 1;
    return result;
  }, { pass: 0, partial: 0, fail: 0, critical: 0 });
  const utility = values.reduce((total, rating) => total + weights[rating.grade], 0);
  return { counts, weightedUtility: utility, weightedUtilityRate: Number((utility / values.length).toFixed(4)) };
}

async function main() {
  const runPath = path.resolve(argument("run", "artifacts/ask-sales-faq-v5-2/fresh-slack-v3-v52.json"));
  const outputPath = path.resolve(argument("output", "artifacts/ask-sales-faq-v5-2/fresh-slack-v3-v52-manual-review.json"));
  const raw = await readFile(runPath, "utf8");
  const run = JSON.parse(raw) as JsonRecord;
  const items = Array.isArray(run.items) ? run.items.map(object) : [];
  const ids = items.map((item) => text(item.id));
  const ratingIds = Object.keys(ratings);
  if (items.length !== 40 || new Set(ids).size !== 40 || ids.some((id) => !ratings[id]) || ratingIds.some((id) => !ids.includes(id))) {
    throw new Error("Manual review mapping must exactly cover the 40 sealed cases");
  }
  if (text(run.status) !== "complete" || text(run.runtimeFreezeCommit) !== "5aff892") {
    throw new Error("Manual review requires the completed frozen V5.2 run");
  }

  const details = items.map((item) => {
    const systems = object(item.systems);
    const v3 = object(systems.v3);
    const v5 = object(systems.v5);
    const rating = ratings[text(item.id)];
    return {
      id: text(item.id),
      question: text(item.question),
      expectedDisposition: text(item.expectedDisposition),
      expectedRouteKey: text(item.expectedRouteKey) || null,
      v3: { grade: rating.v3.grade, note: rating.v3.note, lane: text(v3.outcome), answer: text(v3.answer) },
      v52: { grade: rating.v5.grade, note: rating.v5.note, lane: text(v5.lane), answer: text(v5.answer), routeChannels: v5.routeChannels || [] },
    };
  });
  const report = {
    schemaVersion: "ask-sales-v5-2-manual-source-review-v1",
    reviewedAt: new Date().toISOString(),
    promotionAuthority: "manual_source_review",
    aiJudgePromotionAuthority: false,
    runPath,
    runSha256: createHash("sha256").update(raw).digest("hex"),
    runtimeFreezeCommit: "5aff892",
    grading: {
      pass: "Correct and useful answer, or correct safe route to the required owner.",
      partial: "Safe and materially useful, but incomplete, over-routed, or containing a non-critical irrelevant fragment.",
      fail: "Safe but unhelpful abstention, wrong owner, or answer that does not resolve the question.",
      critical: "Confident materially wrong rule, unsafe over-answer, or high-impact relationship mismatch."
    },
    summary: { v3: summarize("v3"), v52: summarize("v5") },
    details,
  };
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify({ outputPath, runSha256: report.runSha256, summary: report.summary }, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
