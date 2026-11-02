import {expect,it} from 'vitest';
import {buildAnalysisRequest,parseAnalysis,MODELS} from '@/lib/script-adherence/model';
const text='[00:00] Rep: This is a follow-up about your documentary offer.\n[00:03] Buyer: We went through the presentation yesterday; today I have questions.';
const base={family:'documentary',stage:'call_2',attendance:'conversation',show:'Inside Success TV',classificationReason:'Questions on prior presentation',transcriptComplete:true,eligibleForChecklist:true,exclusionReason:'',familyEvidence:'T0001',stageEvidence:'T0002',currentCallPurpose:'questions_after_prior_presentation',priorPresentationEvidence:'T0002',actions:[]};
it('review can correct a draft classification using original source evidence',()=>{
 const v=parseAnalysis(base,text);expect(v.analysis.stage).toBe('followup');expect(v.analysis.show).toBe('');expect(v.classification.stageEvidence).toContain('yesterday');
});
it('rejects invented references and unsupported followup overrides',()=>{
 expect(()=>parseAnalysis({...base,familyEvidence:'T9999'},text)).toThrow('Unknown evidence');
 expect(()=>parseAnalysis({...base,priorPresentationEvidence:''},text)).toThrow('Unproven');
});
it('does not silently accept an unsupported or missing checklist',()=>{
 expect(()=>parseAnalysis({...base,currentCallPurpose:'full_offer_presentation'},text)).toThrow();
});
it.each(MODELS)('includes the same full source and independent review contract for %s',model=>{
 const request=buildAnalysisRequest(model,text,{title:'Unreliable Call 1',rep:'Rep'},{...base,stage:'call_1'});
 const body=JSON.stringify(request);expect(body).toContain('independent factual reviewer');expect(body).toContain('Re-derive attendance');expect(body).toContain('UNTRUSTED DRAFT');expect(body).toContain('today I have questions');expect(body).not.toContain('SOURCE-CHECKED REVIEW FINDINGS');
});
it('holds oversized sources instead of silently truncating',()=>{
 expect(()=>buildAnalysisRequest('gpt-6-luna','[00:00] '+('long source. '.repeat(20000)),{title:'',rep:''})).toThrow('bounded context');
});
it('removes only extraneous known-script actions while still requiring the complete selected checklist',async()=>{
 const {RUBRICS}=await import('@/lib/script-adherence/rubric');
 const actions=RUBRICS.reality_call_1.actions.map(a=>({id:a.id,applicability:'unknown',reason:'Incomplete evidence',components:a.components.map(()=>({state:'unknown',quote:'',timestamp:''})),playbackFraction:null}));
 const raw={...base,family:'reality',stage:'call_1',currentCallPurpose:'first_audition',transcriptComplete:false,actions:[...actions,{id:'research',applicability:'unknown',reason:'Internal',components:[{state:'unknown',quote:'',timestamp:''}],playbackFraction:null}]};
 const result=parseAnalysis(raw,text);expect(result.analysis.actions).toHaveLength(actions.length);expect(result.normalization.droppedActions).toEqual(['research']);
 expect(()=>parseAnalysis({...raw,actions:raw.actions.filter(a=>a.id!=='personality')},text)).toThrow('checklist');
 expect(()=>parseAnalysis({...raw,actions:[...raw.actions,raw.actions[0]]},text)).toThrow('Duplicate');
});
