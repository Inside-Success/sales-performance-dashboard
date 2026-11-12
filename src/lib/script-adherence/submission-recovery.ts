// Only a confirmed request rejection can be retried automatically. Network failures,
// 408/409, 5xx and malformed responses may have created a paid batch.
export class ProviderError extends Error {
 constructor(public status:number,public requestId:string|null,public code?:string){
  super(`Provider HTTP ${status}${code?` (${code.replace(/[^a-zA-Z0-9_-]/g,'').slice(0,80)})`:''}; saved submission state retained`);
 }
}
export function submissionDisposition(error:unknown):'retryable_rejection'|'rejected'|'uncertain'{
 if(!(error instanceof ProviderError))return 'uncertain';
 if(error.status===429&&error.code!=='insufficient_quota')return 'retryable_rejection';
 if([400,401,403,404,413,422,429].includes(error.status))return 'rejected';
 return 'uncertain';
}
export function submissionMatches(local:{id:string;file_id:string|null},remote:{metadata?:{adherence_batch?:string};input_file_id?:string}){
 return remote.metadata?.adherence_batch===local.id||Boolean(local.file_id&&remote.input_file_id===local.file_id);
}
