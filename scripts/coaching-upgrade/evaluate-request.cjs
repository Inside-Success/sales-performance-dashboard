/* eslint-disable @typescript-eslint/no-require-imports -- Explicit isolated Node evaluation runner. */
const fs=require('node:fs'),path=require('node:path');
const {reserve}=require('./evaluate.cjs');
async function main(){
 const file=process.argv[2],request=JSON.parse(fs.readFileSync(file)),dir='.private-upgrade',ledgerPath=dir+'/ledger.json';
 const prior=JSON.parse(fs.readFileSync(ledgerPath)).find(r=>r.id===request.request_id);
 if(prior){if(prior.status==='validated'){console.log('Saved '+prior.id);return;}throw Error('Inspect existing request before retry: '+prior.id);}
 if(!process.env.REVIEW_PROVIDER_URL)throw Error('Verified isolated provider URL required');
 const entry=reserve(ledgerPath,request),out=path.join(dir,entry.id+'.json');
 fs.writeFileSync(path.join(dir,entry.id+'.submitted.request.json'),JSON.stringify(request));
 const update=()=>{const lock=ledgerPath+'.lock',fd=fs.openSync(lock,'wx');try{const rows=JSON.parse(fs.readFileSync(ledgerPath));rows[rows.findIndex(r=>r.id===entry.id)]=entry;fs.writeFileSync(ledgerPath,JSON.stringify(rows,null,2));}finally{fs.closeSync(fd);fs.unlinkSync(lock);}};
 console.log(JSON.stringify({id:entry.id,reserved:entry.reserved}));
 try{
  const response=await fetch(process.env.REVIEW_PROVIDER_URL,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(request),signal:AbortSignal.timeout(610000)});
  const raw=await response.text();fs.writeFileSync(out,raw);let result=JSON.parse(raw);if(Array.isArray(result))result=result[0];fs.writeFileSync(out,JSON.stringify(result));
  entry.actual=Number(result.costs?.total_cost_usd)||null;entry.receipt=path.basename(out);if(entry.actual!==null)entry.reserved=entry.actual+entry.reserved/2;
  if(!response.ok||!result.ok||result.parse_error||['length','max_tokens'].includes(result.stop_reason)||!result.parsed_json)throw Error('Incomplete result; inspect saved receipt');
  entry.status='validated';update();console.log(JSON.stringify({id:entry.id,cost:entry.actual,valid:true}));
 }catch(e){entry.status='needs_inspection';update();throw e;}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
