import {describe,it,expect} from 'vitest';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {safetyL1Decisions,safetyFieldTargets,safetyFindingTargets,applySafetyFieldRepairs}=require('../../scripts/coaching-upgrade/repair-contract.cjs');
const {normalizeObjectionReport,objectionErrors}=require('../../src/lib/objection-coaching.cjs');
const report={version:'objection-coaching-v2',summary:'Supported summary.',show:'Clean and Thriving',strengths:[{observation:'You asked whether a business card could work. When she explained her limits, you did not argue.',evidence_ids:['T0001']}]};
const finding=(before:string)=>({case_id:'c',path:'strengths.0.observation',before,layer:'L2',reason:'Do not praise unsupported payment workarounds.'});
const target=()=>safetyFieldTargets(report,[finding('You asked whether a business card could work.'),finding('When she explained her limits, you did not argue.')]);
const repair=(t:any)=>({id:t.id,path:t.path,before:t.before,operation:'replace_field',after:'When she explained her limits, you did not argue.',reason:'Removed only the unsupported payment workaround praise.'});
describe('shared coaching repair contract',()=>{
 it('repairs overlapping findings once and preserves safe nuance and metadata',()=>{
  const targets=target();expect(targets).toHaveLength(1);expect(targets[0].findings).toHaveLength(2);
  const result=applySafetyFieldRepairs(report,targets,targets.map(repair));
  expect(result.coaching.strengths[0].observation).toBe('When she explained her limits, you did not argue.');
  expect(result.coaching.show).toBe(report.show);expect(result.coaching.strengths[0].evidence_ids).toEqual(['T0001']);
  expect(report.strengths[0].observation).toContain('business card');expect(result.rows[0].applied).toBe(true);
 });
 it('fails closed on omissions, duplicates, unknown IDs, stale before, wrong paths and no-op',()=>{
  const t=target(),r=repair(t[0]);
  for(const rows of [[],[r,r],[{...r,id:'other'}],[{...r,before:'stale'}],[{...r,path:'show'}],[{...r,after:t[0].before}],[{...r,operation:'delete'}]])expect(()=>applySafetyFieldRepairs(report,t,rows)).toThrow('safety hold');
  expect(()=>safetyFieldTargets(report,[{...finding('Clean and Thriving'),path:'show'}])).toThrow('non-prose');
 });
 it('does not turn generic screen approval into clearance of candidates',()=>{
  const hits=[{id:'l1',rule:'certification'}];
  expect(()=>safetyL1Decisions(hits,{case_pass:true})).toThrow('missing');
  expect(safetyL1Decisions(hits,{l1_decisions:[{id:'l1',decision:'retain',reason:'Conditional delivery of the correct agreement, not a policy certification.'}]})).toEqual([]);
  expect(safetyL1Decisions(hits,{l1_decisions:[{id:'l1',decision:'repair',reason:'Claims approval without support.'}]})).toHaveLength(1);
  for(const rows of [[],[{id:'wrong',decision:'retain',reason:'x'}],[{id:'l1',decision:'retain',reason:''}]])expect(()=>safetyL1Decisions(hits,{l1_decisions:rows})).toThrow();
 });
 it('maps exact full prose fields and rejects ambiguous or metadata findings',()=>{
  expect(safetyFindingTargets('c',report,{path:'strengths[0].observation',sentence:'You asked whether a business card could work.'},'unsafe',0)[0].before).toBe(report.strengths[0].observation);
  expect(()=>safetyFindingTargets('c',report,{path:'show',sentence:'Clean and Thriving'},'unsafe',0)).toThrow('non-prose');
  expect(()=>safetyFindingTargets('c',report,{path:'summary',sentence:'Invented quote'},'unsafe',0)).toThrow('does not match');
  expect(()=>safetyFindingTargets('c',{...report,summary:'Same phrase.',no_objections_reason:'Same phrase.'},'Same phrase.','unsafe',0)).toThrow('ambiguous');
 });
 it('preserves extra suggested words in canonical action before safety review, idempotently',()=>{
  const r={...report,objections:[],improvements:[{action:'Use the assets.',suggested_words:'The podcast will help.'}]};
  const n=normalizeObjectionReport(r);
  expect(n.improvements[0].action).toContain('The podcast will help.');expect(n.improvements[0]).not.toHaveProperty('suggested_words');
  expect(normalizeObjectionReport(n)).toEqual(n);expect(r.improvements[0].suggested_words).toBe('The podcast will help.');
  expect(objectionErrors({...n,improvements:[{...n.improvements[0],unknown_advice:'unsafe'}]},undefined,true)).toContain('Unexpected field improvements.0.unknown_advice');
 });
 it('supports root prose repairs without allowing changes to evidence citations',()=>{
  const r={...report,summary:'Unsupported praise [00:01:03].'};
  const t=safetyFieldTargets(r,[{case_id:'c',path:'summary',before:r.summary}]);
  const row={...repair(t[0]),after:'Supported advice [00:01:03].'};
  expect(applySafetyFieldRepairs(r,t,[row]).coaching.summary).toBe(row.after);
  expect(()=>applySafetyFieldRepairs(r,t,[{...row,after:'Supported advice.'}])).toThrow('citation');
 });
});
