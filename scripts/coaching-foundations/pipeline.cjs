// Isolated execution over the same serializable transitions used by the n8n graph.
const record=require('../../src/lib/foundations-record.cjs');
const transition=require('./transition.cjs');
const {documents}=require('./delivery.cjs');
async function run({prepared,call,prompts,provider,store,channel,models}){
 if(store.scope!=='isolated')throw Error('Isolated sink required');
 let state=transition.start({prepared,call,system:prompts.system,models,channel});
 while(state.status==='request')state=transition.advance(state,await provider(state.request));
 if(state.status==='excluded')return {status:'excluded',candidate:state.candidate};
 if(state.status!=='completed')throw Error('Missing terminal outcome');
 const payload=state.payload,artifacts=documents(payload,prepared.sourceId,channel);
 const key=record.digest({sourceId:prepared.sourceId,channel,generation:record.GENERATION,digest:state.candidate.digest});
 const receipt=await store.putOnce(key,{payload,artifacts});
 if(receipt?.key!==key||receipt.digest!==state.candidate.digest)throw Error('Delivery receipt mismatch');
 return {status:'completed',payload,artifacts,receipt};
}
module.exports={run};
