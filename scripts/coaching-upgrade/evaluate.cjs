/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS is embedded in n8n Code nodes and run directly by Node. */
// Explicit isolated paid evaluation. Never writes production reports or sends Slack.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {MODELS,coachingSystem,writerPrompt,reviewerPrompt,POLICY_REVISION}=require('./prompts.cjs');
const {policyPack}=require('./policy.cjs');
const {assertObjectionReport,normalizeObjectionReport,objectionErrors}=require('../../src/lib/objection-coaching.cjs');
const {resolveCoachingOfferFamily}=require('../../src/lib/coaching-offer-context.cjs');
const {transcriptBlocks}=require('../coaching-release/structured-coaching.cjs');
function reserve(ledgerPath,request,attempts=2){
 const lock=ledgerPath+'.lock';const fd=fs.openSync(lock,'wx');
 try{
  const ledger=fs.existsSync(ledgerPath)?JSON.parse(fs.readFileSync(ledgerPath,'utf8')):[];
  const fingerprint=crypto.createHash('sha256').update(JSON.stringify(request)).digest('hex');
  if(ledger.some(x=>x.fingerprint===fingerprint||x.id===request.request_id))throw Error('Request already reserved: inspect saved result before any retry');
  const p=request.pricing;
  // UTF-8 bytes upper-bound tokens conservatively, including protocol overhead.
  const amount=attempts*((Buffer.byteLength(request.system+request.prompt)+4096)*Math.max(p.cache_write_mtok,p.input_mtok)+request.max_tokens*p.output_mtok)/1e6;
  const committed=ledger.reduce((s,x)=>s+x.reserved,0);
  if(committed+amount>40)throw Error('USD 40 hard ceiling would be exceeded');
  const row={id:request.request_id,fingerprint,reserved:amount,actual:null,status:'reserved',created_at:new Date().toISOString()};
  ledger.push(row);fs.writeFileSync(ledgerPath,JSON.stringify(ledger,null,2));return row;
 }finally{fs.closeSync(fd);fs.unlinkSync(lock);}
}
async function main(){
 const [inputFile,id,mode='write',model='claude-sonnet-5-5',variant='v1',draftFile]=process.argv.slice(2);
 if(!process.env.REVIEW_PROVIDER_URL)throw Error('Set the verified isolated provider URL');
 if(!MODELS[model]||!['write','review','repair'].includes(mode))throw Error('Unsupported evaluation configuration');
 const call=JSON.parse(fs.readFileSync(inputFile,'utf8')).find(x=>String(x.id)===id);if(!call)throw Error('Unknown case');
 // Do not leak previous report judgments into the new analysis.
 const metadata=Object.fromEntries(Object.entries(call.metadata||{}).filter(([k])=>['rep_name','client_name','call_date','meeting_title','show_name'].includes(k)));
 const blocks=transcriptBlocks(call.transcript);if(blocks.length<10)throw Error('Insufficient evaluation transcript');
 const family=resolveCoachingOfferFamily({sourcePayload:metadata,transcriptText:call.transcript}).family;
 const prior=mode!=='write'?JSON.parse(fs.readFileSync(draftFile,'utf8')):null;
 const draft=prior?.parsed_json;
 const prompt=mode==='review'?reviewerPrompt(metadata,blocks,draft):writerPrompt(metadata,blocks)+(mode==='repair'?'\nRepair the complete draft against the original call and policy. Correct these validation errors without inventing evidence: '+JSON.stringify(objectionErrors(draft,blocks))+'\nUntrusted draft: '+JSON.stringify(draft||prior.model_text):'');
 const system=coachingSystem(policyPack(family));
 const request={...MODELS[model],request_id:['upgrade',id,mode,model,variant].join('-'),case_id:id,result_id:'upgrade-'+id,call_purpose:'isolated_objection_v2_'+mode,system,prompt};
 const dir=path.resolve('.private-upgrade');fs.mkdirSync(dir,{recursive:true});
 const ledgerPath=path.join(dir,'ledger.json');const entry=reserve(ledgerPath,request);
 const update=()=>{const lock=ledgerPath+'.lock',fd=fs.openSync(lock,'wx');try{const rows=JSON.parse(fs.readFileSync(ledgerPath,'utf8'));rows[rows.findIndex(x=>x.id===entry.id)]=entry;fs.writeFileSync(ledgerPath,JSON.stringify(rows,null,2));}finally{fs.closeSync(fd);fs.unlinkSync(lock);}};
 const out=path.join(dir,entry.id+'.json');fs.writeFileSync(path.join(dir,entry.id+'.request.json'),JSON.stringify(request));
 console.log(JSON.stringify({id:entry.id,family,reserved:entry.reserved}));
 try{
  const response=await fetch(process.env.REVIEW_PROVIDER_URL,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(request),signal:AbortSignal.timeout(610000)});
  const raw=await response.text();fs.writeFileSync(out,raw);
  let result=JSON.parse(raw);if(Array.isArray(result))result=result[0];fs.writeFileSync(out,JSON.stringify(result,null,2));
  entry.actual=Number(result.costs?.total_cost_usd)||null;entry.status='received';entry.receipt=path.basename(out);entry.policy_revision=POLICY_REVISION;
  // Reserve a possible unobserved first attempt until execution evidence reconciles it.
  if(entry.actual!==null)entry.reserved=entry.actual+entry.reserved/2;
  update();
  if(!response.ok||!result.ok||result.stop_reason!=='end_turn'||result.parse_error)throw Error('Invalid/incomplete provider result; receipt saved');
  if(mode!=='review'){result.provider_parsed_json=result.parsed_json;result.parsed_json=normalizeObjectionReport(result.parsed_json);fs.writeFileSync(out,JSON.stringify(result,null,2));assertObjectionReport(result.parsed_json,blocks);}
  else {const a=result.parsed_json;if(typeof a?.pass!=='boolean'||!Array.isArray(a.findings))throw Error('Invalid audit contract');if(a.pass!==true){a.corrected_report=normalizeObjectionReport(a.corrected_report);assertObjectionReport(a.corrected_report,blocks);fs.writeFileSync(out,JSON.stringify(result,null,2));}else if(a.corrected_report!==null||a.findings.length)throw Error('Conflicting audit verdict');}
  entry.status='validated';update();console.log(JSON.stringify({id:entry.id,cost:entry.actual,valid:true,cache_read:result.usage?.cache_read_input_tokens,output:out}));
 }catch(e){entry.status='needs_inspection';update();throw e;}
}
module.exports={reserve};
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
