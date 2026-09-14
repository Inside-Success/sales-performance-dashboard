/** Explicit local export for the paired FAQ repository; never touches live data. */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { getRevampBaseRegistry } from "../src/lib/ask-sales-faq/revamp/knowledge";

const target = process.env.FAQ_REVAMP_EXPORT_DIR;
if (!target) throw new Error("Set FAQ_REVAMP_EXPORT_DIR to the paired FAQ repository runtime directory");
if (!existsSync(resolve(target, "v3-policy-registry.json"))) throw new Error("Target is not a FAQ runtime directory");
const targetLedger = resolve(target, "revamp-admin-approved-releases.json");
const localLedger = readFileSync("src/lib/ask-sales-faq/revamp/admin-approved-releases.json", "utf8");
if (existsSync(targetLedger) && JSON.stringify(JSON.parse(readFileSync(targetLedger, "utf8"))) !== JSON.stringify(JSON.parse(localLedger))) {
  throw new Error("Paired ledgers differ; reconcile approved releases before exporting");
}
writeFileSync(resolve(target, "revamp-base-registry.json"), JSON.stringify(getRevampBaseRegistry(), null, 2) + "\n");
writeFileSync(resolve(target, "revamp-admin-approved-releases.json"), readFileSync("src/lib/ask-sales-faq/revamp/admin-approved-releases.json"));
console.log("Exported candidate base and matching governed ledger; production unchanged.");
