// Local executor for the v3 scorer graph. Runs the SAME node code that ships to
// n8n through a small n8n-compatible harness ($input, $json, $('Node').all()).
// HTTP Request nodes post to the shared provider webhook (paid) with an
// on-disk response cache; IF nodes evaluate their single boolean condition.
// Nothing here writes to Airtable, Slack, Google or the dashboard.
//
//   node run-local.mjs --workflow dist/scorer-v3.test-workflow.json --cases <dir-or-file> --out <dir> --cache <dir> [--ledger <file>] [--hard-cap 25] [--soft-cap 12] [--only id,id] [--dry]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, arr) => { if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : 'true']); return acc; }, []));
const workflow = JSON.parse(fs.readFileSync(args.workflow, 'utf8'));
const outDir = args.out; fs.mkdirSync(outDir, { recursive: true });
const cacheDir = args.cache; fs.mkdirSync(cacheDir, { recursive: true });
const ledgerPath = args.ledger || path.join(outDir, 'ledger.json');
const hardCap = Number(args['hard-cap'] || 25), softCap = Number(args['soft-cap'] || 12);
const dry = args.dry === 'true';
const PROVIDER_URL = 'https://insidesuccess.app.n8n.cloud/webhook/magic-mike-provider-call-20260609-7f3f1c';

const ledger = fs.existsSync(ledgerPath) ? JSON.parse(fs.readFileSync(ledgerPath, 'utf8')) : { entries: [], total_cost_usd: 0 };
const saveLedger = () => fs.writeFileSync(ledgerPath, JSON.stringify(ledger, null, 1));
const nodes = Object.fromEntries(workflow.nodes.map((n) => [n.name, n]));
const next = (name, index) => ((workflow.connections[name] || {}).main || [])[index] || [];

function loadCases() {
  const target = args.cases; const files = fs.statSync(target).isDirectory() ? fs.readdirSync(target).filter((f) => f.endsWith('.json') && f !== 'manifest.json').map((f) => path.join(target, f)) : [target];
  const only = args.only ? new Set(args.only.split(',')) : null;
  return files.map((file) => {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (raw.build) { const m = raw.build.metadata || {}; return { id: raw.id || path.basename(file, '.json'), call: { cleaned_transcript: raw.build.transcript, rep_name: m.rep_name, rep_email: m.rep_email, client_name: m.client_name, call_date: m.call_date, meeting_id: m.meeting_id, meeting_title: m.meeting_title, show_name: m.show_name, source_record_id: m.source_record_id, transcript_url: '' }, reference: raw.old_score || null, source: raw.source || 'fixture' }; }
    if (raw.text) { const s = raw.sample || {}; return { id: raw.doc_id, call: { cleaned_transcript: raw.text, rep_name: s.rep || '', rep_email: s.rep_email || '', client_name: '', call_date: s.date || '', meeting_id: '', meeting_title: raw.title || '', show_name: '', source_record_id: s.source_id || raw.doc_id, transcript_url: '' }, reference: { v2_live_score: s.score, v2_caps: s.caps, v2_signals: s.signals, why: s.why }, source: 'september-live' }; }
    throw new Error('unknown case format ' + file);
  }).filter((c) => !only || only.has(c.id));
}

async function callProvider(body, caseId, nodeName) {
  const key = crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex');
  const cached = path.join(cacheDir, key + '.json');
  if (fs.existsSync(cached)) { const j = JSON.parse(fs.readFileSync(cached, 'utf8')); j.__cached = true; return j; }
  if (dry) return { ok: false, error: 'dry run: no provider call', request_id: body.request_id };
  if (ledger.total_cost_usd >= hardCap) throw new Error(`hard budget cap ${hardCap} reached (${ledger.total_cost_usd.toFixed(4)})`);
  const started = Date.now();
  let response;
  try {
    const res = await fetch(PROVIDER_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(600000) });
    const text = await res.text();
    try { response = JSON.parse(text); } catch { response = { ok: false, error: 'non-json provider response: ' + text.slice(0, 200) }; }
    if (!res.ok) response = { ok: false, error: 'provider http ' + res.status, ...(typeof response === 'object' ? { detail: response } : {}) };
  } catch (error) { response = { ok: false, error: 'provider transport: ' + String(error && error.message || error) }; }
  const cost = Number(response && response.costs && response.costs.total_cost_usd || 0);
  ledger.entries.push({ at: new Date().toISOString(), case: caseId, node: nodeName, purpose: body.call_purpose, request_id: body.request_id, ok: response.ok === true, cost_usd: cost, latency_ms: Date.now() - started, model: body.model });
  ledger.total_cost_usd = Math.round((ledger.total_cost_usd + cost) * 1e6) / 1e6; saveLedger();
  if (ledger.total_cost_usd > softCap) console.warn(`SOFT CAP WARNING: cumulative spend ${ledger.total_cost_usd.toFixed(4)} > ${softCap}`);
  if (response.ok === true) fs.writeFileSync(cached, JSON.stringify(response));
  return response;
}

function evaluateIf(node, item) {
  const expr = node.parameters.conditions.conditions[0].leftValue.replace(/^=\{\{\s*/, '').replace(/\s*\}\}$/, '');
  return new Function('$json', 'return (' + expr + ');')(item) === true;
}

async function runCase(c) {
  const outputs = {}; // node name -> items [{json}]
  const trace = [];
  const $ = (name) => ({ all: () => outputs[name] || [], item: (outputs[name] || [])[0], first: () => (outputs[name] || [])[0] });
  const runCode = (node, items) => { const $input = { all: () => items, first: () => items[0] }; const fn = new Function('$input', '$', '$json', node.parameters.jsCode); return fn($input, $, items[0] && items[0].json); };
  let queue = [{ name: 'Normalize Preview Input', items: [{ json: { call: c.call, recent_scores: [] } }] }];
  outputs['When Executed for Review'] = queue[0].items;
  while (queue.length) {
    const { name, items } = queue.shift(); const node = nodes[name]; if (!node) throw new Error('unknown node ' + name);
    let branch = 0; let result;
    if (node.type === 'n8n-nodes-base.code') { result = runCode(node, items); outputs[name] = result; trace.push(name); }
    else if (node.type === 'n8n-nodes-base.httpRequest') {
      if (name === 'Fetch Live Context Pack') { result = [{ json: { data: '' } }]; }
      else { const body = items[0].json.provider_request; if (!body) throw new Error('no provider_request for ' + name); const response = await callProvider(body, c.id, name); result = [{ json: response }]; if (response.ok !== true && node.onError === 'continueErrorOutput') branch = 1; trace.push(`${name}${response.__cached ? ' (cached)' : ''}`); }
      outputs[name] = result;
    } else if (node.type === 'n8n-nodes-base.if') { const truthy = evaluateIf(node, items[0].json); branch = truthy ? 0 : 1; result = items; outputs[name] = items; trace.push(`${name}=${truthy}`); }
    else throw new Error('unsupported node type ' + node.type + ' for ' + name);
    for (const target of next(name, branch)) queue.push({ name: target.node, items: result });
  }
  const finalItems = outputs['Return Final Reviewed Score'];
  if (!finalItems) throw new Error('graph did not reach Return Final Reviewed Score: ' + trace.join(' > '));
  return { result: finalItems[0].json, trace };
}

const cases = loadCases();
const summary = [];
for (const c of cases) {
  const started = Date.now();
  try {
    const { result, trace } = await runCase(c);
    fs.writeFileSync(path.join(outDir, `${c.id}.result.json`), JSON.stringify({ id: c.id, source: c.source, reference: c.reference, trace, result }, null, 1));
    const s = result.current_call_score || {};
    const row = { id: c.id, rep: c.call.rep_name, date: String(c.call.call_date || '').slice(0, 10), eligible: s.eligible, score: s.score ?? null, cap: s.cap ?? null, caps: (s.applied_critical_events || []).join(';'), reason: s.eligible ? '' : (s.reason || ''), review: result.factual_review && result.factual_review.status, cost: result.provider_costs && result.provider_costs.total_cost_usd, ref: c.reference && (c.reference.v2_live_score ?? (c.reference.claims_reviewed ?? null)), outcome: result.call_outcome && result.call_outcome.classification, assume: (result.procedural_checks || []).find((x) => x.name === 'assumptive_close_after_video')?.status, video: (result.procedural_checks || []).find((x) => x.name === 'rudy_video')?.status, gl: (result.procedural_checks || []).find((x) => x.name === 'greenlight_duration')?.status, ceilings: (result.validation && result.validation.warnings || []).filter((w) => /v3_procedure_ceiling|calibrated_close/.test(w)).join(';'), ms: Date.now() - started };
    summary.push(row); console.log(JSON.stringify(row));
  } catch (error) { const row = { id: c.id, error: String(error && error.message || error) }; summary.push(row); console.log(JSON.stringify(row)); if (/hard budget cap/.test(row.error)) break; }
}
fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 1));
console.log(`done: ${summary.length} cases, ledger total $${ledger.total_cost_usd.toFixed(4)}`);
