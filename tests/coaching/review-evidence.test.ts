import {expect,it} from 'vitest';
const evidence=require('../../scripts/coaching-foundations/review-evidence.cjs');
const {digest}=require('../../src/lib/coaching-canonical.cjs');
const blocks=[
 {id:'T0001',timestamp:'00:12',text:'Buyer: I need my partner to sign. We cannot pay today.'},
 {id:'T0002',timestamp:'00:17',text:'Rep: I will send the updated contract.'},
];
const source={channel:'official',call:{blocks},prepared:{blocks,sourceHash:digest(blocks)}};
const referenced={edits:[{target:'outcome',value:'No payment today',reason:'Buyer declined immediate payment.',evidence_ref:{start:'T0001:1',end:'T0001:2'}}],observation_dispositions:[],coverage_additions:[]};
it('materializes an exact contiguous excerpt from the immutable call',()=>{
 const out=evidence.decode(source,referenced);
 expect(out.issues).toEqual([]);
 expect(out.result.edits[0].source_quote).toEqual({id:'T0001',text:blocks[0].text});
 expect(out.result.edits[0].evidence_ref).toBeUndefined();
 expect(referenced.edits[0].evidence_ref).toEqual({start:'T0001:1',end:'T0001:2'});
});
it('rejects bogus, mixed, cross-block and reversed span selections',()=>{
 for(const ref of [{start:'T0004:1'},{start:'T0001:1',end:'T0002:1'},{start:'T0001:2',end:'T0001:1'},{start:'T0001:1',text:'invented'}]){
  const entry={...referenced.edits[0],evidence_ref:ref};
  expect(evidence.decode(source,{...referenced,edits:[entry]}).issues[0].path).toBe('edits.0');
 }
 expect(()=>evidence.decode({...source,call:{blocks:[blocks[1]]}},referenced)).toThrow('source mismatch');
 expect(()=>evidence.decode({...source,channel:'manual'},referenced)).toThrow('source mismatch');
});
it('repairs only failing evidence slots, preserving judgment and refusing unsupported evidence',()=>{
 const legacy={...referenced,edits:[{...referenced.edits[0],evidence_ref:undefined,source_quote:{id:'T0001',text:'Invented payment commitment'}}]};
 const failed=evidence.decode(source,legacy,{legacy:true});
 const good={path:'edits.0',evidence_ref:{start:'T0001:2'}};
 const fixed=evidence.patchEvidence(source,legacy,failed.issues,[{...good,value:'Changed outcome'}],{legacy:true});
 expect(fixed.edits[0].value).toBe('No payment today');
 expect(fixed.edits[0].source_quote).toEqual({id:'T0001',text:'We cannot pay today.'});
 for(const invalid of [[{...good,evidence_ref:null}],[{...good,path:'edits.1'}],[good,good]]){
  expect(()=>evidence.patchEvidence(source,legacy,failed.issues,invalid,{legacy:true})).toThrow();
 }
});
