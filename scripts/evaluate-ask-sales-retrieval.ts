/** Isolated, budgeted lexical/hybrid experiment; all artifacts stay private. */
import { readFileSync,writeFileSync,existsSync,openSync,closeSync,unlinkSync,mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { getRevampKnowledgeSnapshot } from "../src/lib/ask-sales-faq/revamp/knowledge";
import { embeddingText,evidenceFingerprint,requestEmbeddings,semanticScores,EMBEDDING_MODEL,EMBEDDING_DIMENSIONS,type SemanticIndex } from "../src/lib/ask-sales-faq/revamp/semantic";
import { retrieveEvidence } from "../src/lib/ask-sales-faq/revamp/retrieval";
import type { Plan } from "../src/lib/ask-sales-faq/revamp/types";

const dir=resolve(process.env.FAQ_EVAL_DIR || "");
if(!process.env.FAQ_EVAL_DIR || dir===process.cwd() || dir.startsWith(process.cwd()+"/")) throw new Error("Use a private FAQ_EVAL_DIR outside the repository");
mkdirSync(dir,{recursive:true,mode:0o700});
const keyFile=process.env.FAQ_EVAL_KEY_FILE;
if(!keyFile) throw new Error("FAQ_EVAL_KEY_FILE is required");
const apiKey=readFileSync(keyFile,"utf8").split(/\r?\n/).find(l=>l.startsWith("OPENAI_API_KEY="))?.slice(15).trim().replace(/^"|"$/g,"");
if(!apiKey) throw new Error("OpenAI embedding key unavailable");
const lockPath=resolve(dir,"spend.lock"), lock=openSync(lockPath,"wx",0o600);
process.on("exit",()=>{closeSync(lock);unlinkSync(lockPath);});
const ledgerPath=resolve(dir,"spend.json");
const ledger=JSON.parse(readFileSync(ledgerPath,"utf8"));
if(ledger.reservedUsd) throw new Error("Reconcile outstanding spend before resuming");
const ceiling=Math.min(Number(process.env.FAQ_EVAL_CEILING_USD||30),40);
if(!Number.isFinite(ceiling)||ceiling<=0) throw new Error("Invalid spending ceiling");
const save=()=>writeFileSync(ledgerPath,JSON.stringify(ledger,null,2),{mode:0o600});
async function embed(input:string[]) {
  const reservation=input.reduce((n,s)=>n+Buffer.byteLength(s,"utf8"),0)*0.02/1e6;
  if(ledger.estimatedUsd+reservation>ceiling) throw new Error("Evaluation spending ceiling reached");
  ledger.reservedUsd=reservation;save();
  const start=Date.now();
  let result:Awaited<ReturnType<typeof requestEmbeddings>>;
  try { result=await requestEmbeddings(input,apiKey!,20000); }
  catch(error) {
    ledger.estimatedUsd+=reservation;ledger.reservedUsd=0;
    (ledger.embeddingAttempts ||= []).push({model:EMBEDDING_MODEL,estimatedUsd:reservation,status:"failed"});save();throw error;
  }
  // Persist once, outside the provider-error catch: disk errors are not another API charge.
  ledger.estimatedUsd+=result.tokens*0.02/1e6;ledger.reservedUsd=0;
  (ledger.embeddingAttempts ||= []).push({model:EMBEDDING_MODEL,tokens:result.tokens,latencyMs:Date.now()-start,status:"success"});save();return result.vectors;
}
const indexPath=resolve(dir,"semantic-index.json");
const index:SemanticIndex=existsSync(indexPath)?JSON.parse(readFileSync(indexPath,"utf8")):{model:EMBEDDING_MODEL,dimensions:EMBEDDING_DIMENSIONS,entries:{}};
if(index.model!==EMBEDDING_MODEL || index.dimensions!==EMBEDDING_DIMENSIONS) throw new Error("Embedding configuration changed; use a new index artifact");
const snapshot=getRevampKnowledgeSnapshot();
const missing=snapshot.records.filter(r=>index.entries[r.id]?.fingerprint!==evidenceFingerprint(r));
for(let offset=0;offset<missing.length;offset+=64) {
  const batch=missing.slice(offset,offset+64),vectors=await embed(batch.map(embeddingText));
  batch.forEach((record,i)=>{index.entries[record.id]={fingerprint:evidenceFingerprint(record),vector:vectors[i]};});
  writeFileSync(indexPath,JSON.stringify(index),{mode:0o600});
  console.log(JSON.stringify({embedded:Math.min(offset+64,missing.length),total:missing.length,estimatedTotalUsd:ledger.estimatedUsd}));
}
const fixture=process.env.FAQ_EVAL_CASES;
if(!fixture) throw new Error("FAQ_EVAL_CASES is required");
const cases=JSON.parse(readFileSync(fixture,"utf8")) as Array<{id:string;question:string;scopes:Plan["scopes"];goldIds:string[]}>;
for(const item of cases) if(!item.goldIds.every(id=>snapshot.records.some(r=>r.id===id))) throw new Error(`Unknown gold evidence in ${item.id}`);
const queryPath=resolve(dir,"semantic-query-cache.json");
const cache:Record<string,number[]>=existsSync(queryPath)?JSON.parse(readFileSync(queryPath,"utf8")):{};
const rows=[];
for(const item of cases) {
  const hash=createHash("sha256").update(EMBEDDING_MODEL+EMBEDDING_DIMENSIONS+item.question).digest("hex");
  const start=Date.now();let cached=true;
  if(!cache[hash]) {cached=false;cache[hash]=(await embed([item.question]))[0];writeFileSync(queryPath,JSON.stringify(cache),{mode:0o600});}
  const plan:Plan={intent:"company_question",question:item.question,scopes:item.scopes,queries:[]};
  const lexical=retrieveEvidence(snapshot.records,item.question,plan).map(r=>r.record.id);
  const scores=semanticScores(snapshot.records,index,cache[hash]);
  const ranked=[...scores].sort((a,b)=>b[1]-a[1]).map(([id])=>id);
  const hybrid=retrieveEvidence(snapshot.records,item.question,plan,28,scores).map(r=>r.record.id);
  rows.push({...item,semanticGoldRanks:item.goldIds.map(id=>ranked.indexOf(id)+1),lexical,hybrid,lexicalRecall:item.goldIds.filter(id=>lexical.includes(id)).length/item.goldIds.length,hybridRecall:item.goldIds.filter(id=>hybrid.includes(id)).length/item.goldIds.length,latencyMs:Date.now()-start,cached});
}
const result={knowledgeVersion:snapshot.version,model:EMBEDDING_MODEL,dimensions:EMBEDDING_DIMENSIONS,rows,lexicalRecall:rows.reduce((n,r)=>n+r.lexicalRecall,0)/rows.length,hybridRecall:rows.reduce((n,r)=>n+r.hybridRecall,0)/rows.length};
writeFileSync(resolve(dir,`retrieval-${snapshot.version}.json`),JSON.stringify(result,null,2),{mode:0o600});
console.log(JSON.stringify({cases:rows.length,lexicalRecall:result.lexicalRecall,hybridRecall:result.hybridRecall,estimatedTotalUsd:ledger.estimatedUsd}));
