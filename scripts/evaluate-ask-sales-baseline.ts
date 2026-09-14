/** Replay the production V5.14 code offline. No HTTP to the app, database, or Slack. */
import { readFileSync,writeFileSync,existsSync,openSync,closeSync,unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
const dir=resolve(process.env.FAQ_EVAL_DIR||"");
if(!process.env.FAQ_EVAL_DIR || dir===process.cwd() || dir.startsWith(process.cwd()+"/")) throw new Error("Private FAQ_EVAL_DIR required outside repository");
const keyFile=process.env.FAQ_EVAL_KEY_FILE;
if(!keyFile) throw new Error("FAQ_EVAL_KEY_FILE required");
const key=readFileSync(keyFile,"utf8").split(/\r?\n/).find(l=>l.startsWith("DEEPSEEK_API_KEY="))?.slice(17).trim().replace(/^"|"$/g,"");
if(!key) throw new Error("DeepSeek key unavailable");
process.env.DEEPSEEK_API_KEY=key;
process.env.FAQ_DEEPSEEK_MODEL="deepseek-v4-pro";
const lockPath=resolve(dir,"spend.lock"),lock=openSync(lockPath,"wx",0o600);
process.on("exit",()=>{closeSync(lock);unlinkSync(lockPath);});
const ledgerPath=resolve(dir,"spend.json"),ledger=JSON.parse(readFileSync(ledgerPath,"utf8"));
if(ledger.reservedUsd) throw new Error("Reconcile outstanding spend before resuming");
const ceiling=Math.min(Number(process.env.FAQ_EVAL_CEILING_USD||30),40);
if(!Number.isFinite(ceiling)||ceiling<=0) throw new Error("Invalid spending ceiling");
const save=()=>writeFileSync(ledgerPath,JSON.stringify(ledger,null,2),{mode:0o600});
const originalFetch=globalThis.fetch;
let outputs:unknown[]=[];
globalThis.fetch=async(input,init)=>{
  const url=typeof input==="string"?input:input instanceof URL?input.href:input.url;
  if(url!=="https://api.deepseek.com/chat/completions") throw new Error("Offline baseline blocked a non-model network request");
  const body=JSON.parse(String(init?.body));
  const reserve=(Buffer.byteLength(JSON.stringify(body.messages),"utf8")*1.32+Number(body.max_tokens||4800)*3.96)/1e6;
  if(ledger.estimatedUsd+ledger.reservedUsd+reserve>ceiling) throw new Error("Evaluation spending ceiling reached");
  ledger.reservedUsd+=reserve;save();
  const start=Date.now();let receipt:{tokens?:number;cost:number;status:string}={cost:reserve,status:"failed"};
  let response:Response|undefined, failure:unknown;
  try {
    response=await originalFetch(input,init);
    const data=await response.clone().json();
    const usage=data.usage;
    if(usage) receipt={tokens:usage.total_tokens,cost:((usage.prompt_tokens-(usage.prompt_cache_hit_tokens||0))*1.32+(usage.prompt_cache_hit_tokens||0)*0.044+usage.completion_tokens*3.96)/1e6,status:response.ok?"success":"failed"};
    outputs.push({status:response.status,choices:data.choices,usage:data.usage});
  } catch(error) {failure=error;}
  ledger.estimatedUsd+=receipt.cost;ledger.reservedUsd=Math.max(0,ledger.reservedUsd-reserve);
  (ledger.baselineAttempts ||= []).push({...receipt,model:body.model,latencyMs:Date.now()-start});save();
  if(failure) throw failure;
  return response!;
};
const {runAskSalesFaqV514Production}=await import("../src/lib/ask-sales-faq/v5-14/production");
const fixture=process.env.FAQ_EVAL_CASES;
if(!fixture) throw new Error("FAQ_EVAL_CASES required");
const cases=JSON.parse(readFileSync(fixture,"utf8")) as Array<{id:string;question:string;messages?:Array<{role:"user"|"assistant";content:string}>}>;
for(const item of cases) {
  const hash=createHash("sha256").update(JSON.stringify(item)).digest("hex").slice(0,12);
  const path=resolve(dir,`baseline-v514-deepseek-${item.id}-${hash}.json`);
  if(existsSync(path)) {console.log(JSON.stringify({id:item.id,cached:true}));continue;}
  outputs=[];
  const result=await runAskSalesFaqV514Production(item.question,item.messages||[]);
  writeFileSync(path,JSON.stringify({id:item.id,question:item.question,result,outputs},null,2),{mode:0o600});
  console.log(JSON.stringify({id:item.id,outcome:result.outcome,errorClass:result.errorClass,latencyMs:result.latencyMs,estimatedTotalUsd:ledger.estimatedUsd}));
  if(result.errorClass) break;
}
