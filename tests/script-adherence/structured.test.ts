import {expect,it} from 'vitest';
import {extractionSchema} from '../../src/lib/script-adherence/structured';
import {RUBRICS} from '../../src/lib/script-adherence/rubric';
import {resultSchema,scriptFor} from '../../src/lib/script-adherence/contract';
it('requires every exact action and component and rejects fabricated evidence IDs',()=>{
 const actions=Object.fromEntries(RUBRICS.reality_call_1.actions.map(a=>[a.id,{applicability:'yes',reason:'',components:Object.fromEntries(a.components.map((_,i)=>[`part_${i+1}`,{state:'unknown',quote:'',timestamp:''}])),...(a.video?{playbackFraction:null}:{})}]));
 const schema=extractionSchema('reality_call_1',['','T0001']);expect(schema.safeParse({actions}).success).toBe(true);
 const bad=structuredClone(actions);bad.consent.components.part_1.quote='T9999';expect(schema.safeParse({actions:bad}).success).toBe(false);
 const missing=structuredClone(actions);delete missing.consent;expect(schema.safeParse({actions:missing}).success).toBe(false);
});
it('keeps outreach visible but outside sales-script scoring',()=>{const r=resultSchema.parse({family:'unknown',stage:'other',attendance:'outreach',show:'',classificationReason:'Outbound voicemails only',transcriptComplete:true,eligibleForChecklist:false,actions:[]});expect(scriptFor(r)).toBeNull();});
it('shares evidence enums so realistic transcripts stay within the provider schema limit',async()=>{
 const {z}=await import('zod');const ids=['',...Array.from({length:500},(_,i)=>`T${i}`)] as [string,...string[]];
 const schema=z.toJSONSchema(extractionSchema('documentary_call_2',ids),{reused:'ref'});
 const count=(x:unknown):number=>Array.isArray(x)?x.reduce((n,y)=>n+count(y),0):x&&typeof x==='object'?Object.entries(x).reduce((n,[k,y])=>n+(k==='enum'?(y as unknown[]).length:count(y)),0):0;
 expect(count(schema)).toBeLessThanOrEqual(1000);
});
