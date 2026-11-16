import {it,expect} from 'vitest';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{validateProgress}=require('../../scripts/coaching-foundations/progress.cjs'),r=require('../../src/lib/foundations-record.cjs'),t=require('../../scripts/coaching-foundations/transition.cjs');
it('retains only source-bound resumable state and rejects edited source/request',()=>{
 const blocks=[{id:'T1',text:'Buyer: Please send the agreement.'}],prepared=r.prepare({sourceId:'recA',policyRevision:'p',policyText:'facts',blocks});
 const state=t.start({prepared,call:{blocks,metadata:{}},system:'facts',models:{writer:'w'},channel:'official'});
 expect(validateProgress({state,execution_id:'123'}).source_id).toBe('recA');
 expect(()=>validateProgress({state:{...state,request:{...state.request,prompt:'changed'}},execution_id:'123'})).toThrow();
 expect(()=>validateProgress({state:{...state,prepared:{...prepared,blocks:[]}},execution_id:'123'})).toThrow();
});
