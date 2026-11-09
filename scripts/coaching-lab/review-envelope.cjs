// Offline acceptance boundary. No delivery function, production credential or publisher.
const {hash}=require('./accounting.cjs');
const {acceptReview,validate,render}=require('./contract.cjs');
function bindInput({sourceId,blocks,policyHash,promptHash,channel}) {
  if(!sourceId||!blocks?.length||!policyHash||!promptHash||!['official','manual'].includes(channel)) throw Error('Incomplete source binding');
  return {sourceId,sourceHash:hash(blocks),policyHash,promptHash,channel};
}
function accept({binding,blocks,draft,audit,writerReceipt,reviewReceipt,expectedWriterRequest,expectedReviewRequest}){
  if(binding.sourceHash!==hash(blocks)) throw Error('Source changed');
  for(const [receipt,expected] of [[writerReceipt,expectedWriterRequest],[reviewReceipt,expectedReviewRequest]]){
    if(!expected||receipt?.request_id!==expected||!receipt.provider_response_id||receipt.ok!==true||!receipt.usage||!Number.isFinite(receipt.costs?.total_cost_usd)||['length','max_tokens'].includes(receipt.stop_reason)) throw Error('Incomplete or mismatched receipt');
  }
  if(hash(writerReceipt.parsed_json)!==hash(draft)||hash(reviewReceipt.parsed_json)!==hash(audit)) throw Error('Receipt content changed');
  const report=acceptReview(draft,audit,blocks);
  return {binding,report:structuredClone(report),reportHash:hash(report),writerRequest:expectedWriterRequest,reviewRequest:expectedReviewRequest,readyForSafety:report.status==='completed',acceptedForDelivery:false};
}
function preview(envelope,blocks){
  if(envelope.binding.sourceHash!==hash(blocks)||envelope.reportHash!==hash(envelope.report)) throw Error('Stale reviewed object');
  validate(envelope.report,blocks);return render(envelope.report,blocks);
}
module.exports={bindInput,accept,preview};
