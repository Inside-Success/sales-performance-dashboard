// Build n8n pinData for a native replay of one case on the isolated test
// workflow, using the exact provider responses already paid for in a local run
// (from <case>.replay.json written with --save-replay). Every HTTP Request node
// is pinned, so the native run exercises only the Code and IF nodes: zero cost.
//   node pin-native.mjs <case.replay.json> > pinData.json
import fs from 'node:fs';
const replay = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const HTTP_NODES = ['Run Context-Rich Analysis', 'Check Scoring Facts', 'Reassess Verified Corrections', 'Repair Primary Structure Once', 'Repair Checker Contract Once', 'Complete Review Once'];
const pin = { 'When Executed for Review': [{ json: replay.triggerItem }], 'Fetch Live Context Pack': [{ json: { data: '' } }] };
for (const node of HTTP_NODES) {
  const captured = replay.providerResponses[node];
  // Unreached nodes get a failed-provider placeholder; the graph never routes to them for this case.
  // raw_response duplicates model_text and is never read by the Code nodes; drop it to keep the pin small.
  const response = captured ? { ...captured.response } : { ok: false, error: 'not reached in local run' };
  delete response.raw_response; delete response.__cached;
  pin[node] = [{ json: response }];
}
process.stdout.write(JSON.stringify(pin));
