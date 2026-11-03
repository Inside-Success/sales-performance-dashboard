// Read saved receipts only. No provider requests, publication or database writes.
import {readFileSync,writeFileSync} from 'node:fs';
import {actionStatus,scriptFor} from '../../src/lib/script-adherence/contract';
const root='.private-adherence/provider-batch-pilot/';
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
const calls=read('.private-adherence/holdout-calls.json'),baseline=read('.private-adherence/compare-holdout-terra-review-parsed.json');
const draft=read(root+'draft-results.json'),review=read(root+'review-results.json');
const summaries=[],changes=[];
for(const [stage,rows] of [['draft',draft],['review',review]] as const){
 let classificationMatches=0,actionMatches=0,actionTotal=0,videoMatches=0,videoTotal=0;
 for(const r of rows){
  const prior=baseline.find((b:any)=>b.index===r.index).result.analysis,actual=r.result?.analysis,date=calls[r.index].source['Meeting Start Date'];
  const fields=['family','stage','attendance','eligibleForChecklist'];
  if(actual&&fields.every(k=>actual[k]===prior[k]))classificationMatches++;
  else changes.push({stage,index:r.index,type:'classification',prior:Object.fromEntries(fields.map(k=>[k,prior[k]])),actual:actual&&Object.fromEntries(fields.map(k=>[k,actual[k]]))});
  for(const a of prior.actions){
   actionTotal++;const expected=actionStatus(prior,a.id,date),observed=actual&&scriptFor(actual)===scriptFor(prior)?actionStatus(actual,a.id,date):'Invalid / different script';
   if(expected===observed)actionMatches++;
   if(['video_1','video_2'].includes(a.id)){videoTotal++;if(expected===observed)videoMatches++;}
   if(expected!==observed)changes.push({stage,index:r.index,type:'action',id:a.id,expected,observed,prior:a,actual:actual?.actions.find((x:any)=>x.id===a.id)});
  }
 }
 const b=read(root+stage+'.json').batch;
 summaries.push({stage,calls:rows.length,valid:rows.filter((r:any)=>!r.error).length,classificationMatches,actionMatches,actionTotal,videoMatches,videoTotal,costUSD:rows.reduce((n:number,r:any)=>n+(r.cost||0),0)/1e6,inputTokens:rows.reduce((n:number,r:any)=>n+(r.usage?.prompt_tokens||0),0),cachedTokens:rows.reduce((n:number,r:any)=>n+(r.usage?.prompt_tokens_details?.cached_tokens||0),0),outputTokens:rows.reduce((n:number,r:any)=>n+(r.usage?.completion_tokens||0),0),durationSeconds:b.completed_at?b.completed_at-b.created_at:null});
}
writeFileSync(root+'summary.json',JSON.stringify(summaries,null,2),{mode:0o600});
writeFileSync(root+'differences.json',JSON.stringify(changes,null,2),{mode:0o600});
console.log(JSON.stringify({summaries,changes:changes.map(({prior,actual,...rest})=>rest)},null,2));
