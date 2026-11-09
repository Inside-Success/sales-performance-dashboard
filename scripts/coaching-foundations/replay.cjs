// CLI reads private saved evidence. It deliberately has no provider or delivery client.
const fs=require('node:fs'),path=require('node:path');
const a=require('./integration.cjs'),contract=require('../../src/lib/foundations-contract.cjs');
function replay(result,c){
 if(result.source_hash!==c.transcript_hash)throw Error('Source hash mismatch');
 contract.validate(result.final,c.blocks);
 const prepared=a.prepare({sourceId:'offline:'+c.id,policyRevision:result.system_hash,policyText:'Offline replay only; production policy binding is not attested.',blocks:c.blocks});
 const r=(request_id,parsed_json)=>({ok:true,request_id,provider_response_id:'offline:'+request_id,parsed_json,stop_reason:'stop'});
 const candidate=a.accept({prepared,draftResponse:r('offline-writer',result.draft),draftRequestId:'offline-writer',reviewResponse:r('offline-reviewer',result.audit),reviewRequestId:'offline-reviewer'});
 let held=false;try{a.publish(candidate,{sourceId:prepared.sourceId,channel:'official'})}catch{held=true}if(!held)throw Error('Bypassed safety');
 // Synthetic decision tests the handoff contract only, never attests content safety.
 const checked=a.safety(candidate,{candidateDigest:candidate.digest,requestId:'OFFLINE-SYNTHETIC-DECISION',pass:true,unresolvedFindings:[]});
 for(const channel of ['official','manual']){
  const envelope=a.publish(checked,{sourceId:prepared.sourceId,channel});
  const loaded=a.read(JSON.parse(JSON.stringify(envelope)),prepared.sourceId,channel);
  if(loaded.markdown!==contract.render(result.final,c.blocks))throw Error('Rendering drift');
 }
 return {id:c.id,first:result.first,second:result.second,sourceBound:true,unreviewedHeld:true,officialManualRoundTrip:true,realSafetyExecuted:false,externalSinksExecuted:false};
}
if(require.main===module){const [corpusPath,resultsRoot,output]=process.argv.slice(2);if(!output)throw Error('Usage: corpus resultsRoot output');const corpus=JSON.parse(fs.readFileSync(corpusPath));const rows=[];for(const group of fs.readdirSync(resultsRoot))for(const name of fs.readdirSync(path.join(resultsRoot,group)).filter(n=>n.endsWith('.json'))){const r=JSON.parse(fs.readFileSync(path.join(resultsRoot,group,name)));const c=corpus.find(c=>c.id===r.id);if(!c)throw Error('Missing source');rows.push(replay(r,c));}fs.writeFileSync(output,JSON.stringify({rows,productionWritten:false},null,2),{mode:0o600});console.log({replayed:rows.length,productionWritten:false});}
module.exports={replay};
