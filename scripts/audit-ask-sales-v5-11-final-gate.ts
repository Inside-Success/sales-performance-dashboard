import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type System = { acceptable: boolean; materialError: boolean; wrongOwner: boolean; falseRoute: boolean; label: string };
type Judgment = { winner: "v3" | "v511" | "tie"; v3: System; v511: System; note: string };
const pass: System = { acceptable: true, materialError: false, wrongOwner: false, falseRoute: false, label: "acceptable" };
const fail = (label: string, options: Partial<System> = {}): System => ({ acceptable: false, materialError: false, wrongOwner: false, falseRoute: false, label, ...options });

const judgments: Record<string, Judgment> = {
  "v511final-01": { winner: "v3", v3: pass, v511: fail("incomplete_false_route", { falseRoute: true }), note: "V3 gives the no-pop-in rule and virtual alternative. V5.11 gives a narrower financial-commitment boundary and routes the rest." },
  "v511final-02": { winner: "tie", v3: pass, v511: pass, note: "Both correctly reject the concerning applicant and keep them out of Zoom." },
  "v511final-03": { winner: "tie", v3: pass, v511: pass, note: "Both correctly update Keap ownership to the rep who booked the 20 percent lead." },
  "v511final-04": { winner: "tie", v3: pass, v511: pass, note: "Both preserve the 20 plus 20 limit." },
  "v511final-05": { winner: "v511", v3: fail("false_finance_route", { falseRoute: true }), v511: pass, note: "V5.11 answers the exact debit-card rule; V3 withholds it." },
  "v511final-06": { winner: "tie", v3: pass, v511: pass, note: "Both give the correct block, opt-out, and Sales Tech actions." },
  "v511final-07": { winner: "v511", v3: { ...pass, label: "acceptable_with_unneeded_route" }, v511: pass, note: "Both contain the controlling proof and Sunday deadline; V5.11 is direct and complete." },
  "v511final-08": { winner: "tie", v3: pass, v511: pass, note: "Both correctly allow personal-calendar hours without touching or overlapping master." },
  "v511final-09": { winner: "tie", v3: pass, v511: pass, note: "Both distinguish a social and Google review from a formal full background check." },
  "v511final-10": { winner: "v511", v3: fail("materially_wrong_approval_boundary", { materialError: true }), v511: pass, note: "V3 says a franchise owner needs no ultimate-owner approval. V5.11 preserves the stricter approval and decision-maker boundary." },
  "v511final-11": { winner: "v511", v3: fail("false_route_wrong_recording_source", { falseRoute: true }), v511: pass, note: "V5.11 distinguishes pass-off and dummy recordings. V3 does not answer the ownership procedure." },
  "v511final-12": { winner: "v511", v3: { ...pass, label: "acceptable_older_rich_route" }, v511: { ...pass, label: "acceptable_newer_madeline_workaround" }, note: "The selected Rich thread says Sales Tech; a later authoritative Madeline record supplies the temporary Legacy Makers plus note workaround. This is a corpus-governance conflict, not a simple gold failure; V5.11 uses the newer actionable rule." },
  "v511final-13": { winner: "tie", v3: pass, v511: pass, note: "Both allow an immediate Call 1 reschedule because no first audition occurred." },
  "v511final-14": { winner: "tie", v3: fail("false_route", { falseRoute: true }), v511: fail("false_route", { falseRoute: true }), note: "Both miss Rich's exact yes for a physical therapist who owns three practices." },
  "v511final-15": { winner: "v511", v3: fail("false_route", { falseRoute: true }), v511: pass, note: "V5.11 correctly recognizes the sensitive recovery story as potentially suitable; V3 withholds it." },
  "v511final-16": { winner: "tie", v3: fail("wrong_action_owner", { wrongOwner: true }), v511: fail("wrong_action_owner", { wrongOwner: true }), note: "Both safely avoid inventing a vendor but send the rep to Sales Questions instead of Fulfillment." },
  "v511final-17": { winner: "v511", v3: fail("materially_wrong_cross_offer_owner", { materialError: true }), v511: fail("false_route", { falseRoute: true }), note: "V3 wrongly says one original rep can sell both offers. V5.11 is safer but misses Rich's first-Call-1 ownership rule." },
  "v511final-18": { winner: "v3", v3: pass, v511: fail("false_route", { falseRoute: true }), note: "V3 answers the American Authors fit; V5.11 withholds it." },
  "v511final-conv-01-turn-1": { winner: "v3", v3: pass, v511: fail("materially_wrong_decision_focus", { materialError: true }), note: "V3 tells the rep to walk through the contract live. V5.11 substitutes the generic payment-first sequence and does not answer the attorney-review decision." },
  "v511final-conv-01-turn-2": { winner: "v3", v3: pass, v511: { ...pass, label: "acceptable_incomplete" }, note: "Both allow emailing the contract PDF; V3 also preserves the required follow-up call." },
  "v511final-conv-02-turn-1": { winner: "tie", v3: pass, v511: pass, note: "Both accurately distinguish Call 1, Call 2, and onboarding." },
  "v511final-conv-02-turn-2": { winner: "tie", v3: pass, v511: pass, note: "Both carry the onboarding referent and identify the studio team after close." },
  "v511final-conv-03-turn-1": { winner: "v511", v3: fail("false_route_incomplete", { falseRoute: true }), v511: pass, note: "V5.11 gives the Facebook-via-ISTV-Instagram and dashboard answer. V3 routes the tracking portion." },
  "v511final-conv-03-turn-2": { winner: "v3", v3: pass, v511: fail("materially_unsafe_timeline_guess", { materialError: true }), note: "V3 gives targeting and withholds the unconfirmed timeline. V5.11 correctly caveats Fulfillment but still presents the source author's few-weeks-to-two-month guess as typical." }
};

type Value = Record<string, unknown>;
const object = (value: unknown): Value => value && typeof value === "object" ? value as Value : {};
const text = (value: unknown) => typeof value === "string" ? value : "";
const flatten = (report: Value) => [
  ...(Array.isArray(report.cases) ? report.cases.map(object) : []),
  ...(Array.isArray(report.conversations) ? report.conversations.map(object).flatMap((conversation) => Array.isArray(conversation.prompts) ? conversation.prompts.map(object) : []) : []),
];

async function main() {
  const primaryPath = path.resolve("artifacts/ask-sales-faq-v5-11-final-gate/primary-runtime.json");
  const repeatPath = path.resolve("artifacts/ask-sales-faq-v5-11-final-gate/repeatability-analysis.json");
  const [primaryRaw, repeatRaw] = await Promise.all([readFile(primaryPath, "utf8"), readFile(repeatPath, "utf8")]);
  const primary = object(JSON.parse(primaryRaw));
  const repeatability = object(JSON.parse(repeatRaw));
  const items = flatten(primary);
  if (items.length !== 24 || items.some((item) => !judgments[text(item.id)])) throw new Error("Manual judgment map must cover all 24 prompts");
  const audited = items.map((item) => ({
    id: text(item.id),
    question: text(item.question),
    goldAnswer: text(item.goldAnswer),
    judgment: judgments[text(item.id)],
  }));
  const count = (system: "v3" | "v511", key: keyof System) => audited.filter((item) => item.judgment[system][key] === true).length;
  const pairwise = { v511Wins: audited.filter((item) => item.judgment.winner === "v511").length, v3Wins: audited.filter((item) => item.judgment.winner === "v3").length, ties: audited.filter((item) => item.judgment.winner === "tie").length };
  const repeat = object(repeatability.aggregate);
  const summary = {
    prompts: 24,
    v3: { acceptable: count("v3", "acceptable"), acceptableRate: count("v3", "acceptable") / 24, materialErrors: count("v3", "materialError"), wrongOwners: count("v3", "wrongOwner"), falseRoutes: count("v3", "falseRoute") },
    v511: { acceptable: count("v511", "acceptable"), acceptableRate: count("v511", "acceptable") / 24, materialErrors: count("v511", "materialError"), wrongOwners: count("v511", "wrongOwner"), falseRoutes: count("v511", "falseRoute") },
    pairwise: { ...pairwise, netWinsOverV3: pairwise.v511Wins - pairwise.v3Wins },
    repeatability: repeat,
  };
  const gates = {
    completeProviderBackedOutputs: true,
    zeroV511MaterialErrors: summary.v511.materialErrors === 0,
    zeroV511WrongActionOwners: summary.v511.wrongOwners === 0,
    minimumV511AcceptableRate85Percent: summary.v511.acceptableRate >= 0.85,
    minimumPairwiseNetWinsPlus3: summary.pairwise.netWinsOverV3 >= 3,
    noMaterialStratumRegression: false,
    maximumLaneOrMaterialDecisionFlipRate5Percent: Number(repeat.laneFlipRate) <= 0.05 && Number(repeat.decisionBoundaryFlipRate) <= 0.05,
    sourceDisjointnessVerified: true,
    productionIsolationVerified: true,
    blindHumanReviewComplete: false,
    explicitOwnerApproval: false,
  };
  const report = {
    schemaVersion: "ask-sales-v5-11-final-gate-manual-audit-v1",
    status: "complete_promotion_gate_failed",
    generatedAt: new Date().toISOString(),
    primaryRuntimeSha256: createHash("sha256").update(primaryRaw).digest("hex"),
    repeatabilitySha256: createHash("sha256").update(repeatRaw).digest("hex"),
    methodology: { sourceOnlyGold: true, directSlackRecheckForDisputes: true, aiJudgePromotionAuthority: false, postOutputRuntimeTuning: false, productionChanged: false },
    summary,
    gates,
    promotionDecision: "do_not_promote_v5_11",
    rootCauses: [
      "Exact authoritative records remain unreachable for some relationship and eligibility questions.",
      "Live-owner routing still lacks a deterministic Fulfillment owner path.",
      "The generic payment-first family can displace an attorney-review decision with a different decision key.",
      "Unconfirmed source-author guesses can survive into otherwise grounded answers.",
      "Studio-tour admission and two follow-up decisions remain non-deterministic above the five-percent gate."
    ],
    corpusConflict: { id: "v511final-12", finding: "A selected Rich route and a later Madeline temporary workaround conflict. V5.11 chose the later actionable record; this item is not counted as a V5.11 material error." },
    items: audited,
  };
  const rows = audited.map((item) => `| ${item.id} | ${item.judgment.winner === "v511" ? "V5.11" : item.judgment.winner === "v3" ? "V3" : "Tie"} | ${item.judgment.v3.label} | ${item.judgment.v511.label} | ${item.judgment.note} |`).join("\n");
  const markdown = `# Ask Sales V5.11 final unseen gate\n\n## Decision\n\n**Do not replace V3 with V5.11 yet.** V5.11 is better on several exact-answer cases, but this source-disjoint gate does not show production readiness.\n\n- V5.11 acceptable: ${summary.v511.acceptable}/24 (${(summary.v511.acceptableRate * 100).toFixed(1)}%)\n- V3 acceptable: ${summary.v3.acceptable}/24 (${(summary.v3.acceptableRate * 100).toFixed(1)}%)\n- Pairwise: V5.11 ${pairwise.v511Wins} wins, V3 ${pairwise.v3Wins} wins, ${pairwise.ties} ties; net ${summary.pairwise.netWinsOverV3 >= 0 ? "+" : ""}${summary.pairwise.netWinsOverV3}\n- V5.11 material errors: ${summary.v511.materialErrors}; wrong owners: ${summary.v511.wrongOwners}; false routes: ${summary.v511.falseRoutes}\n- Repeatability: ${(Number(repeat.laneFlipRate) * 100).toFixed(2)}% lane flips and ${(Number(repeat.decisionBoundaryFlipRate) * 100).toFixed(2)}% decision-boundary flips; both exceed the 5% gate\n- Provider parity: 48/48 primary outputs provider-backed; no terminal failure in the accepted run\n- Production V3: unchanged\n\nThe improvement is real but not sufficient. V5.11 retrieves exact debit-card, recording, sensitive-story, and promotion-view rules that V3 misses. It still fails on an exact physical-therapist rule, cross-offer ownership, Fulfillment routing, attorney-review intent, and an unsafe guessed delivery range.\n\n## Prompt-level audit\n\n| Prompt | Better | V3 | V5.11 | Manual finding |\n| --- | --- | --- | --- | --- |\n${rows}\n`;
  await writeFile(path.resolve("artifacts/ask-sales-faq-v5-11-final-gate/primary-manual-audit.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(path.resolve("artifacts/ask-sales-faq-v5-11-final-gate/V5-11-FINAL-GATE-REPORT.md"), markdown, "utf8");
  console.log(JSON.stringify({ summary, gates, promotionDecision: report.promotionDecision }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
