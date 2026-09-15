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
export function retrieveEvidence(records: Evidence[], direct: string, plan: Plan, limit = 36, semantic = new Map<string,number>()) {
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
  const sources = new Map<string,number>();
  const byId = new Map(eligible.map(record=>[record.id,record]));
  const visiting = new Set<string>();
  function add(candidate:{record:Evidence;score:number}, required=false) {
    if(selected.has(candidate.record.id) || visiting.has(candidate.record.id) || selected.size>=limit) return;
    const source=candidate.record.sourceIds[0] || candidate.record.id;
    // A single article was split into dozens of near-identical titled fragments.
    // Repetition must not crowd out a different source answering the question.
    if(!required && (sources.get(source)||0)>=3) return;
    visiting.add(candidate.record.id);
    // Follow adjudicated evidence relationships, never question-pattern gates.
    for(const flag of candidate.record.conditions) {
      if(!flag.startsWith("governing_evidence:")) continue;
      const governing=byId.get(flag.slice("governing_evidence:".length));
      if(governing) add({record:governing,score:candidate.score},true);
    }
    visiting.delete(candidate.record.id);
    if(selected.size>=limit) return;
    selected.set(candidate.record.id,candidate);sources.set(source,(sources.get(source)||0)+1);
  }
  // Current context is maintained in the registry and can be superseded through
  // the same admin release. It cannot be displaced by duplicate historical hits.
  for(const record of eligible.filter(r=>r.domains?.includes("company_context")).slice(0,Math.min(6,limit))) add({record,score:0},true);
  const fused = new Map<string,{record:Evidence;score:number}>();
  lanes.forEach(lane=>lane.slice(0,60).forEach((candidate,rank)=>{
    const old=fused.get(candidate.record.id);
    fused.set(candidate.record.id,{record:candidate.record,score:(old?.score||0)+1/(30+rank)});
  }));
  const ranked=[...fused.values()].sort((a,b)=>b.score-a.score || a.record.id.localeCompare(b.record.id));
  // Independently rank reviewed policy sources. Long, complete policy decisions
  // must remain reachable beside short historical fragments with repeated titles.
  const governed=(record:Evidence)=>/owner|governed|approved_article/.test(record.sourceKind||"");
  const reviewedLanes=lanes.map(lane=>lane.filter(candidate=>governed(candidate.record)));
  const reviewedScores=new Map<string,{record:Evidence;score:number}>();
  reviewedLanes.forEach(lane=>lane.slice(0,20).forEach((candidate,rank)=>{
    const old=reviewedScores.get(candidate.record.id);
    reviewedScores.set(candidate.record.id,{record:candidate.record,score:(old?.score||0)+1/(30+rank)});
  }));
  for(const candidate of [...reviewedScores.values()].sort((a,b)=>b.score-a.score).slice(0,8)) add(candidate);
  // Preserve the user's direct wording as well as complementary planned queries.
  for(const candidate of lanes[0]?.slice(0,8)||[]) add(candidate);
  for(const candidate of ranked) add(candidate);
  return [...selected.values()];
}
