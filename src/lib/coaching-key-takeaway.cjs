// User-authorized opening-copy consolidation, November 12. Presentation only:
// keep original reviewed records, evidence and approval digests immutable.
const revisions = require('./coaching-key-takeaway-revisions.json');
const exact = new Map(revisions.map(({before, after}) => [before, after]));
function keyTakeaway(summary) {
  // Old/in-flight two-line summaries remain readable without discarding context.
  // Future prompts request one paragraph. Never truncate or invent fallback advice.
  return exact.get(summary) || summary.split(/\n+/).map(line => line.trim()).filter(Boolean).join(' ');
}
module.exports = {keyTakeaway};
