import {describe,it,expect} from 'vitest';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {guardEnhancedSafetyTargets}=require('../../scripts/coaching-upgrade/safety-prose.cjs');
const {patchFinal,patchPrepare}=require('../../scripts/coaching-upgrade/build-safety-boundary.cjs');
const source=`
const state={coaching_version:'enhanced'},OBJECTION_VERSION='enhanced';
const clone=x=>JSON.parse(JSON.stringify(x));
const scrubSafetyLanguageText=s=>s.replace(/\\bclean\\b/gi,'clear');
const dedupeRepeatedSentencesText=s=>s;
function deterministicFinalCoachingScrub(coaching) {
 const next=clone(coaching);for(const field of Object.keys(next)) {
    if (typeof next[field] !== "string") continue;
    next[field]=scrubSafetyLanguageText(next[field]);
 }return next;
}
const completeCoachingText=s=>s.replace('[show name]','the show');
function completeCoachingValue(value) {
  if (typeof value === 'string') return completeCoachingText(value);
  if (Array.isArray(value)) return value.map(completeCoachingValue);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, completeCoachingValue(child)]));
  return value;
}
return {scrub:deterministicFinalCoachingScrub,complete:completeCoachingValue,state};`;
describe('coaching safety boundary regression',()=>{
 it('accepts numeric bracket notation without permitting metadata edits',()=>{
  const r={version:'objection-coaching-v2'};
  expect(guardEnhancedSafetyTargets(r,{path:'strengths[2].observation'},[{path:'strengths.2.observation'}])).toHaveLength(1);
  for(const path of ['show','objections[0].category','strengths[2].evidence_ids','strengths[-1].observation','strengths[01].observation','strengths["2"].observation','__proto__.observation'])expect(()=>guardEnhancedSafetyTargets(r,{path},[{path:'strengths.2.observation'}])).toThrow('non-prose');
  expect(()=>guardEnhancedSafetyTargets(r,{path:'strengths[2].observation'},[])).toThrow('unmapped');
 });
 it('preserves show names and protected values through both cleanup stages',()=>{
  const r=new Function(patchFinal(source))();
  const report={show:'Clean and Thriving',summary:'A clean question about [show name]',offer_family:'mixed',strengths:[{observation:'Discuss [show name]',evidence_ids:['[show name]']}],not_raised:['cost']};
  const result=r.complete(r.scrub(report));
  expect(result.show).toBe('Clean and Thriving');expect(result.summary).toBe('A clear question about the show');
  expect(result.strengths[0].observation).toBe('Discuss the show');expect(result.strengths[0].evidence_ids).toEqual(['[show name]']);
  expect(report.summary).toContain('clean');
  r.state.coaching_version='legacy';expect(r.scrub(report).show).toBe('clear and Thriving');
 });
 it('refuses to patch an unrecognized workflow',()=>{
  expect(()=>patchFinal('different')).toThrow('anchor drift');expect(()=>patchPrepare('different')).toThrow('Missing safety guard');
 });
});
