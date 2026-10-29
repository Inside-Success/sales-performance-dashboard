import {describe,it,expect} from 'vitest';
import {coveragePlan} from '../../src/lib/coaching-reliability-policy.mjs';
import {writeFailureReceipt,buildReconciliation} from '../../scripts/n8n/build-coverage-reconciliation.mjs';
describe('coverage reconciliation',()=>{
 const scan={status:'ready',token:'t',source_ids:['recDuplicate'],source_aliases:[{source_id:'recDuplicate',canonical_source_id:'recOriginal'}]};
 it('accounts for an exact recording alias only with an excluded canonical receipt',()=>{
  expect(coveragePlan(scan,[{source_id:'recOriginal',status:'excluded'}])!.missing_ids).toEqual([]);
 });
 it.each(['delivered','processing','queued','needs_review','existing_report'])('does not clear an alias from %s alone',status=>{
  expect(coveragePlan(scan,[{source_id:'recOriginal',status}])!.missing_ids).toEqual(['recDuplicate']);
 });
 it('does not infer an exclusion from an unrelated receipt',()=>{
  expect(coveragePlan(scan,[{source_id:'recOther',status:'excluded'}])!.missing_ids).toEqual(['recDuplicate']);
 });
 it('holds ambiguous writes instead of retrying and retains source ownership evidence',()=>{
  expect(writeFailureReceipt('recReal','123',{error_details:'Service unavailable'})).toMatchObject({source_id:'recReal',execution_id:'123',status:'needs_review',attempts:0});
  expect(()=>writeFailureReceipt('','123',{})).toThrow();
 });
});

it('persists and settles the write hold before continuing the existing alert loop',()=>{
 const template={nodes:[{name:'MM Save Unfinished Coaching',parameters:{}},{name:'MM Settle Source Claim',parameters:{}}]};
 const ops=buildReconciliation(template,{}).official;
 expect(ops).toContainEqual({type:'rewireConnection',source:'Set: airtable_failed',from:'Build Ops Alert',to:'MM Record Scorecard Write Failure'});
 for(const [source,target] of [['MM Record Scorecard Write Failure','MM Save Scorecard Write Failure'],['MM Save Scorecard Write Failure','MM Settle Scorecard Hold'],['MM Settle Scorecard Hold','MM Restore Scorecard Alert'],['MM Restore Scorecard Alert','Build Ops Alert']])expect(ops).toContainEqual({type:'addConnection',source,target});
 for(const source of ['MM Record Scorecard Write Failure','MM Save Scorecard Write Failure','MM Settle Scorecard Hold'])expect(ops).toContainEqual({type:'addConnection',source,target:'MM Accounting Incident',sourceIndex:1});
});
