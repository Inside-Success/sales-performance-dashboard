// Isolated, dependency-injected execution path. No production client or publisher.
const record=require('../../src/lib/foundations-record.cjs');
const safety=require('./safety.cjs');const {documents}=require('./delivery.cjs');
async function run({prepared,call,prompts,provider,store,channel,models}){
 if(!['official','manual'].includes(channel)||store.scope!=='isolated')throw Error('Isolated sink required');
 // Source identity and prompt revision bind receipts; channel has no effect on coaching judgment.
 async function request(stage,model,body){
  const id=record.digest({source:prepared.sourceHash,sourceId:prepared.sourceId,policy:prepared.policyHash,stage,model,...body});
  const response=await provider({request_id:id,case_id:prepared.sourceId,stage,model,...body});
  if(response.request_id!==id)throw Error('Provider identity mismatch');return {id,response};
 }
 const w=await request('writer',models.writer,{system:prompts.system,prompt:prompts.prompt(call,'coach')});
 let r=await request('reviewer',models.reviewer,{system:prompts.system,prompt:prompts.prompt(call,'review',w.response.parsed_json)});
 let candidate;
 try{candidate=record.accept({prepared,draftResponse:w.response,draftRequestId:w.id,reviewResponse:r.response,reviewRequestId:r.id});}
 catch(error){
  // Only a returned, complete review object may receive one explicit contract repair.
  // Transport uncertainty and unusable writer receipts must remain held, never replayed.
  const contract=require('../../src/lib/foundations-contract.cjs');
  contract.validate(w.response.parsed_json,prepared.blocks);
  if(r.response.ok!==true||!r.response.provider_response_id||!r.response.parsed_json||['length','max_tokens','refusal'].includes(r.response.stop_reason)||/receipt|misaligned/i.test(error.message))throw error;
  r=await request('review-contract-repair',models.reviewer,{system:prompts.system,prompt:prompts.prompt(call,'review',w.response.parsed_json)+'\nThe previous complete review was held for a contract error. Return one complete valid review envelope; do not weaken the factual standard or invent evidence. Error: '+error.message+'\nPREVIOUS UNTRUSTED REVIEW:\n'+JSON.stringify(r.response.parsed_json)});
  candidate=record.accept({prepared,draftResponse:w.response,draftRequestId:w.id,reviewResponse:r.response,reviewRequestId:r.id});
 }
 if(candidate.report.status==='excluded')return {status:'excluded',candidate};
 for(let attempt=0;attempt<2;attempt++){
  const s=await request('safety',models.safety,safety.safetyRequest(candidate));
  const result=safety.assess(candidate,s.response,s.id);candidate=result.candidate;
  if(!result.findings.length){
   const payload=record.publish(candidate,{sourceId:prepared.sourceId,channel});
   const artifacts=documents(payload,prepared.sourceId,channel);
   const key=record.digest({sourceId:prepared.sourceId,channel,generation:record.GENERATION,digest:candidate.digest});
   const receipt=await store.putOnce(key,{payload,artifacts});
   if(receipt?.key!==key||receipt.digest!==candidate.digest)throw Error('Delivery receipt mismatch');
   return {status:'completed',payload,artifacts,receipt};
  }
  if(attempt===1)throw Error('Safety remains held after one repair');
  const fix=await request('safety-repair',models.reviewer,safety.repairRequest(candidate,result.findings));
  candidate=safety.apply(candidate,result.findings,fix.response,fix.id);
 }
 throw Error('Missing terminal outcome');
}
module.exports={run};
