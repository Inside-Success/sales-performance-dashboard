import {expect,it} from 'vitest';
import {buildAnalysisRequest,parseAnalysis,MODELS,CONDITIONS} from '@/lib/script-adherence/model';
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
it('applies one shared condition while preserving only evidenced action exceptions',async()=>{
 const {RUBRICS}=await import('@/lib/script-adherence/rubric');
 const actions=RUBRICS.documentary_call_2.actions.map(a=>({id:a.id,applicability:'yes',reason:'Source evidence',components:a.components.map(()=>({state:'unknown',quote:'',timestamp:''})),playbackFraction:null}));
 const welcome=actions.find(a=>a.id==='welcome')!;
 welcome.components.forEach(c=>Object.assign(c,{state:'deferred',quote:'T0002'}));
 const conditions=Object.fromEntries(CONDITIONS.map((_,i)=>[`condition_${i}`,{state:'no',quote:'T0002',reason:'Not proceeding with the general process yet'}]));
 const raw={...base,currentCallPurpose:'full_offer_presentation',priorPresentationEvidence:'',actions,conditions};
 const result=parseAnalysis(raw,text).analysis;
 expect(result.actions.find(a=>a.id==='welcome')?.applicability).toBe('yes');
 expect(result.actions.find(a=>a.id==='onboarding')?.applicability).toBe('no');
 expect(result.actions.find(a=>a.id==='form')?.components.every(c=>c.state==='not_applicable')).toBe(true);
 expect(result.actions.find(a=>a.id==='welcome')?.components.every(c=>c.state==='deferred')).toBe(true);
 conditions.condition_0.quote='T9999';expect(()=>parseAnalysis({...raw,conditions},text)).toThrow('Unknown evidence');
});
it('allows evidenced non-sales classification without inventing offer-family evidence',()=>{
 const raw={...base,family:'other',stage:'other',attendance:'internal',eligibleForChecklist:false,exclusionReason:'Internal training',familyEvidence:'',stageEvidence:'T0001',currentCallPurpose:'other',priorPresentationEvidence:'',actions:[]};
 expect(parseAnalysis(raw,text).analysis.family).toBe('other');
 expect(()=>parseAnalysis({...raw,stageEvidence:''},text)).toThrow('Missing classification');
 expect(()=>parseAnalysis({...raw,family:'reality'},text)).toThrow('Missing classification');
});
it('limits sibling exemptions to an evidenced false shared condition',async()=>{
 const {RUBRICS}=await import('@/lib/script-adherence/rubric');
 const actions=RUBRICS.documentary_call_2.actions.map(a=>({id:a.id,applicability:'yes',reason:'Observed task',components:a.components.map(()=>({state:'unknown',quote:'',timestamp:''})),playbackFraction:null}));
 const target=actions.find(a=>a.id==='onboarding')!;
 target.components[0]={state:'done',quote:'T0001',timestamp:''};
 target.components[1]={state:'not_applicable',quote:'',timestamp:''};
 const conditions=Object.fromEntries(CONDITIONS.map((_,i)=>[`condition_${i}`,{state:'no',quote:'T0002',reason:'Trigger declined'}]));
 const raw={...base,currentCallPurpose:'full_offer_presentation',priorPresentationEvidence:'',actions,conditions};
 expect(()=>parseAnalysis(raw,text)).not.toThrow();
 for(const c of Object.values(conditions))c.quote='';
 const uncertain=parseAnalysis(raw,text);expect(uncertain.analysis.actions.find(a=>a.id==='onboarding')?.components[1].state).toBe('unknown');expect(uncertain.normalization.uncertainComponents).toContain('onboarding:1');
});

it('conservatively downgrades unsupported omissions without granting completion or playback',async()=>{
 const {RUBRICS}=await import('@/lib/script-adherence/rubric');
 const actions=RUBRICS.reality_call_1.actions.map(a=>({id:a.id,applicability:'yes',reason:'Incomplete source',components:a.components.map(()=>({state:'not_done',quote:'',timestamp:''})),playbackFraction:a.video?0:null}));
 const out=parseAnalysis({...base,family:'reality',stage:'call_1',currentCallPurpose:'first_audition',transcriptComplete:false,actions},text);
 expect(out.analysis.actions.every(a=>a.components.every(c=>c.state==='unknown'))).toBe(true);
 expect(out.analysis.actions.every(a=>a.playbackFraction===null)).toBe(true);
 expect(out.normalization.uncertainComponents.length).toBeGreaterThan(0);
});

it('keeps non-conversation sales stage unknown when no stage evidence exists',()=>{
 const source='[00:01] Rep: Your call has been forwarded to an automated voice messaging system.';
 const raw={...base,family:'unknown',stage:'other',attendance:'outreach',eligibleForChecklist:false,exclusionReason:'Voicemail only',familyEvidence:'',stageEvidence:'',currentCallPurpose:'unknown',priorPresentationEvidence:'',actions:[]};
 const r=parseAnalysis(raw,source);expect(r.analysis.stage).toBe('unknown');expect(r.analysis.actions).toEqual([]);expect(r.normalization.unclassifiedNonConversation).toBe(true);
 expect(()=>parseAnalysis({...raw,attendance:'conversation'},source)).toThrow('Missing classification');
 expect(()=>parseAnalysis({...raw,stage:'call_1'},source)).toThrow('Missing classification');
});
it('separates partial orientation playback from the show-pitch completion rule',()=>{
 const body=JSON.stringify(buildAnalysisRequest('gpt-6.1-terra',text,{title:'',rep:''},{}));
 expect(body).toContain('PLAYBACK EXTENT IS SEPARATE FROM VIDEO IDENTITY');
 expect(body).toContain('Never transfer the show-pitch content lower-bound rule');
});
