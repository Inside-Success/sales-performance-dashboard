import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
const source=(name:string)=>readFileSync(join(process.cwd(),'n8n/call2-score-v2',name+'.js'),'utf8');
const apply=new Function('draft','review','transcript','claims',source('factual-review-core')+'\nreturn applyFactualReview(draft,review,transcript,claims);');
const path='/manager_score/dimensions/frame_and_control/reason';
const transcript='[00:01:00.000] Rep: I can call tomorrow at five.\n[00:01:10.000] Client: Friday at five works better for me.';
const draft={manager_score:{dimensions:{frame_and_control:{band:'adequate',reason:'No follow-up was proposed.',evidence:{timestamp:'00:01:00.000',quote:'I can call tomorrow at five'},counterevidence:[]}}},rudys_note:'Compatibility content stays unchanged.'};
const claims=[{id:'frame_and_control',path,text:'No follow-up was proposed.'}];
const corrected=()=>({checks:[{claim_id:'frame_and_control',status:'correction_required',explanation:'Rep proposed a follow-up.',finding_ids:['F1']}],verdict:'corrected',findings:[{id:'F1',problem:'The proposal was overlooked.',source_evidence:[{timestamp:'00:01:00.000',quote:'I can call tomorrow at five'}],affected_paths:[path],retracted_phrases:['No follow-up was proposed']}],patches:[{path,value:'The rep proposed a follow-up; the client selected Friday.',finding_ids:['F1'],reason:'Restore the observed proposal.'}],summary:'Corrected the missed proposal.'});
describe('bounded factual review',()=>{
 it('corrects supported facts without mutating inputs or compatibility content',()=>{const original=JSON.stringify(draft);const r=apply(draft,corrected(),transcript,claims);expect(r.ok).toBe(true);expect(r.draft.manager_score.dimensions.frame_and_control.band).toBe('adequate');expect(r.draft.rudys_note).toBe(draft.rudys_note);expect(JSON.stringify(draft)).toBe(original);});
 it('accepts an explicit complete approval without changing the draft',()=>{const r=apply(draft,{verdict:'approved',findings:[],patches:[],summary:'Supported',checks:[{claim_id:'frame_and_control',status:'supported',explanation:'Reviewed',finding_ids:[]}]},transcript,claims);expect(r.ok).toBe(true);expect(r.draft).toEqual(draft);});
 it('withholds when a scorer claim was not checked',()=>{const r=corrected();r.checks=[];expect(apply(draft,r,transcript,claims).reason).toBe('incomplete_claim_review');});
 it('rejects an invented supporting quote',()=>{const r=corrected();r.findings[0].source_evidence[0].quote='I received the entire payment today';expect(apply(draft,r,transcript,claims).reason).toBe('ungrounded_review_finding');});
 it('rejects a correction that repeats its retracted claim',()=>{const r=corrected();r.patches[0].value='No follow-up was proposed. Another sentence follows.';expect(apply(draft,r,transcript,claims).reason).toBe('retracted_claim_survived');});
 it('rejects findings that were identified but never applied',()=>{const r=corrected();r.findings[0].affected_paths.push('/manager_score/dimensions/frame_and_control/band');expect(apply(draft,r,transcript,claims).reason).toBe('unapplied_finding');});
 it.each(['/manager_score/score','/__proto__/polluted','/rudys_note','/manager_score/weights'])('forbids model changes to %s',bad=>{const r=corrected();r.patches[0].path=bad;expect(apply(draft,r,transcript,claims).ok).toBe(false);expect(({} as Record<string,unknown>).polluted).toBeUndefined();});
 it('rejects an unresolved claim instead of accepting a partial approval',()=>{const r=corrected();r.checks[0].status='uncertain';expect(apply(draft,r,transcript,claims).reason).toBe('unresolved_claim');});
 it('keeps numeric computation in the same validator after editing',()=>{expect(source('apply-factual-review')).toContain(source('validate-evidence-compute-manager-score').trim());});
 it('withholds a validated numeric result if its reviewable draft is missing',()=>{
  const original={validation:{valid:true},current_call_score:{eligible:true,score:76},manager_snapshot:{latest_execution_score:76}};
  const run=new Function('$input','$',source('build-factual-review'));
  const result=run({all:()=>[{json:original}]},(name:string)=>({all:()=>[{json:name==='Build Analysis Request'?{}:{ok:true,model_text:'unparseable'}}]}))[0].json;
  expect(result.__factual_review_required).toBe(false);
  expect(result.final_result.current_call_score.eligible).toBe(false);
  expect(result.final_result.current_call_score.score).toBeUndefined();
  expect(result.final_result.manager_snapshot).toBeUndefined();
  expect(result.final_result.validation.errors).toEqual(['factual_review:missing_reviewable_draft']);
 });
 it('does not send an already-invalid primary result to another paid review',()=>{
  const original={validation:{valid:false},current_call_score:{eligible:false,reason:'invalid_source'}};
  const run=new Function('$input','$',source('build-factual-review'));
  const result=run({all:()=>[{json:original}]},()=>({all:()=>[{json:{}}]}))[0].json;
  expect(result.__factual_review_required).toBe(false);
  expect(result.final_result).toEqual(original);
 });
 it('refuses multiple calls rather than mixing review state',()=>{
  const run=new Function('$input','$',source('build-factual-review'));
  expect(()=>run({all:()=>[{json:{}},{json:{}}]},()=>{})).toThrow('Expected one scoring input');
 });
});
