// Isolated candidate: preserve the pinned author's coaching text, with explicit adapters.
const crypto = require('crypto');
const {schema} = require('./contract.cjs');
const sha = text => crypto.createHash('sha256').update(text).digest('hex');
const PIN = 'fc7d342c43f2d560fca2f2a17c6095a1e22a68b031e836f06ae947fa2ed3df08';
function adapt(source, layers) {
  if (sha(source) !== PIN) throw Error('Tyler source revision changed; review before adapting');
  const marker = 'APPROVED OFFER KNOWLEDGE (coaching-policy-2026-10-29):';
  const split = source.indexOf(marker);
  if (split < 0) throw Error('Missing policy boundary');
  let text = source.slice(0, split);
  const changes = [];
  function replace(from, to, reason) {
    if (text.split(from).length !== 2) throw Error('Ambiguous adaptation: '+reason);
    text = text.replace(from, to); changes.push({from,to,reason});
  }
  replace('For a feature documentary Call 2, organize', 'For an eligible substantive Call 2 in any supplied offer family, organize', 'Generalize the reasoning, not documentary offer entitlements');
  replace('For feature documentary Call 2 coaching, use', 'For eligible Call 2 coaching across the supplied offer families, use', 'Apply contextual value guidance without mandatory sequencing');
  const refusal = text.split('\n').find(l => l.startsWith('For genuinely out-of-scope calls'));
  replace(refusal, refusal.slice(0,refusal.indexOf('return {')) + 'return the complete experiment schema with status excluded, a specific evidence-supported exclusion_reason, empty objections/lessons/next_steps and empty focus_id. A weak substantive selling conversation is not an exclusion. Missing timestamps alone do not prevent coaching. Unlabeled speakers alone establish neither internal participation nor absence. If the fragments do not establish a real usable sales interaction, withhold coaching without inventing why the source is incomplete.', 'Map refusal to the isolated contract; preserve uncertainty instead of invented rehearsal diagnoses');
  replace('Develop the lesson in the existing field where the evidence belongs: the relevant objection’s assessment, a strength’s why_it_matters, or an improvement’s why_it_matters and action. Let summary frame the lesson and the supporting entry add what the reader still needs.', 'Develop the lesson where its evidence belongs: the relevant objection’s assessment and teaching, or a distinct lesson’s observation and teaching. focus_id identifies the main lesson without repeating its prose. A repeat lesson maps a strength; refine maps a justified improvement; explore maps a defensible alternative without implying a defect.', 'One home per insight; explicit old-to-new field mapping');
  replace('For could_be_handled_better,', 'For needs_work,', 'Handling enum mapping');
  replace('For sound or uncertain handling, keep advice fields empty.', 'For sound or uncertain handling, keep corrective advice and example empty. Teaching may explain the sound move or a conditional trade-off, but cannot imply a correction unsupported by evidence.', 'Preserve the distinction between teaching and corrective advice');
  replace('unclassified: actual resistance exists but no category fits; preserve it rather than force a label.', 'unclassified: actual resistance exists but no category fits, or the available dialogue does not explain its substance enough to classify; preserve it rather than force a label.', 'Restore the documented local taxonomy correction');
  const policy = layers.filter(x => ['tyler-foundations','governed-offer-policy','november-source-updates'].includes(x.id));
  if(policy.length!==3) throw Error('Incomplete source layers');
  require('./foundation.cjs').compose(policy);
  for (const layer of policy) if (!layer.text || !layer.source || !layer.digest) throw Error('Missing governed layer');
  const mike = `MIKE'S CURRENT COMMERCIAL INSTRUCTION (user-supplied November 5): When a buyer says they will pay by wire or ACH, the rep should accept that method but explicitly ask for the applicable down payment TODAY to lock them in, rather than simply agree to wait for the transfer. This is the required lock-in step, not merely an optional way to accelerate payment. Use the actual applicable offer amount; $4,500 in Mike's example is not universal. Credit an actual request even if the buyer cannot complete it. Request, attempted payment and confirmed receipt remain distinct. If the applicable first payment is already confirmed and the wire is for the balance, do not demand another deposit. ACH/wire preference alone is not an objection. This instruction's historical effective date is unestablished: do not call older conduct a policy breach, and do not manufacture a retrospective fault solely to mention it. Future advice may explain the current process when relevant. No compliance-only finding or invented custom deposit.\n`;
  const contract = `REPORT ADAPTER: This exact schema supersedes only older field, enum and layout references: ${JSON.stringify(schema)}\nObjections and their actual handling appear first. Each lesson has one home; do not repeat an objection's coaching in lessons or next_steps. Put distinct repeatable strengths last. Empty arrays are valid. A short source does not justify invented certainty. Use full evidence for exclusions too. Final output is JSON only. The report normally follows Tyler's 500–900 word guide, shorter when appropriate, never a quota.\n`;
  return {system:text+'\n'+policy.map(x=>x.text).join('\n')+'\n'+mike+contract, changes, source_sha256:PIN, retained_prefix_sha256:sha(source.slice(0,split)), layers:policy.map(({text,...m})=>m)};
}
module.exports = {adapt, PIN, sha};
