import {describe,it,expect} from 'vitest';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {enhancedSafetyProsePath,guardEnhancedSafetyTargets}=require('../../scripts/coaching-upgrade/safety-prose.cjs');
const {patchSafetyProse}=require('../../scripts/coaching-upgrade/build-safety-prose.cjs');
const original=`
function normalize(x){return String(x).toLowerCase();}
function getByPath(x,p){return p.split('.').reduce((a,k)=>a?.[k],x);}
function flattenStrings(value,path=[]){if(typeof value==='string')return [{path:path.join('.'),value}];if(value&&typeof value==='object')return Object.entries(value).flatMap(([k,v])=>flattenStrings(v,[...path,k]));return [];}
function splitSentences(s){return s.split(/(?<=\\.)\\s+/);}
function coachingSentences(coaching) { return flattenStrings(coaching).flatMap(leaf=>splitSentences(leaf.value).map(sentence=>({path:leaf.path,sentence}))); }
function mapScreenItemToTarget(caseId, coaching, item, prefix, index) {
 const raw=typeof item==='string'?{sentence:item}:item;
 const text=normalize(raw.sentence||'');
 let rows=text?coachingSentences(coaching).filter(row=>text.includes(normalize(row.sentence))||normalize(row.sentence).includes(text)):[];
 if(!rows.length&&raw.path){const value=getByPath(coaching,raw.path);if(typeof value==='string')rows=[{path:raw.path,sentence:value}];}
 return rows;
}
return {sentences:coachingSentences,targets:mapScreenItemToTarget};`;
const runtime=()=>new Function(patchSafetyProse(original,true))();
const report={version:'objection-coaching-v2',show:'Women In Power',offer_family:'main_istv',not_raised:['cost'],next_steps:[{kind:'recommended',observation:'Ask what she wants a Women In Power episode to do for her. Explain the one-day format.',evidence_ids:['T0001']}]};
describe('safety repair prose boundary',()=>{
 it('does not target show identity merely because a longer flagged recommendation includes it',()=>{
  const r=runtime();const targets=r.targets('recExample',report,'next_steps.3.observation: '+report.next_steps[0].observation,'unsupported',0);
  expect(targets).toHaveLength(2);expect(targets.every((t:{path:string})=>t.path==='next_steps.0.observation')).toBe(true);
  expect(r.targets('recExample',report,'Finding: '+report.next_steps[0].observation,'unsupported',0)).toEqual(targets);
  expect(r.sentences(report).map((t:{path:string})=>t.path)).toEqual(['next_steps.0.observation','next_steps.0.observation']);
 });
 it('holds explicit metadata and unmappable findings instead of silently dropping safety findings',()=>{
  const r=runtime();
  expect(()=>r.targets('recExample',report,{path:'show',sentence:'Women In Power'},'unsupported',0)).toThrow('non-prose');
  expect(()=>r.targets('recExample',report,'show: Women In Power','unsupported',0)).toThrow('non-prose');
  expect(()=>r.targets('recExample',report,'No matching content exists here','unsupported',0)).toThrow('unmapped');
 });
 it('includes substantive coaching fields but excludes categorical labels and evidence paths',()=>{
  for(const path of ['summary','outcome.summary','objections.0.response','objections.2.assessment','improvements.0.action','strengths.0.observation','next_steps.0.observation'])expect(enhancedSafetyProsePath(path)).toBe(true);
  for(const path of ['show','version','offer_family','evidence_quality','outcome.payment','objections.0.category','objections.0.handling','objections.0.evidence_ids.0','next_steps.0.kind','provenance.policy_text'])expect(enhancedSafetyProsePath(path)).toBe(false);
 });
 it('preserves legacy behavior and fails closed on builder drift',()=>{
  expect(runtime().targets('recExample',{show:'Women In Power'},'Women In Power','unsupported',0)).toEqual([{path:'show',sentence:'Women In Power'}]);
  expect(guardEnhancedSafetyTargets({},'unmatched',[])).toEqual([]);
  expect(()=>patchSafetyProse('changed upstream code')).toThrow('anchor drift');
 });
});
