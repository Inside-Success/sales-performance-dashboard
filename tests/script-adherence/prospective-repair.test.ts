import {expect,it} from 'vitest';
import {buildAnalysisRequest,parseAnalysis} from '@/lib/script-adherence/model';
import {summarize,type Analysis} from '@/lib/script-adherence/contract';
import {CURRENT_VERSION,LEGACY_VERSION,UPDATED_VERSION,rubricsFor,selectVersion} from '@/lib/script-adherence/versions';

const transcript='[00:01] Rep: This is your Mansion of Money casting offer.\n[00:02] Buyer: I cannot pay today.\n[00:03] Rep: We can have another sales call later.';
const absent={state:'not_applicable',quote:'',timestamp:''};
const unknown={state:'unknown',quote:'',timestamp:''};

function receipt(condition:'yes'|'no',support:unknown,source='T0002'){
 const defs=rubricsFor(UPDATED_VERSION).reality_call_2!.actions;
 const request=buildAnalysisRequest('gpt-6.1-terra',transcript,{title:'',rep:'Rep',rubricVersion:UPDATED_VERSION});
 const prompt=request.messages[0].content;
 const keys=JSON.parse(prompt.match(/CONDITION KEYS: (\{[^\n]+?\})\./)![1]) as Record<string,string>;
 const conditions=Object.fromEntries(Object.entries(keys).map(([key,value])=>[key,
  value.startsWith('Payment is confirmed')?{state:condition,quote:source,reason:'Payment discussed'}:{state:'unknown',quote:'',reason:'Not established'}]));
 return {family:'reality',stage:'call_2',attendance:'conversation',show:'Mansion of Money',classificationReason:'Casting offer',
  transcriptComplete:false,eligibleForChecklist:true,exclusionReason:'',familyEvidence:'T0001',stageEvidence:'T0001',
  currentCallPurpose:'full_offer_presentation',priorPresentationEvidence:'',conditions,
  actions:defs.map(def=>({id:def.id,applicability:def.id==='support'&&condition==='no'?'no':'yes',reason:'Checked source',
   components:def.id==='support'?support:def.components.map(()=>unknown),playbackFraction:null}))};
}

it('recovers the exact legacy omission only when non-applicability has source evidence',()=>{
 const result=parseAnalysis(receipt('no',[absent]),transcript,UPDATED_VERSION);
 expect(result.analysis.actions.find(action=>action.id==='support')?.components).toEqual([absent,absent]);
 expect(()=>parseAnalysis(receipt('no',[absent],''),transcript,UPDATED_VERSION)).toThrow(/support expects 2/);
 expect(()=>parseAnalysis(receipt('yes',[unknown]),transcript,UPDATED_VERSION)).toThrow(/support expects 2/);
});

it('requires both named support fields on newly written results and keeps uncertain parts distinct',()=>{
 const body=buildAnalysisRequest('gpt-6.1-terra',transcript,{title:'',rep:'Rep',rubricVersion:CURRENT_VERSION},{});
 const schema=JSON.stringify(body.response_format);
 expect(schema).toContain('"required":["support_email","production_questions"]');
 expect(()=>parseAnalysis(receipt('yes',{support_email:unknown}),transcript,UPDATED_VERSION)).toThrow();
 const twoParts={support_email:unknown,production_questions:{state:'done',quote:'T0003',timestamp:''}};
 const result=parseAnalysis(receipt('yes',twoParts),transcript,UPDATED_VERSION);
 expect(result.analysis.actions.find(action=>action.id==='support')?.components.map(item=>item.state)).toEqual(['unknown','done']);
});

it('preserves earlier versions and keeps price observations out of adherence percentages',()=>{
 const activation='2026-11-20T23:00:00Z';
 expect(selectVersion('2026-11-09T23:00:00Z',activation,CURRENT_VERSION)).toBe(LEGACY_VERSION);
 expect(selectVersion('2026-11-19T23:00:00Z',activation,CURRENT_VERSION)).toBe(UPDATED_VERSION);
 expect(selectVersion(activation,activation,CURRENT_VERSION)).toBe(CURRENT_VERSION);
 const result={family:'documentary',stage:'call_1',attendance:'conversation',actions:[
  {id:'knowledge',applicability:'yes',components:[{state:'not_done'}]},
  {id:'price_quoted',applicability:'yes',components:[{state:'done'}]},
 ]} as Analysis;
 expect(summarize([result],[activation],[CURRENT_VERSION])).toMatchObject({complete:0,notComplete:1,assessed:1});
 expect(rubricsFor(UPDATED_VERSION).documentary_call_1!.actions.map(action=>action.id)).not.toContain('price_quoted');
 expect(rubricsFor(CURRENT_VERSION).reality_call_1!.actions.find(action=>action.id==='video_1')?.when).toContain('opportunity');
});
