import {describe,it,expect} from 'vitest';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {safetyScreenContract,safetyDigest,safetyRepairFormat,safetyL1Decisions,safetyFieldTargets,safetyFindingTargets,applySafetyFieldRepairs}=require('../../scripts/coaching-upgrade/repair-contract.cjs');
const {normalizeObjectionReport,objectionErrors}=require('../../src/lib/objection-coaching.cjs');
const validScreen={case_pass:true,unsupported_specifics:[],collisions:[],additional_safety_hits:[]};
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
  for(const rows of [[],[r,r],[{...r,id:'other'}],[{...r,path:'show'}],[{...r,after:t[0].before}],[{...r,operation:'delete'}]])expect(()=>applySafetyFieldRepairs(report,t,rows)).toThrow('safety hold');
  expect(()=>safetyFieldTargets(report,[{...finding('Clean and Thriving'),path:'show'}])).toThrow('non-prose');
 });
 it('binds exact Unicode inputs without relying on model echoes',()=>{for(const input of ['', 'abc','quoted “words”\nnext line','x'.repeat(10000)])expect(safetyDigest(input)).toBe(createHash('sha256').update(input).digest('hex'));const schema=safetyRepairFormat(target()).schema;expect(schema.properties.repairs.minItems).toBe(1);expect(schema.properties.repairs.items.required).not.toContain('before');const changed={...report,strengths:[{observation:'Different state'}]};expect(()=>applySafetyFieldRepairs(changed,target(),target().map(repair))).toThrow('stale');});
 it('does not turn generic screen approval into clearance of candidates',()=>{
  const hits=[{id:'l1',rule:'certification'}];
  expect(()=>safetyL1Decisions(hits,{...validScreen,case_pass:true})).toThrow('missing');
  expect(safetyL1Decisions(hits,{...validScreen,l1_decisions:[{id:'l1',decision:'retain',reason:'Conditional delivery of the correct agreement, not a policy certification.'}]})).toEqual([]);
  expect(safetyL1Decisions(hits,{...validScreen,l1_decisions:[{id:'l1',decision:'repair',reason:'Claims approval without support.'}]})).toHaveLength(1);
  for(const rows of [[],[{id:'wrong',decision:'retain',reason:'x'}],[{id:'l1',decision:'retain',reason:''}]])expect(()=>safetyL1Decisions(hits,{...validScreen,l1_decisions:rows})).toThrow();
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

 it('reviews heading and body together while permitting explicit retention of safe context',()=>{
  const r={...report,strengths:[{title:'Explored funding options',observation:'You asked her to borrow.',why_it_matters:'You listened when she declined.',evidence_ids:['T0001']}]};
  const t=safetyFieldTargets(r,[{case_id:'c',path:'strengths.0.title',before:r.strengths[0].title}]);
  expect(t).toHaveLength(3);expect(t.filter((x:any)=>x.context_only)).toHaveLength(2);
  const rows=t.map((x:any)=>({...repair(x),after:x.path.endsWith('title')?'Respected her response':x.path.endsWith('observation')?'You accepted her answer.':x.before}));
  const out=applySafetyFieldRepairs(r,t,rows);
  expect(out.coaching.strengths[0].observation).not.toContain('borrow');expect(out.coaching.strengths[0].why_it_matters).toBe(r.strengths[0].why_it_matters);
 });
 it('removes only an empty optional example label, preserving substantive advice',()=>{
  const t=target(),r=repair(t[0]);
  for(const separator of ['\n','\\n'])expect(applySafetyFieldRepairs(report,t,[{...r,after:'Keep the supported advice.'+separator+'You could say: '}]).coaching.strengths[0].observation).toBe('Keep the supported advice.');
  expect(applySafetyFieldRepairs(report,t,[{...r,after:'Keep advice.\nYou could say: What matters most?'}]).coaching.strengths[0].observation).toContain('What matters most?');
 });
 it('supports root prose repairs without allowing changes to evidence citations',()=>{
  const r={...report,summary:'Unsupported praise [00:01:03].'};
  const t=safetyFieldTargets(r,[{case_id:'c',path:'summary',before:r.summary}]);
  const row={...repair(t[0]),after:'Supported advice [00:01:03].'};
  expect(applySafetyFieldRepairs(r,t,[row]).coaching.summary).toBe(row.after);
  expect(()=>applySafetyFieldRepairs(r,t,[{...row,after:'Supported advice.'}])).toThrow('citation');
 });
});

describe('empty safety adjudication regression',()=>{
 it('accepts absent decisions only for zero candidates, for cached and fresh responses',()=>{
  expect(safetyL1Decisions([],{...validScreen,case_pass:true})).toEqual([]);
  expect(safetyL1Decisions([],{...validScreen,case_pass:true,l1_decisions:[]})).toEqual([]);
  for(const value of [null,{},'',false,[{id:'unexpected',decision:'retain',reason:'x'}]])expect(()=>safetyL1Decisions([],{...validScreen,l1_decisions:value})).toThrow();
  expect(()=>safetyL1Decisions([{id:'real'}],{...validScreen,case_pass:true})).toThrow();
 });
 it('does not clear substantive L2 findings just because L1 is empty',()=>{
  const screen={...validScreen,case_pass:false,additional_safety_hits:[{path:'summary',sentence:'Supported summary.'}]};
  const targets=[...safetyL1Decisions([],screen),...screen.additional_safety_hits.flatMap((f,i)=>safetyFindingTargets('c',report,f,'unsafe',i))];
  expect(safetyFieldTargets(report,targets)).toHaveLength(1);
 });
 it('uses one complete response example and puts adjudication before source data',()=>{
  const old='{"case_pass":true,"unsupported_specifics":[],"collisions":[],"additional_safety_hits":[],"rationale":""}';
  const p=safetyScreenContract('Return '+old+'\nTRANSCRIPT: buyer words');
  expect(p).not.toContain(old);expect(p).toContain('"l1_decisions":[]');
  expect(p.indexOf('For EVERY L1')).toBeLessThan(p.indexOf('TRANSCRIPT:'));
  expect(()=>safetyScreenContract('different contract')).toThrow('drift');
 });
});

it('does not treat a failed or malformed manual safety screen as an empty pass',()=>{
 for(const screen of [{},null,{case_pass:true},{...validScreen,collisions:null},{...validScreen,case_pass:'true'}])expect(()=>safetyL1Decisions([],screen)).toThrow('invalid safety screen');
});
