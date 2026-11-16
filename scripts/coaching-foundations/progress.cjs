const {digest}=require('../../src/lib/coaching-canonical.cjs');
function validateProgress(x){
 const s=x?.state,p=s?.prepared;
 if(!['official','manual'].includes(s?.channel)||!['request','completed','excluded','held'].includes(s?.status)||typeof x.execution_id!=='string'||!/^\d+$/.test(x.execution_id)||!p?.sourceId||!Array.isArray(p.blocks)||digest(p.blocks)!==p.sourceHash||digest(p.policyText)!==p.policyHash)throw Error('Invalid progress binding');
 if(s.candidate&&(s.candidate.prepared.sourceId!==p.sourceId||digest(s.candidate.report)!==s.candidate.digest))throw Error('Invalid candidate progress');
 if(s.status==='request'){
  const {request_id,case_id,stage,model,...body}=s.request||{};
  if(case_id!==p.sourceId||request_id!==digest({source:p.sourceHash,sourceId:p.sourceId,policy:p.policyHash,stage,model,...body}))throw Error('Invalid pending request');
 }
 return {source_id:p.sourceId,channel:s.channel,execution_id:x.execution_id,status:s.status,source_hash:p.sourceHash,state:s};
}
module.exports={validateProgress};
