/** Offline evaluation: no database, Slack, n8n, or production HTTP imports. */
import { readFileSync, writeFileSync, mkdirSync, existsSync, openSync, closeSync, unlinkSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { createRevampProvider } from "../src/lib/ask-sales-faq/revamp/provider";
import { runAskSalesRevamp } from "../src/lib/ask-sales-faq/revamp/runtime";
import { getRevampKnowledgeSnapshot, getRevampHistoricalKnowledge } from "../src/lib/ask-sales-faq/revamp/knowledge";
import type { Attempt, JsonProvider } from "../src/lib/ask-sales-faq/revamp/types";

const dir=process.env.FAQ_EVAL_DIR;
if(!dir) throw new Error("FAQ_EVAL_DIR must name a private directory outside the repository");
const output=resolve(dir);
if(output===process.cwd() || output.startsWith(process.cwd()+"/")) throw new Error("Evaluation artifacts must remain outside the repository");
mkdirSync(output,{recursive:true,mode:0o700});
const providerName=process.env.FAQ_EVAL_PROVIDER === "deepseek" ? "deepseek" : "openai";
const keyFile=process.env.FAQ_EVAL_KEY_FILE;
if(!keyFile) throw new Error("FAQ_EVAL_KEY_FILE is required");
const env=Object.fromEntries(readFileSync(keyFile,"utf8").split(/\r?\n/).filter(l=>l.includes("=")).map(l=>{
 const at=l.indexOf("=");return [l.slice(0,at),l.slice(at+1).trim().replace(/^"|"$/g,"")];
}));
const model=providerName==="openai"?"gpt-5.6-luna":(env.FAQ_DEEPSEEK_MODEL||"deepseek-v4-pro");
const lockPath=resolve(output,"spend.lock");
const lock=openSync(lockPath,"wx",0o600);
process.on("exit",()=>{closeSync(lock);unlinkSync(lockPath);});
const ledgerPath=resolve(output,"spend.json");
type Ledger={estimatedUsd:number;reservedUsd:number;attempts:Attempt[]};
const ledger:Ledger=existsSync(ledgerPath)?JSON.parse(readFileSync(ledgerPath,"utf8")):{estimatedUsd:0,reservedUsd:0,attempts:[]};
const ceiling=Math.min(Number(process.env.FAQ_EVAL_CEILING_USD||30),40);
if(!Number.isFinite(ceiling)||ceiling<=0) throw new Error("Invalid spending ceiling");
// One process owns the ledger. Refuse unresolved reservations after interruption
// until their provider receipts are reconciled; never silently forgive spend.
if(ledger.reservedUsd) throw new Error("Unreconciled spend reservation: inspect before resuming");
const save=()=>writeFileSync(ledgerPath,JSON.stringify(ledger,null,2),{mode:0o600});
const reservations=new Map<number,number>();
const syncReserved=()=>{ledger.reservedUsd=[...reservations.values()].reduce((a,b)=>a+b,0);};
function workerProvider(workerId:number) {
let reservation=0;
return createRevampProvider({provider:providerName,model,apiKey:env[providerName==="openai"?"OPENAI_API_KEY":"DEEPSEEK_API_KEY"],
 timeoutMs:18000,
 beforeCall:async({promptChars,maxOutputTokens})=>{
  // One character per token is deliberately conservative for these English prompts.
  // DeepSeek V4 Pro peak rates verified 2026-09-15; off-peak bills may be lower.
  reservation=providerName==="openai"?(promptChars*0.20+maxOutputTokens*1.20)/1e6:(promptChars*1.32+maxOutputTokens*3.96)/1e6;
  if(ledger.estimatedUsd+ledger.reservedUsd+reservation>ceiling) throw new Error("Evaluation spending ceiling reached");
  reservations.set(workerId,reservation);syncReserved();save();
 },afterCall:async(attempt)=>{
  const cost=attempt.error === "provider_not_configured" ? 0 : attempt.inputTokens||attempt.outputTokens ? providerName==="openai"
   ? ((attempt.inputTokens-attempt.cachedTokens)*0.20+attempt.cachedTokens*0.02+attempt.outputTokens*1.20)/1e6
   : ((attempt.inputTokens-attempt.cachedTokens)*1.32+attempt.cachedTokens*0.044+attempt.outputTokens*3.96)/1e6 : reservation;
  ledger.estimatedUsd+=cost;reservations.delete(workerId);syncReserved();ledger.attempts.push(attempt);save();
 }});
}
const fixture=process.env.FAQ_EVAL_CASES;
if(!fixture) throw new Error("FAQ_EVAL_CASES is required");
const cases=JSON.parse(readFileSync(fixture,"utf8")) as Array<{id:string;question:string;messages?:Array<{role:"user"|"assistant";content:string}>}>;
const historical=process.env.FAQ_EVAL_KNOWLEDGE==="historical";
const historicalRecords=historical?getRevampHistoricalKnowledge():null;
const snapshot=historicalRecords?{version:"historical-"+createHash("sha256").update(JSON.stringify(historicalRecords)).digest("hex").slice(0,24),records:historicalRecords}:getRevampKnowledgeSnapshot();
const implementationDir=resolve("src/lib/ask-sales-faq/revamp");
const implementationVersion=createHash("sha256").update(JSON.stringify({model,providerName}));
for(const file of readdirSync(implementationDir).sort()) implementationVersion.update(readFileSync(resolve(implementationDir,file)));
implementationVersion.update(readFileSync(__filename));
const runVersion=implementationVersion.digest("hex").slice(0,16);
const sourceSnapshot=resolve(output,`implementation-${runVersion}`);
mkdirSync(sourceSnapshot,{recursive:true,mode:0o700});
for(const file of readdirSync(implementationDir)) writeFileSync(resolve(sourceSnapshot,file),readFileSync(resolve(implementationDir,file)),{mode:0o600});
writeFileSync(resolve(sourceSnapshot,"evaluation-script.ts"),readFileSync(__filename),{mode:0o600});
writeFileSync(resolve(output,`knowledge-${snapshot.version}.json`),JSON.stringify(snapshot),{mode:0o600});
const concurrency=Number(process.env.FAQ_EVAL_CONCURRENCY||1);
if(!Number.isInteger(concurrency)||concurrency<1||concurrency>3) throw new Error("Concurrency must be 1–3");
let next=0,stopping=false;
process.on("SIGINT",()=>{stopping=true;console.log("Stopping after in-flight cases finish");});
process.on("SIGTERM",()=>{stopping=true;});
async function worker(workerId:number) {
const provider=workerProvider(workerId);
while(!stopping && next<cases.length) {
 const item=cases[next++];
 const caseVersion=createHash("sha256").update(JSON.stringify(item)).digest("hex").slice(0,12);
 const path=resolve(output,`${providerName}-${snapshot.version}-${runVersion}-${item.id}-${caseVersion}.json`);
 if(existsSync(path)) {console.log(JSON.stringify({id:item.id,cached:true}));continue;}
 const outputs:Array<{purpose:string;value:unknown}>=[];
 const observedProvider:JsonProvider=async(system,input,purpose)=>{const response=await provider(system,input,purpose);outputs.push({purpose,value:response.value});return response;};
 const result=await runAskSalesRevamp(item.question,item.messages||[],{provider:observedProvider,evidence:snapshot.records,knowledgeVersion:snapshot.version});
 writeFileSync(path,JSON.stringify({id:item.id,question:item.question,model,runVersion,result,outputs},null,2),{mode:0o600});
 console.log(JSON.stringify({id:item.id,status:result.runtimeMetadata?.revamp?.status,latencyMs:result.latencyMs,errorClass:result.errorClass,estimatedTotalUsd:ledger.estimatedUsd}));
 if(result.errorClass && !(result.errorClass === "revamp_invalid_output" && process.env.FAQ_EVAL_CONTINUE_SCHEMA_ERRORS === "1")) stopping=true; // Provider failures always stop; planned suites may retain isolated schema failures and continue to different cases.
}

}
await Promise.all(Array.from({length:concurrency},(_,id)=>worker(id)));
console.log(JSON.stringify({completedDispatches:next,totalCases:cases.length,stopped:stopping,reservedUsd:ledger.reservedUsd}));
