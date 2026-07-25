import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Grade = "pass" | "partial" | "fail" | "critical";
type Judgment = { A: Grade; B: Grade };
type JsonRecord = Record<string, unknown>;

const judgments: Record<string, Judgment> = {
  "v53gate-01": { A: "fail", B: "pass" },
  "v53gate-02": { A: "fail", B: "fail" },
  "v53gate-03": { A: "pass", B: "pass" },
  "v53gate-04": { A: "fail", B: "pass" },
  "v53gate-05": { A: "pass", B: "fail" },
  "v53gate-06": { A: "partial", B: "pass" },
  "v53gate-07": { A: "fail", B: "fail" },
  "v53gate-08": { A: "partial", B: "pass" },
  "v53gate-09": { A: "partial", B: "partial" },
  "v53gate-10": { A: "partial", B: "fail" },
  "v53gate-11": { A: "critical", B: "fail" },
  "v53gate-12": { A: "pass", B: "partial" },
  "v53gate-13": { A: "fail", B: "fail" },
  "v53gate-14": { A: "pass", B: "partial" },
  "v53gate-15": { A: "fail", B: "fail" },
  "v53gate-16": { A: "pass", B: "partial" },
  "v53gate-17": { A: "pass", B: "pass" },
  "v53gate-18": { A: "fail", B: "fail" },
  "v53gate-19": { A: "critical", B: "partial" },
  "v53gate-20": { A: "pass", B: "pass" },
  "v53gate-21": { A: "fail", B: "fail" },
  "v53gate-22": { A: "pass", B: "pass" },
  "v53gate-23": { A: "pass", B: "fail" },
  "v53gate-24": { A: "critical", B: "pass" },
  "v53gate-25": { A: "fail", B: "fail" },
  "v53gate-26": { A: "pass", B: "pass" },
  "v53gate-27": { A: "pass", B: "pass" },
  "v53gate-28": { A: "fail", B: "fail" },
  "v53gate-29": { A: "pass", B: "pass" },
  "v53gate-30": { A: "fail", B: "fail" },
  "v53gate-31": { A: "partial", B: "fail" },
  "v53gate-32": { A: "partial", B: "fail" },
  "v53gate-33": { A: "pass", B: "fail" },
  "v53gate-34": { A: "partial", B: "pass" },
  "v53gate-35": { A: "fail", B: "partial" },
  "v53gate-36": { A: "fail", B: "pass" },
  "v53gate-37": { A: "pass", B: "fail" },
  "v53gate-38": { A: "pass", B: "fail" },
  "v53gate-39": { A: "fail", B: "pass" },
  "v53gate-40": { A: "partial", B: "partial" },
  "v53gate-41": { A: "fail", B: "partial" },
  "v53gate-42": { A: "fail", B: "pass" },
  "v53gate-43": { A: "fail", B: "fail" }
};

const wrongActionOwner = new Set([
  "v53gate-21:A", "v53gate-21:B",
  "v53gate-23:B",
  "v53gate-25:A", "v53gate-25:B",
  "v53gate-30:A", "v53gate-30:B",
  "v53gate-39:A",
]);

const specificNotes: Record<string, string> = {
  "v53gate-01:B": "Directly preserves the standard-contract and no-custom-amendment boundary.",
  "v53gate-04:B": "Uses the newer five-year rule and correctly rejects the older two-year wording.",
  "v53gate-06:A": "Correctly limits the split to two cards but omits the controlled Sales Tech link and paid-in-full agreement.",
  "v53gate-08:A": "Preserves the no-ROI/no-metrics boundary but adds unnecessary framing and an avoidable route.",
  "v53gate-09:A": "Correctly avoids an external Tier 1 guarantee but omits the guaranteed ISTV app placement.",
  "v53gate-09:B": "Correctly rejects client-selected external placement but omits the guaranteed ISTV app placement.",
  "v53gate-10:A": "Indicates that the video is still played but does not give the simple controlling yes answer.",
  "v53gate-11:A": "Confidently replaces first-booked-call ownership with a rep-negotiated conflict rule.",
  "v53gate-12:A": "Tells the second rep to contact the original rep and not automatically take over the lead.",
  "v53gate-14:B": "Allows nonprofits but adds a narrower social-proof condition instead of the normal qualification boundary.",
  "v53gate-16:B": "Answers the DJ-versus-ISTV refund distinction correctly but adds an avoidable Finance route.",
  "v53gate-19:A": "Confidently replaces first-contact ownership with a negotiate-between-reps rule.",
  "v53gate-19:B": "Correctly requires the CRM notes check but does not identify the first closer as the owner.",
  "v53gate-21:A": "Sends a post-sale onboarding action to Sales Questions instead of Fulfillment.",
  "v53gate-21:B": "Sends a post-sale onboarding action to Sales Questions instead of Fulfillment.",
  "v53gate-23:B": "Sends a live payment-link defect to Finance instead of Sales Tech.",
  "v53gate-24:A": "Unsafe over-answer: suggests that a rep could approve a serious criminal-history case instead of requiring Rich's case-by-case decision.",
  "v53gate-25:A": "Sends a post-sale Mastermind registration request to Sales Questions instead of Fulfillment.",
  "v53gate-25:B": "Sends a post-sale Mastermind registration request to Sales Questions instead of Fulfillment.",
  "v53gate-30:A": "Sends a live 20-percent-list update to Sales Questions instead of Sales Tech.",
  "v53gate-30:B": "Sends a live 20-percent-list update to Sales Questions instead of Sales Tech.",
  "v53gate-31:A": "Responds politely but routes a greeting instead of simply inviting the sales question.",
  "v53gate-32:A": "Shows that the video is used but does not state the controlling must-still-play rule clearly.",
  "v53gate-33:A": "Natural acknowledgment with no repeated policy or unnecessary route.",
  "v53gate-35:B": "Produces a concise safe sentence but omits the sourced results-vary qualification.",
  "v53gate-39:A": "Routes the controlled payment-link action to Sales Questions instead of Sales Tech.",
  "v53gate-40:A": "Correctly says the rep must not create the link but omits the controlled Sales Tech owner.",
  "v53gate-40:B": "Correctly blocks rep-created links, but overstates that all custom links are disallowed despite the controlled Sales Tech path.",
  "v53gate-41:B": "Combines international and nonprofit eligibility, but omits the normal qualification boundary until the next turn.",
  "v53gate-43:A": "Routes a restaurant request to a company policy channel instead of giving a natural scope limitation.",
  "v53gate-43:B": "Routes a restaurant request to a company policy channel instead of giving a natural scope limitation."
};

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

function note(id: string, label: "A" | "B", grade: Grade) {
  const specific = specificNotes[`${id}:${label}`];
  if (specific) return specific;
  if (grade === "pass") return "Correct, safe, and sufficiently useful against the prewritten source-only gold.";
  if (grade === "partial") return "Safe and materially useful, but incomplete or unnecessarily routed against the prewritten source-only gold.";
  if (grade === "critical") return "Confident materially wrong rule or high-impact relationship mismatch against the prewritten source-only gold.";
  return "Does not resolve an answerable source-backed question, or does not provide the required natural conversation behavior.";
}

async function main() {
  const packetPath = path.resolve(argument("packet", "artifacts/ask-sales-faq-v5-3-independent-gate/primary-blinded-packet.json"));
  const outputPath = path.resolve(argument("output", "artifacts/ask-sales-faq-v5-3-independent-gate/primary-blinded-human-review.json"));
  const packetRaw = await readFile(packetPath, "utf8");
  const packet = object(JSON.parse(packetRaw));
  const items = Array.isArray(packet.items) ? packet.items.map(object) : [];
  const ids = items.map((item) => text(item.id));
  if (ids.length !== 43 || new Set(ids).size !== 43) throw new Error("Expected the complete 43-row blinded primary packet");
  const missing = ids.filter((id) => !judgments[id]);
  const extra = Object.keys(judgments).filter((id) => !ids.includes(id));
  if (missing.length || extra.length) throw new Error(`Judgment coverage mismatch; missing=${missing.join(",")} extra=${extra.join(",")}`);
  const review = {
    schemaVersion: "ask-sales-v5-3-blinded-human-review-v1",
    reviewedAt: new Date().toISOString(),
    reviewer: "Codex manual source review",
    packetSha256: createHash("sha256").update(packetRaw).digest("hex"),
    datasetSha256: text(packet.datasetSha256),
    systemsStillBlindedDuringReview: true,
    aiJudgePromotionAuthority: false,
    items: ids.map((id) => ({
      id,
      outputA: {
        grade: judgments[id].A,
        wrongActionOwner: wrongActionOwner.has(`${id}:A`),
        note: note(id, "A", judgments[id].A),
      },
      outputB: {
        grade: judgments[id].B,
        wrongActionOwner: wrongActionOwner.has(`${id}:B`),
        note: note(id, "B", judgments[id].B),
      },
    })),
  };
  await writeFile(outputPath, `${JSON.stringify(review, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify({ outputPath, packetSha256: review.packetSha256, reviewedItems: review.items.length }, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
