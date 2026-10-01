// Summarize a local run: v3 versus reference (v2) scores, distribution, ceilings,
// checklist coverage and rep-level movement. Read-only over result files.
//   node compare.mjs <run-dir> [<run-dir> ...]
import fs from 'node:fs';
import path from 'node:path';

const dirs = process.argv.slice(2);
const rows = [];
for (const dir of dirs) for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.result.json'))) {
  const r = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  const s = r.result.current_call_score || {};
  const ref = r.reference || {};
  const v2 = typeof ref.v2_live_score === 'number' ? ref.v2_live_score : typeof ref.claims_reviewed === 'number' ? ref.claims_reviewed : null;
  const checks = Object.fromEntries((r.result.procedural_checks || []).map((c) => [c.name, c.status]));
  rows.push({ id: r.id, source: r.source, rep: r.result.call && r.result.call.rep_name, date: String(r.result.call && r.result.call.call_date || '').slice(0, 10), eligible: s.eligible, v3: s.eligible ? s.score : null, v2, delta: s.eligible && v2 !== null ? Math.round((s.score - v2) * 10) / 10 : null, caps: (s.applied_critical_events || []).join(';'), v2caps: (ref.v2_caps || []).join(';'), bands: s.dimensions ? Object.values(s.dimensions).map((d) => d.band[0]).join('') : '', review: r.result.factual_review && r.result.factual_review.status, accepted: (r.result.factual_review && r.result.factual_review.accepted_corrections || []).length, ceilings: (r.result.validation && r.result.validation.warnings || []).filter((w) => w.startsWith('v3_procedure_ceiling')).map((w) => w.split(':')[1]).join(';'), outcome: r.result.call_outcome && r.result.call_outcome.classification, why: ref.why || '', reason: s.eligible ? '' : s.reason, cost: r.result.provider_costs && r.result.provider_costs.total_cost_usd, checks });
}
rows.sort((a, b) => (a.rep || '').localeCompare(b.rep || '') || a.date.localeCompare(b.date));
console.table(rows.map(({ checks, ...row }) => row));
const scored = rows.filter((r) => r.eligible);
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const sd = (xs) => { const m = mean(xs); return Math.sqrt(mean(xs.map((x) => (x - m) ** 2))); };
const v3s = scored.map((r) => r.v3); const paired = scored.filter((r) => r.v2 !== null);
console.log(`\nscored ${scored.length}/${rows.length}; excluded ${rows.filter((r) => r.eligible === false).length}; errors ${rows.filter((r) => r.eligible === undefined).length}`);
if (v3s.length) console.log(`v3: mean ${mean(v3s).toFixed(1)} sd ${sd(v3s).toFixed(1)} min ${Math.min(...v3s)} max ${Math.max(...v3s)}`);
if (paired.length) { const v2s = paired.map((r) => r.v2); console.log(`paired v2: mean ${mean(v2s).toFixed(1)} sd ${sd(v2s).toFixed(1)}; mean delta ${mean(paired.map((r) => r.delta)).toFixed(1)}; up ${paired.filter((r) => r.delta > 0).length} down ${paired.filter((r) => r.delta < 0).length} same ${paired.filter((r) => r.delta === 0).length}`); }
const capCount = {}; for (const r of scored) for (const c of r.caps.split(';').filter(Boolean)) capCount[c] = (capCount[c] || 0) + 1;
console.log('caps applied:', JSON.stringify(capCount), 'calls with any cap:', scored.filter((r) => r.caps).length);
const ceil = {}; for (const r of scored) for (const c of r.ceilings.split(';').filter(Boolean)) ceil[c] = (ceil[c] || 0) + 1;
console.log('v3 ceilings applied:', JSON.stringify(ceil));
const statuses = {}; for (const r of scored) for (const [k, v] of Object.entries(r.checks)) { statuses[k] ??= {}; statuses[k][v] = (statuses[k][v] || 0) + 1; }
console.log('checklist status coverage:'); for (const [k, v] of Object.entries(statuses)) console.log(' ', k.padEnd(30), JSON.stringify(v));
const byRep = {}; for (const r of paired) { (byRep[r.rep] ??= []).push(r); }
console.log('rep-level (paired calls): rep, n, v2 mean, v3 mean, delta');
for (const [rep, rs] of Object.entries(byRep).sort((a, b) => b[1].length - a[1].length)) console.log(' ', rep.padEnd(22), rs.length, mean(rs.map((r) => r.v2)).toFixed(1), mean(rs.map((r) => r.v3)).toFixed(1), (mean(rs.map((r) => r.v3)) - mean(rs.map((r) => r.v2))).toFixed(1));
const total = rows.reduce((a, r) => a + Number(r.cost || 0), 0); console.log(`run provider cost (per result totals) $${total.toFixed(4)}`);
