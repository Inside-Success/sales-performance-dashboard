import type { Evidence, Plan } from "./types";

const stopwords = new Set("a an the is are was were be been this that those these to of in on for with and or i me my we our you your it can could would should do does did how what when where why tell please about".split(" "));
export function terms(text: string) {
  return text.toLowerCase().normalize("NFKC").replace(/[’']/g, "").match(/[a-z0-9]+/g)?.filter(t => !stopwords.has(t)) || [];
}
export function normalizeProductScopes(scopes: string[]) {
  return [...new Set(scopes.map(scope => scope === "daymond_john" || scope === "nlceo" ? "dj_nlceo" : scope))];
}
export function compatible(record: Evidence, scopes: Plan["scopes"]) {
  if (!scopes.length) return true;
  const normalized=normalizeProductScopes(record.scopes);
  const known = normalized.filter(s => ["main_istv", "dj_nlceo", "reality"].includes(s));
  if(known.length) return known.some(s => scopes.includes(s as Plan["scopes"][number]));
  // Before reality launched, "product_agnostic" meant the then-existing offers.
  // Missing historical scope is not permission to extend a policy to a new product.
  if(scopes.every(s=>s==="reality") && record.conditions.includes("legacy_scope_not_verified_for_reality")) return false;
  return true;
}
// Contextual BM25, independently ranked direct and expanded queries. No exact
// question family can force an answer or delete another query's candidates.
export function retrieveEvidence(records: Evidence[], direct: string, plan: Plan, limit = 28, semantic = new Map<string,number>()) {
  if(!Number.isInteger(limit) || limit<1) return [];
  const eligible = records.filter(r => compatible(r, plan.scopes));
  const docs = eligible.map(record => {
    const words = terms([record.title, ...record.questions, record.text].join(" "));
    const tf = new Map<string, number>(); words.forEach(t => tf.set(t, (tf.get(t) || 0) + 1));
    return { record, words, tf };
  });
  const df = new Map<string, number>(); docs.forEach(d => d.tf.forEach((_,t) => df.set(t,(df.get(t)||0)+1)));
  const avg = docs.reduce((n,d) => n + d.words.length,0) / Math.max(docs.length,1);
  const queries = [...new Set([direct, plan.question, ...plan.queries])];
  const lanes = queries.map(query => {
    const qt = [...new Set(terms(query))];
    return docs.map(d => {
      let score = 0;
      for(const t of qt) {
        const f = d.tf.get(t)||0;
        score += Math.log(1 + (docs.length - (df.get(t)||0) + 0.5) / ((df.get(t)||0) + 0.5)) * f * 2.2 / (f + 1.2 * (0.25 + 0.75 * d.words.length / Math.max(1,avg)));
      }
      return { record:d.record,score };
    }).filter(d => d.score > 0).sort((a,b) => b.score-a.score || a.record.id.localeCompare(b.record.id));
  });
  if(semantic.size) lanes.push(eligible.filter(record=>semantic.has(record.id)).map(record=>({record,score:semantic.get(record.id)!})).sort((a,b)=>b.score-a.score));
  const selected = new Map<string,{record:Evidence;score:number}>();
  // Current context is maintained in the registry and can be superseded through
  // the same admin release. It cannot be displaced by duplicate historical hits.
  for(const record of eligible.filter(r=>r.domains?.includes("company_context")).slice(0,Math.min(6,limit))) selected.set(record.id,{record,score:0});
  // Reserve direct-query recall; expansion complements it rather than replacing it.
  for(const candidate of lanes[0]?.slice(0,8)||[]) {
    if(selected.size>=limit) break;
    selected.set(candidate.record.id,candidate);
  }
  const fused = new Map<string,{record:Evidence;score:number}>();
  lanes.forEach(lane=>lane.slice(0,60).forEach((candidate,rank)=>{
    const old=fused.get(candidate.record.id);
    fused.set(candidate.record.id,{record:candidate.record,score:(old?.score||0)+1/(30+rank)});
  }));
  for(const candidate of [...fused.values()].sort((a,b)=>b.score-a.score)) {
    if(selected.size>=limit) break;
    if(!selected.has(candidate.record.id)) selected.set(candidate.record.id,candidate);
  }
  return [...selected.values()];
}
