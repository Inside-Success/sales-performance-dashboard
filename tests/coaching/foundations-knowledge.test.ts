import {describe,it,expect} from 'vitest';
const k=require('../../scripts/coaching-foundations/knowledge.cjs');
const {digest}=require('../../src/lib/coaching-canonical.cjs');
const transition=require('../../scripts/coaching-foundations/transition.cjs');
const record=require('../../src/lib/foundations-record.cjs');
const layer=(id:string,text:string)=>({id,text,digest:digest(text),revision:'approved-v1',source:'approved/'+id});
const layers=[layer('governed-offer-policy','Scoped offer facts'),layer('november-source-updates','Approved newer offer facts')];
const source='Tyler philosophy\n'+layers.map(x=>x.text).join('\n')+'\nReport contract';
const runtime={source:'live_fetch_node',doc_id:k.CONTEXT_DOC,text:'General context and facts. '.repeat(10),fetched_at:'2026-11-09T12:00:00Z'};
describe('governed knowledge binding',()=>{
 it('keeps philosophy unchanged while identifying every fact source and precedence',()=>{const t=k.template(source,layers),b=k.bind(t,runtime);expect(t.foundation).toContain('Tyler philosophy');expect(t.foundation).not.toContain('Scoped offer facts');expect(b.manifest.precedence).toEqual(['november-source-updates','governed-offer-policy','runtime-context']);expect(b.system).toContain(runtime.text);expect(b.system).toContain('not a rule effective date');});
 it('propagates a changed approved fact to both agent systems without reusing the old request',()=>{const t=k.template(source,layers),a=k.bind(t,runtime),b=k.bind(t,{...runtime,text:runtime.text+' Newly approved general fact.'});const blocks=[{id:'T1',text:'I want to review the offer.'}];const start=(x:any)=>transition.start({prepared:record.prepare({sourceId:'recTest',policyRevision:x.revision,policyText:x.system,blocks}),call:{metadata:{},blocks},system:x.system,models:{writer:'sonnet',reviewer:'terra',safety:'deepseek'},channel:'official'});expect(start(a).request.request_id).not.toEqual(start(b).request.request_id);expect(start(b).request.system).toEqual(b.system);expect(b.manifest.foundation_hash).toEqual(a.manifest.foundation_hash);});
 it('does not invalidate request identity just because an unchanged source was fetched again',()=>{const t=k.template(source,layers);expect(k.bind(t,runtime)).toEqual(k.bind(t,{...runtime,fetched_at:'2026-11-10T00:00:00Z'}));});
 it('rejects missing, substituted or tampered sources instead of silently using old facts',()=>{const t=k.template(source,layers);expect(()=>k.bind(t,null)).toThrow();expect(()=>k.bind(t,{...runtime,doc_id:'other'})).toThrow();t.layers[0].text+=' changed';expect(()=>k.bind(t,runtime)).toThrow('digest');});
 it('replaces an approved overlay as one version rather than stacking conflicting revisions',()=>{const a=k.template(source,layers);const newer=[layers[0],layer('november-source-updates','Replacement approved offer facts')];const b=k.template(source.replace(layers[1].text,newer[1].text),newer);expect(a.foundation).toEqual(b.foundation);const bound=k.bind(b,runtime);expect(bound.system).toContain('Replacement approved offer facts');expect(bound.system).not.toContain('Approved newer offer facts');});
});
