import {describe,it,expect} from 'vitest';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {intakeUpdatePayload,intakeUpdatePatch,verifyIntakeUpdate,selectIntakeUpdate}=require('../../scripts/intake-update-recovery/contract.cjs');
const before={'Automation Key':'zoom-pending:account:meeting','Zoom Meeting UUID':'meeting','Meeting ID':'123','Processing Status':'Needs Review','Call #':'Unknown','Manual Review Notes':'Waiting for Zoom audio transcript; no processing has run.','Error Message':'Waiting for Zoom transcript: not available.'};
const wanted={id:'recTest','Automation Key':'zoom:account:meeting:file','Zoom Meeting UUID':'meeting','Recording File ID':'file','Meeting ID':'123','Transcript Google Doc ID':'doc','Meeting Transcript Link':'https://docs.google.com/document/d/doc/edit','Processing Status':'Processed','Call #':'Call 1','Client Name':'Buyer','Error Message':'','Manual Review Notes':before['Manual Review Notes']};
const p=()=>intakeUpdatePayload(wanted,before);
describe('saved Airtable update recovery',()=>{
 it('resumes exact record update, removes stale wait notes and verifies read-back',()=>{
  const patch=intakeUpdatePatch(p(),{id:'recTest',fields:before});
  expect(patch.fields['Processing Status']).toBe('Processed');expect(patch.fields['Manual Review Notes']).toBe('');
  expect(verifyIntakeUpdate(p(),{id:'recTest',fields:{...before,...patch.fields}})).toBe(true);
 });
 it('reconciles an already applied write without repeating it',()=>{
  const fields={...wanted,'Manual Review Notes':''};delete (fields as any).id;
  const result=intakeUpdatePatch(p(),{id:'recTest',fields});
  // Old pending notes must not be restored after a successful recovery.
  expect(result.fields['Manual Review Notes']).not.toBe(before['Manual Review Notes']);expect(result.needs_write).toBe(false);
 });
 it('preserves newer manual metadata and holds identity/document conflicts',()=>{
  const result=intakeUpdatePatch(p(),{id:'recTest',fields:{...before,'Client Name':'Human correction','Manual Review Notes':'Reviewed by owner'}});
  expect(result.fields).not.toHaveProperty('Client Name');expect(result.fields).not.toHaveProperty('Manual Review Notes');
  for(const change of [{'Zoom Meeting UUID':'other'},{'Meeting ID':'other'},{'Automation Key':'zoom:other:meeting:file'},{'Transcript Google Doc ID':'another'},{'Call #':'Call 2+'},{'Processing Status':'Ignored'}])expect(()=>intakeUpdatePatch(p(),{id:'recTest',fields:{...before,...change}})).toThrow();
 });
 it('never accepts missing docs, mismatched recording keys or wrong readbacks',()=>{
  expect(()=>intakeUpdatePayload({...wanted,'Transcript Google Doc ID':''},before)).toThrow();
  expect(()=>intakeUpdatePayload({...wanted,'Recording File ID':'other'},before)).toThrow();
  expect(()=>verifyIntakeUpdate(p(),{id:'recTest',fields:before})).toThrow();
 });
 it('bounds scheduled retries and does not replay held/claimed/finished records',()=>{
  const base={stage:'Update Airtable Record',status:'airtable_update_pending',occurred_at:'2026-11-05T00:00:00Z',message:JSON.stringify({...p(),due_at:'2026-11-05T01:00:00Z'})};
  expect(selectIntakeUpdate([base],Date.parse('2026-11-06'))).toHaveLength(1);
  for(const status of ['intake_recovering','recovered','intake_recovery_failed'])expect(selectIntakeUpdate([{...base,status}],Date.parse('2026-11-06'))).toHaveLength(0);
  expect(selectIntakeUpdate([{...base,message:JSON.stringify({...p(),attempt:3})}],Date.parse('2026-11-06'))).toHaveLength(0);
  expect(selectIntakeUpdate([base],Date.parse('2026-11-04'))).toHaveLength(0);
 });
});

it('treats Airtable canonical ISO dates as the same saved timestamp',()=>{
 const payload=intakeUpdatePayload({...wanted,'Meeting Start Date':'2026-11-05T20:58:52Z'},before);
 const fields={...payload.fields,'Meeting Start Date':'2026-11-05T20:58:52.000Z'};
 expect(intakeUpdatePatch(payload,{id:'recTest',fields}).needs_write).toBe(false);
});
