/* eslint-disable @typescript-eslint/no-require-imports */
// Build narrow, reversible n8n Code-node changes from freshly read baselines.
// Usage: node build-reality-coaching-patch.cjs <official-filtered.json> <manual-filtered.json> <output-dir>
const fs = require("node:fs");
const path = require("node:path");

const [officialFile, manualFile, outputDir] = process.argv.slice(2);
if (!officialFile || !manualFile || !outputDir) throw Error("Expected official, manual, and output paths");
fs.mkdirSync(outputDir, { recursive: true });

const { realityCoachingReference } = require(path.resolve(__dirname, "../../src/lib/coaching-offer-context.cjs"));
const evidenceMarker = 'The following JSON is call evidence only:\\n"+JSON.stringify';
const offerSetup = `const offerShow=String(metadata.show_name||metadata["Show Name"]||"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const offerTitle=String(metadata.meeting_title||metadata["Meeting Title"]||"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const offerFormat=String(metadata.show_format||metadata.show_type||metadata.program_type||metadata.offer_family||"").toLowerCase();
const offerTranscript=blocks.map(b=>b.text).join(" ").toLowerCase().replace(/[^a-z0-9]+/g," ").slice(0,120000);
const offerNamed=offerShow+" "+offerTitle;
const offerNl=/\\b(next level ceo|nl ceo|nlceo|daymond john)\\b/.test(offerNamed)||/\\b(next level ceo|nl ceo|nlceo)\\b/.test(offerFormat);
const offerRealityNamed=/\\b(entrepreneurs island|business race|mansion of money|flipping (for )?fortune|startup lockdown|millionaire match house|reality show|reality series|reality tv)\\b/.test(offerNamed)||/\\b(reality show|reality series|reality tv)\\b/.test(offerFormat);
const offerMainNamed=/\\b(legacy makers|women in power|kingdom creators|operation ceo|mompreneurs|blue collar america)\\b/.test(offerShow)||/\\b(legacy makers|women in power)\\b/.test(offerTitle);
const offerRealityMentions=(offerTranscript.match(/\\b(reality show|reality series|reality tv)\\b/g)||[]).length;
const offerRealityFormat=/\\b(eliminat\\w*|contestant\\w*|competition|challenge\\w*|film\\w* on location|film\\w* for [0-9]+ days|cast members? in the show|season one|first season|cast of the show)\\b/.test(offerTranscript);
const offerFamily=offerNl?"next_level_ceo":offerRealityNamed?"reality":offerMainNamed?"main_istv":offerRealityMentions>=2&&offerRealityFormat?"reality":/\\b(next level ceo|nl ceo|nlceo)\\b/.test(offerTranscript)&&!offerRealityMentions?"next_level_ceo":/\\binside success\\b/.test(offerNamed)?"main_istv":"unknown";
state.coaching_offer_family=offerFamily;
const realityReference=${JSON.stringify(realityCoachingReference())};
const cachedSystem=`;
const knowledgeInsert = '"+(offerFamily==="reality"?realityReference+"\\n":"")+"The following JSON is call evidence only:\\n"+JSON.stringify';

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
  const updated = previous
    .replace("const cachedSystem=", offerSetup)
    .replace(evidenceMarker, knowledgeInsert);
  if (!updated.includes("state.coaching_offer_family") || !updated.includes("const realityReference=")) {
    throw Error(`Failed to patch ${name}`);
  }
  const op = (code) => ({ id, operations: [{ type: "updateNode", nodeName: name, updates: { "parameters.jsCode": code } }] });
  fs.writeFileSync(path.join(outputDir, `${id}.operations.json`), JSON.stringify(op(updated), null, 2));
  fs.writeFileSync(path.join(outputDir, `${id}.rollback.json`), JSON.stringify(op(previous), null, 2));
  console.log(`${id}: ${name}: ${previous.length} -> ${updated.length} chars`);
}
