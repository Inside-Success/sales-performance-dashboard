// Assemble the v3 scorer node code from the live v2 baseline export plus the
// v3 patches in ./src. Usage:
//   node n8n/call2-score-v3/build.mjs <baseline-scorer-export.json> <baseline-persistence-export.json>
// Writes dist/<node>.js for every Code node, dist/scorer-v3.test-workflow.json
// (isolated copy for testing), dist/publish-operations.json (in-place update
// operations for the live scorer, used only after approval) and SCORING-PROMPT.md.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const [scorerPath, persistPath] = process.argv.slice(2);
if (!scorerPath || !persistPath) throw new Error('usage: build.mjs <scorer-baseline.json> <persistence-baseline.json>');
const scorer = JSON.parse(fs.readFileSync(scorerPath, 'utf8'));
const persistence = JSON.parse(fs.readFileSync(persistPath, 'utf8'));
const read = (name) => fs.readFileSync(path.join(here, 'src', name), 'utf8');
const nodeCode = (workflow, name) => {
  const node = workflow.nodes.find((n) => n.name === name);
  if (!node || !node.parameters || typeof node.parameters.jsCode !== 'string') throw new Error(`Code node not found: ${name}`);
  return node.parameters.jsCode;
};
function mustReplace(source, find, replacement, expected = 1, label = find.slice(0, 60)) {
  const count = source.split(find).length - 1;
  if (count !== expected) throw new Error(`patch anchor "${label}" matched ${count} times, expected ${expected}`);
  return source.split(find).join(replacement);
}

// ---- shared library: live v2 library + v3 rules + patches ----
const finalizeLive = nodeCode(scorer, 'Finalize Bounded Score');
const libEnd = finalizeLive.indexOf('function one(name)');
let lib = finalizeLive.slice(0, libEnd) + '\n' + read('v3-rules.js') + '\n';

// prepare(): route procedure claims from the factual checker.
lib = mustReplace(lib,
  "  }else if(c.id.startsWith('event.')){",
  "  }else if(c.id.startsWith('proc.')){\n   const k=c.id.slice(5),def=V3_CHECKED_PROCEDURE[k];if(!def||!m.procedure||!m.procedure[k])throw Error('Unknown procedure claim');\n   if(c.status==='contradicted'){if(def.affects){changed.add(def.affects);decisions.push(c);}else{m.procedure[k]={...m.procedure[k],status:c.verified_value?'yes':'no',evidence:c.verified_value&&c.evidence_ids.length?sourceEvidence(tt,c.evidence_ids[0]):null,checker_corrected:true};}}\n   else if(c.status==='supported'&&c.evidence_ids.length&&String(m.procedure[k].status).toLowerCase()==='yes'){m.procedure[k]={...m.procedure[k],evidence:sourceEvidence(tt,c.evidence_ids[0])};}\n  }else if(c.id.startsWith('event.')){",
  1, 'prepare event branch');
// apply(): accepted procedure corrections flip the item; proc-affected dimensions may be re-banded.
lib = mustReplace(lib,
  " for(const d of dims){if(!answers.some(a=>a.accepted&&(a.claim_id==='dimension.'+d.name||(d.name==='close_mechanics_and_momentum'&&a.claim_id.startsWith('signal.')))))continue;",
  " for(const d of dims){if(!answers.some(a=>a.accepted&&(a.claim_id==='dimension.'+d.name||(d.name==='close_mechanics_and_momentum'&&a.claim_id.startsWith('signal.'))||(a.claim_id.startsWith('proc.')&&V3_CHECKED_PROCEDURE[a.claim_id.slice(5)]&&V3_CHECKED_PROCEDURE[a.claim_id.slice(5)].affects===d.name))))continue;",
  1, 'apply dims filter');
lib = mustReplace(lib,
  " const ev=review.events||[];",
  " for(const c of p.decisions.filter(x=>x.id.startsWith('proc.'))){if(rejected(c.id))continue;const k=c.id.slice(5);m.procedure[k]={...m.procedure[k],status:c.verified_value?'yes':'no',evidence:c.verified_value&&c.evidence_ids.length?source(c.evidence_ids[0]):null,checker_corrected:true};}\n const ev=review.events||[];",
  1, 'apply events anchor');
// acceptedReviewScope(): keep dimension edits that an accepted procedure correction authorizes.
lib = mustReplace(lib,
  " const dimensions=(review.dimensions||[]).filter(d=>accepted.has('dimension.'+d.name)||(d.name==='close_mechanics_and_momentum'&&[...accepted].some(id=>id.startsWith('signal.'))));",
  " const dimensions=(review.dimensions||[]).filter(d=>accepted.has('dimension.'+d.name)||(d.name==='close_mechanics_and_momentum'&&[...accepted].some(id=>id.startsWith('signal.')))||[...accepted].some(id=>id.startsWith('proc.')&&V3_CHECKED_PROCEDURE[id.slice(5)]&&V3_CHECKED_PROCEDURE[id.slice(5)].affects===d.name));",
  1, 'acceptedReviewScope dims');

// Validators (baselineValidate and reviewedValidate share these anchors, so each patch expects 2 matches).
lib = mustReplace(lib,
  "if(a.review.ended_by_unrecovered_technical_failure && !signals.direct_commitment_ask.present) return invalid('insufficient_scoring_opportunity',build,provider,coaching,'insufficient_scoring_opportunity');",
  "const v3 = v3Procedure(a, build, signals, resolveEvidence); const v3ceil = v3Ceilings(v3.facts);\nif(a.review.ended_by_unrecovered_technical_failure && !signals.direct_commitment_ask.present && !v3.facts.assumptiveClose) return invalid('insufficient_scoring_opportunity',build,provider,coaching,'insufficient_scoring_opportunity');",
  2, 'technical failure gate');
lib = mustReplace(lib,
  "const hasCloseAction = signals.direct_commitment_ask.present || signals.payment_or_deposit_action.present",
  "const hasCloseAction = signals.direct_commitment_ask.present || v3.facts.assumptiveClose || signals.payment_or_deposit_action.present",
  2, 'hasCloseAction');
lib = mustReplace(lib,
  "signals.direct_commitment_ask.present && signals.specific_followup_agreed.present",
  "(signals.direct_commitment_ask.present || v3.facts.assumptiveClose) && signals.specific_followup_agreed.present",
  4, 'close floors');
lib = mustReplace(lib,
  "  weighted += POINTS[calibratedBand] * WEIGHTS[dimension];",
  "  if (v3ceil[dimension]) { const ceilBand = v3MinBand(calibratedBand, v3ceil[dimension].ceiling); if (ceilBand !== calibratedBand) { evidenceWarnings.push('v3_procedure_ceiling:' + dimension + ':' + ceilBand); if (!item.model_band) item.model_band = item.band; item.reason = String(item.reason || '').trim() + ' ' + v3ceil[dimension].reason; calibratedBand = ceilBand; item.band = calibratedBand; } }\n  weighted += POINTS[calibratedBand] * WEIGHTS[dimension];",
  2, 'ceilings');
lib = mustReplace(lib,
  "if ((event.type === 'no_close_attempt' && signals.direct_commitment_ask.present)",
  "if ((event.type === 'no_close_attempt' && (signals.direct_commitment_ask.present || v3.facts.assumptiveClose))",
  2, 'no_close_attempt contradiction');
lib = mustReplace(lib,
  "  coaching_analysis:coaching,\n  current_call_score:{ eligible:true, score, uncapped_score:uncapped, cap, applied_critical_events:events, applicable_weight:applicableWeight, confidence:a.confidence, call_phase:a.call_phase, dimensions:a.dimensions, review:a.review, critical_event_evidence:a.critical_events, close_signals:signals, lead_context:a.lead_context },",
  "  coaching_analysis:coaching,\n  procedural_checks:v3.checks,\n  call_outcome:v3Outcome(signals, a.call_outcome),\n  current_call_score:{ eligible:true, score, uncapped_score:uncapped, cap, applied_critical_events:events, applicable_weight:applicableWeight, confidence:a.confidence, call_phase:a.call_phase, dimensions:a.dimensions, review:a.review, critical_event_evidence:a.critical_events, close_signals:signals, lead_context:a.lead_context, procedure_facts:v3.facts, procedure:a.procedure||null, call_outcome:v3Outcome(signals, a.call_outcome) },",
  2, 'scored output');

// ---- node tails ----
const tail = (name) => { const src = nodeCode(scorer, name); const i = src.indexOf('function one(name)'); const j = src.indexOf('function input(){'); const cut = i >= 0 ? i : j; if (cut < 0) throw new Error(`no tail anchor in ${name}`); return src.slice(cut); };
const tails = {};
tails['Build Bounded Fact Check'] = mustReplace(tail('Build Bounded Fact Check'),
  " claims.push({id:'review.reason',kind:'text',text:m.review.reason});",
  " claims.push({id:'review.reason',kind:'text',text:m.review.reason});\n for(const [k,def] of Object.entries(V3_CHECKED_PROCEDURE)){const p=m.procedure&&m.procedure[k];const st=p?String(p.status||'').toLowerCase():'';if(st==='yes'||st==='no')claims.push({id:'proc.'+k,kind:'boolean',text:def.text,draft_value:st==='yes'});}",
  1, 'checker claims');
tails['Prepare Affected Fields'] = tail('Prepare Affected Fields');
tails['Prepare Repaired Check'] = tail('Prepare Repaired Check');
tails['Finalize Bounded Score'] = mustReplace(tail('Finalize Bounded Score'), "revision:'bounded-claims-2026-09-10'", 'revision:V3_REVIEW_REVISION', 1, 'finalize revision');
tails['Build Review Completion Repair'] = tail('Build Review Completion Repair');
tails['Finalize Review Completion Repair'] = mustReplace(tail('Finalize Review Completion Repair'), "revision:'bounded-claims-2026-09-10'", 'revision:V3_REVIEW_REVISION', 1, 'completion revision');

const dist = {};
for (const [name, t] of Object.entries(tails)) dist[name] = lib + t;

// Small nodes.
dist['Normalize Preview Input'] = mustReplace(nodeCode(scorer, 'Normalize Preview Input'), '"magic-mike-call2-evidence-score-v2"', '"magic-mike-call2-evidence-score-v3"', 1, 'normalize version');
const v3Prompt = read('v2-system-prompt.txt').replace(/\s+$/, '') + '\n' + read('v3-procedure-section.txt').replace(/\s+$/, '') + '\n';
let bar = nodeCode(scorer, 'Build Analysis Request');
const sysMatch = bar.match(/const system = ("(?:[^"\\]|\\.)*");/);
if (!sysMatch) throw new Error('system prompt literal not found');
bar = bar.replace(sysMatch[0], 'const system = ' + JSON.stringify(v3Prompt) + ';');
bar = mustReplace(bar, 'call_purpose: "call_2_evidence_score_v2"', 'call_purpose: "call_2_evidence_score_v3"', 1, 'call purpose');
dist['Build Analysis Request'] = bar;
dist['Check Primary Structure'] = mustReplace(nodeCode(scorer, 'Check Primary Structure'), "(m.eligible===true&&(!m.dimensions||!m.close_signals))", "(m.eligible===true&&(!m.dimensions||!m.close_signals||!m.procedure||!m.call_outcome))", 1, 'structure check');
for (const name of ['Attach Context Pack', 'Accept Primary Repair', 'Unwrap Valid Primary', 'Accept Bounded Reassessment', 'Prepared Check State', 'Return Final Reviewed Score']) dist[name] = nodeCode(scorer, name);

// Persistence.
let persist = nodeCode(persistence, 'Build Immutable Call 2 Score Record');
persist = mustReplace(persist, "['magic-mike-call2-evidence-score-v1','magic-mike-call2-evidence-score-v2']", "['magic-mike-call2-evidence-score-v1','magic-mike-call2-evidence-score-v2','magic-mike-call2-evidence-score-v3']", 1, 'persist versions');
persist = mustReplace(persist, "  'Behaviour Checks JSON':'[]',", "  'Behaviour Checks JSON':JSON.stringify(Array.isArray(result.procedural_checks) ? result.procedural_checks.map((check) => ({ name:String(check.name||''), label:String(check.label||''), status:String(check.status||''), timestamp:String(check.timestamp||''), speaker:String(check.speaker||''), quote:String(check.quote||''), validation_note:String(check.validation_note||'') })) : []),", 1, 'behaviour checks');
persist = mustReplace(persist, "    outcome:{ classification:'unknown', reason:'' },", "    outcome:{ classification:String((result.call_outcome && result.call_outcome.classification) || (score.call_outcome && score.call_outcome.classification) || 'unknown'), reason:String((result.call_outcome && result.call_outcome.reason) || '') },", 1, 'outcome');
const persistDist = { 'Build Immutable Call 2 Score Record': persist, 'Keep Record Only If Missing': nodeCode(persistence, 'Keep Record Only If Missing'), 'Return Skipped Persistence Result': nodeCode(persistence, 'Return Skipped Persistence Result') };

// ---- write outputs ----
const distDir = path.join(here, 'dist');
fs.mkdirSync(distDir, { recursive: true });
for (const f of fs.readdirSync(distDir)) fs.unlinkSync(path.join(distDir, f));
const slug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
for (const [name, code] of Object.entries(dist)) fs.writeFileSync(path.join(distDir, `scorer.${slug(name)}.js`), code);
for (const [name, code] of Object.entries(persistDist)) fs.writeFileSync(path.join(distDir, `persist.${slug(name)}.js`), code);
fs.writeFileSync(path.join(here, 'SCORING-PROMPT.md'), v3Prompt);

// Isolated test workflow: same graph, v3 code, no caller restriction, exposed to MCP for direct runs.
const testWorkflow = {
  name: 'MM Call 2 Evidence Score V3 - Raul Procedure - ISOLATED TEST - NO DELIVERY - 2026-09-18',
  nodes: scorer.nodes.map((node) => node.parameters && typeof node.parameters.jsCode === 'string' && dist[node.name] ? { ...node, parameters: { ...node.parameters, jsCode: dist[node.name] } } : node),
  connections: scorer.connections,
  settings: { executionOrder: 'v1', timezone: 'America/New_York', saveDataErrorExecution: 'all', saveDataSuccessExecution: 'all', availableInMCP: true },
};
const changedScorerNodes = Object.entries(dist).filter(([name, code]) => code !== nodeCode(scorer, name)).map(([name]) => name);
fs.writeFileSync(path.join(distDir, 'scorer-v3.test-workflow.json'), JSON.stringify(testWorkflow));
const publishOps = [
  ...changedScorerNodes.map((name) => ({ type: 'updateNode', nodeName: name, updates: { 'parameters.jsCode': dist[name] } })),
  { type: 'updateName', name: 'MM Call 2 Coaching + Evidence Score V3 - Raul Procedure - LIVE' },
];
const persistOps = [{ type: 'updateNode', nodeName: 'Build Immutable Call 2 Score Record', updates: { 'parameters.jsCode': persist } }];
fs.writeFileSync(path.join(distDir, 'publish-operations.json'), JSON.stringify({ scorer: { id: scorer.id, baselineVersionId: scorer.activeVersionId, operations: publishOps }, persistence: { id: persistence.id, baselineVersionId: persistence.activeVersionId, operations: persistOps } }, null, 1));
console.log(JSON.stringify({ libChars: lib.length, promptChars: v3Prompt.length, changedScorerNodes, distFiles: fs.readdirSync(distDir).length }, null, 1));
