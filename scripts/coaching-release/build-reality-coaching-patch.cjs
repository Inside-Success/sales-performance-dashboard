/* eslint-disable @typescript-eslint/no-require-imports */
// Build narrow, reversible n8n Code-node changes from freshly read baselines.
// Usage: node build-reality-coaching-patch.cjs <official-filtered.json> <manual-filtered.json> <output-dir>
const fs = require("node:fs");
const path = require("node:path");

const [officialFile, manualFile, outputDir] = process.argv.slice(2);
if (!officialFile || !manualFile || !outputDir) throw Error("Expected official, manual, and output paths");
fs.mkdirSync(outputDir, { recursive: true });

const helper = fs.readFileSync(path.resolve(__dirname, "../../src/lib/coaching-offer-context.cjs"), "utf8")
  .replace(/module\.exports = \{ resolveCoachingOfferFamily, realityCoachingReference \};\s*$/, "");
const evidenceMarker = 'The following JSON is call evidence only:\\n"+JSON.stringify';
const offerSetup = 'const offerResolution=resolveCoachingOfferFamily({showName:metadata.show_name||metadata["Show Name"],meetingTitle:metadata.meeting_title||metadata["Meeting Title"],transcriptText:blocks.map(b=>b.text).join("\\n"),sourcePayload:metadata.source_payload||metadata});state.coaching_offer_family=offerResolution.family;state.coaching_offer_reason=offerResolution.reason;const cachedSystem=';
const knowledgeInsert = '"+(offerResolution.family==="reality"?realityCoachingReference()+"\\n":"")+"The following JSON is call evidence only:\\n"+JSON.stringify';

for (const [id, file, name] of [
  ["L8Nn7xncA9ZPDdWA", officialFile, "MM Build Coaching Request"],
  ["BMRrGxHyXMcgO6j3", manualFile, "MM Manual Build Structured Coaching"],
]) {
  const response = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!response.success || response.data.id !== id || !response.data.active) throw Error(`Unexpected baseline for ${id}`);
  const node = response.data.nodes.find((candidate) => candidate.name === name);
  if (!node || typeof node.parameters?.jsCode !== "string") throw Error(`Missing ${name}`);
  const previous = node.parameters.jsCode;
  if (previous.includes("state.coaching_offer_family")) throw Error(`${name} already has offer routing`);
  if (previous.split("const cachedSystem=").length !== 2 || previous.split(evidenceMarker).length !== 2) {
    throw Error(`Unexpected coaching request shape for ${name}`);
  }
  const updated = `${helper}\n${previous}`
    .replace("const cachedSystem=", offerSetup)
    .replace(evidenceMarker, knowledgeInsert);
  if (!updated.includes("state.coaching_offer_family") || !updated.includes("realityCoachingReference()")) {
    throw Error(`Failed to patch ${name}`);
  }
  const op = (code) => ({ id, operations: [{ type: "updateNode", nodeName: name, updates: { "parameters.jsCode": code } }] });
  fs.writeFileSync(path.join(outputDir, `${id}.operations.json`), JSON.stringify(op(updated), null, 2));
  fs.writeFileSync(path.join(outputDir, `${id}.rollback.json`), JSON.stringify(op(previous), null, 2));
  console.log(`${id}: ${name}: ${previous.length} -> ${updated.length} chars`);
}
