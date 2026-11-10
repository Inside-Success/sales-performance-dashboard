import {expect,it} from 'vitest';
import {LEGACY_VERSION,UPDATED_VERSION,rubricsFor,requestVersion,selectVersion} from '@/lib/script-adherence/versions';
import {scriptFor,validateAnalysis,actionStatus} from '@/lib/script-adherence/contract';
import {buildAnalysisRequest} from '@/lib/script-adherence/model';
import {fitsContext,inputTokenEstimate} from '@/lib/script-adherence/context';
import {sourceText,sourceHash} from '@/lib/script-adherence/source-watch';
const classification={family:'reality' as const,stage:'call_2' as const,attendance:'conversation' as const,show:'Mansion of Money',classificationReason:'Live offer',transcriptComplete:true,eligibleForChecklist:true,exclusionReason:'',actions:[]};
it('keeps old Reality Call 2 unscored and changes only calls starting at or after activation',()=>{
 expect(scriptFor(classification,LEGACY_VERSION)).toBeNull();expect(scriptFor(classification,UPDATED_VERSION)).toBe('reality_call_2');
 const activation='2026-11-10T16:00:00Z';
 expect(selectVersion('2026-11-10T15:59:59Z',activation,UPDATED_VERSION)).toBe(LEGACY_VERSION);
 expect(selectVersion(activation,activation,UPDATED_VERSION)).toBe(UPDATED_VERSION);
 expect(selectVersion(activation,null,null)).toBe(LEGACY_VERSION);
 expect(()=>selectVersion('broken',activation,UPDATED_VERSION)).toThrow();
 expect(()=>rubricsFor('unknown')).toThrow();
});
it('pins both paid stages to the requested version and rejects an unversioned request',()=>{
 for(const v of [LEGACY_VERSION,UPDATED_VERSION])for(const draft of [undefined,{}])expect(requestVersion(buildAnalysisRequest('gpt-6.1-terra','[00:01] Rep: Hello',{title:'',rep:'',rubricVersion:v},draft))).toBe(v);
 expect(()=>requestVersion({})).toThrow();
});
it('preserves old component wording and validates exactly the new Call 2 checklist',()=>{
 expect(rubricsFor(LEGACY_VERSION).reality_call_1!.actions.find(a=>a.id==='financial_fit')!.components[0]).toBe('Explains approximate investment');
 expect(rubricsFor(UPDATED_VERSION).reality_call_1!.actions.find(a=>a.id==='financial_fit')!.components[0]).not.toContain('investment');
 const defs=rubricsFor(UPDATED_VERSION).reality_call_2!.actions;
 const r={...classification,actions:defs.map(a=>({id:a.id,applicability:'yes' as const,reason:'Complete source',components:a.components.map(()=>({state:'not_done' as const,quote:'',timestamp:''})),playbackFraction:a.video?0:null}))};
 expect(()=>validateAnalysis(r,'[00:01] Rep: Hello',new Set(),UPDATED_VERSION)).not.toThrow();
 expect(()=>validateAnalysis(r,'[00:01] Rep: Hello',new Set(),LEGACY_VERSION)).toThrow();
 expect(()=>validateAnalysis({...r,actions:r.actions.slice(1)},'',new Set(),UPDATED_VERSION)).toThrow();
 const part=r.actions.find(a=>a.id==='terms')!;Object.assign(part.components[0],{state:'done',quote:'Rep: Hello',timestamp:'00:01'});
 expect(actionStatus(r,'terms',undefined,UPDATED_VERSION)).toBe('Complete');
 expect(defs.filter(a=>a.video).map(a=>a.label)).toEqual(['Video 1 — License','Video 2 — Contract review (when needed)']);
 expect(defs.find(a=>a.id==='video_2')!.when).toContain('requests or accepts');
 expect(defs.some(a=>/stay|stamina|both motivations/i.test(a.label))).toBe(false);
});
it('allows long full sources with conservative token headroom and holds genuinely excessive input',()=>{
 const source='[00:01] Rep: '+('This is a complete long conversation with speaker evidence. '.repeat(4100));
 const request=buildAnalysisRequest('gpt-6.1-terra',source,{title:'',rep:'',rubricVersion:UPDATED_VERSION});
 expect(request.messages!.at(-1)!.content).toContain('speaker evidence.');
 expect(inputTokenEstimate(JSON.stringify(request))).toBeLessThan(100000);
 expect(fitsContext('gpt-6.1-terra','abc '.repeat(250000))).toBe(false);
});
it('detects text and link changes but ignores styling and non-script tabs',()=>{
 const body=(text:string,url='https://example.com')=>({content:[{paragraph:{elements:[{textRun:{content:text,textStyle:{bold:true,link:{url}}}}]}}]});
 const text='This is approved script text. '.repeat(10);
 const d={tabs:[{tabProperties:{tabId:'t.0'},documentTab:{body:body(text)}},{tabProperties:{tabId:'notes'},documentTab:{body:body('notes')}}]};
 const original=sourceHash(sourceText(d,'t.0'));
 d.tabs[0].documentTab.body.content[0].paragraph.elements[0].textRun.textStyle.bold=false;
 expect(sourceHash(sourceText(d,'t.0'))).toBe(original);
 d.tabs[1].documentTab.body=body('different commentary');expect(sourceHash(sourceText(d,'t.0'))).toBe(original);
 d.tabs[0].documentTab.body=body(text,'https://changed.com');expect(sourceHash(sourceText(d,'t.0'))).not.toBe(original);
 expect(()=>sourceText(d,'missing')).toThrow();
});
