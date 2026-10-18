// Build scoped patches from a private, compressed live baseline. No credentials or call data in Git.
import fs from 'node:fs';
import zlib from 'node:zlib';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {normalizeCoaching,coachingContractErrors,coachingStage,failureDecision,coveragePlan,CONTRACT_REVISION} from '../../src/lib/coaching-reliability-policy.mjs';
import {queueFailure} from './recovery-retry-policy.mjs';
export const REVISION='coaching-reliability-2026-10-18';
export function buildPatches(baselines) {
  const result={};
  const normalizer=normalizeCoaching.toString();
  const contract=[`const CONTRACT_REVISION=${JSON.stringify(CONTRACT_REVISION)};`,coachingStage.toString(),normalizer,coachingContractErrors.toString()].join('\n');
  const update=(id,name,updates)=>(result[id]??=[]).push({type:'updateNode',nodeName:name,updates});
  const node=(id,name)=>{const n=baselines[id].nodes.find(n=>n.name===name);if(!n)throw Error('Missing baseline '+name);return n;};
  const replace=(value,find,replacement)=>{if(!value.includes(find))throw Error('Baseline changed: '+find.slice(0,60));return value.replace(find,replacement);};
  for(const id of ['FShnTde2OGhIUZE4','BMRrGxHyXMcgO6j3']) {
    for(const n of baselines[id].nodes.filter(n=>n.parameters.jsCode?.includes('function renderCoaching(analysis,blocks,options={}) {'))) {
      // Manual writer/auditor builders contain pure renderer copies too; keep every copy consistent.
      update(id,n.name,{'parameters.jsCode':normalizer+'\n'+replace(n.parameters.jsCode,'function renderCoaching(analysis,blocks,options={}) {','function renderCoaching(analysis,blocks,options={}) {\n analysis=normalizeCoaching(analysis);')});
    }
  }
  const provider='X9L4JtDbpkSCflxZ';
  let validate=node(provider,'Validate Result').parameters.jsCode;
  validate=replace(validate,'const r=$json;','const r={...$json};\nif(coachingStage(s.call_purpose)){r.parsed_json=normalizeCoaching(r.parsed_json);r.model_text=JSON.stringify(r.parsed_json);r.contract_revision=CONTRACT_REVISION;}\nconst contractErrors=coachingStage(s.call_purpose)?coachingContractErrors(r.parsed_json):[];');
  validate=replace(validate,'const providerError=','valid=valid && !contractErrors.length;\nconst providerError=');
  validate=replace(validate,"providerError || r.parse_error || (", "providerError || r.parse_error || (contractErrors.length?'Invalid coaching contract: '+contractErrors.join('; '):'') || (");
  update(provider,'Validate Result',{'parameters.jsCode':contract+'\n'+validate});
  let restore=node(provider,'Restore Cached Result').parameters.jsCode;
  restore=replace(restore,'const r=s.checkpoint.result;','const r={...s.checkpoint.result};\nif(coachingStage(s.call_purpose)){r.parsed_json=normalizeCoaching(r.parsed_json);r.model_text=JSON.stringify(r.parsed_json);r.contract_revision=CONTRACT_REVISION;if(coachingContractErrors(r.parsed_json).length)throw Error("Invalid coaching contract in cached result");}');
  update(provider,'Restore Cached Result',{'parameters.jsCode':contract+'\n'+restore});
  const official='L8Nn7xncA9ZPDdWA';
  const lookup=structuredClone(node(provider,'Claim Checkpoint'));
  lookup.id='mm-source-failure-diagnostics';lookup.name='MM Read Checkpoint State';lookup.position=[15000,8800];
  lookup.parameters.body="={{ JSON.stringify({action:'source_status',source_id:$('If').item.json['Source Airtable Record ID']}) }}";
  lookup.onError='continueRegularOutput';lookup.retryOnFail=true;lookup.maxTries=2;delete lookup.continueOnFail;
  (result[official]??=[]).push({type:'addNode',node:lookup},{type:'rewireConnection',source:'Set: agent_failed',from:'MM Queue Unfinished Coaching',to:lookup.name},{type:'addConnection',source:lookup.name,target:'MM Queue Unfinished Coaching'});
  update(official,'MM Queue Unfinished Coaching',{'parameters.jsCode':failureDecision.toString()+'\n'+queueFailure.toString()+`\nconst recovery=$('MM Recovery Entry').isExecuted;
const attempt=recovery?Number($('MM Recovery Entry').first().json.recovery_attempt||1):0;
const failure=$('Set: agent_failed').item.json;
const source=String($('If').item.json['Source Airtable Record ID']||'');
const diagnostics=$json.source_id===source&&Array.isArray($json.checkpoints)?$json.checkpoints:[];
let message=String(failure.error_details||failure.error?.message||failure.message||'Coaching failed');
if($json.error && /Error executing workflow/.test(message))message+=' | checkpoint unavailable';
return {json:queueFailure(source,$execution.id,message,attempt,Date.now(),diagnostics),pairedItem:{item:0}};`});
  const scanner='mIsdpJO71D8DMrxe';
  for(const name of ['Read Failed Executions','Read Crashed Executions']) update(scanner,name,{'parameters.options.pagination':{pagination:{paginationMode:'updateAParameterInEachRequest',parameters:{parameters:[{type:'qs',name:'cursor',value:'={{ $response.body.nextCursor }}'}]},paginationCompleteWhen:'other',completeExpression:'={{ !$response.body.nextCursor }}',limitPagesFetched:true,maxRequests:10,requestInterval:250}}});
  const select=node(scanner,'Select Unscanned Failures').parameters.jsCode;
  update(scanner,'Select Unscanned Failures',{'parameters.jsCode':replace(select,"[$('Read Failed Executions').first().json,$('Read Crashed Executions').first().json]","[...$('Read Failed Executions').all().map(x=>x.json),...$('Read Crashed Executions').all().map(x=>x.json)]")});
  return result;
}
export function buildCoverage(baselines) {
  const provider=baselines.X9L4JtDbpkSCflxZ;
  const scanner=baselines.mIsdpJO71D8DMrxe;
  const clone=(n,name,x,y)=>({...structuredClone(n),id:name.toLowerCase().replaceAll(' ','-'),name,position:[x,y]});
  const find=(w,n)=>w.nodes.find(x=>x.name===n);
  const http=(name,body,x)=>{const n=clone(find(provider,'Claim Checkpoint'),name,x,0);n.parameters.url='https://sales-performance-dashboard-rose.vercel.app/api/internal/coaching-coverage';n.parameters.body=body;n.parameters.options.timeout=60000;return n;};
  const iff=(name,expr,x)=>({id:name,name,type:'n8n-nodes-base.if',typeVersion:2.2,position:[x,0],parameters:{conditions:{options:{version:2,caseSensitive:true,leftValue:'',typeValidation:'strict'},conditions:[{id:name,leftValue:expr,rightValue:true,operator:{type:'boolean',operation:'equals'}}],combinator:'and'},options:{}}});
  const receipts=clone(find(scanner,'Read Completion Receipts'),'Read Source Receipts',600,0);
  const alert=clone(find(scanner,'Notify Recovered Batch Gap'),'Notify Coverage Gap',1200,0);
  alert.parameters.text="={{ 'Magic Mike delivery coverage needs attention. '+$('Plan Coverage Outcome').first().json.notify.length+' source call(s) have no confirmed dashboard report or unresolved/exclusion receipt. Sources: '+$('Plan Coverage Outcome').first().json.notify.slice(0,10).join(', ')+'. No reports were replayed automatically; inspect source artifacts before recovery.' }}";
  const nodes=[{id:'coverage-schedule',name:'Every Fifteen Minutes',type:'n8n-nodes-base.scheduleTrigger',typeVersion:1.2,position:[0,0],parameters:{rule:{interval:[{field:'minutes',minutesInterval:15}]}}},http('Read Coverage Page','={{ JSON.stringify({action:"scan"}) }}',200),iff('Coverage Ready','={{ $json.status === "ready" }}',400),receipts,
    {id:'coverage-plan',name:'Plan Coverage Outcome',type:'n8n-nodes-base.code',typeVersion:2,position:[800,0],parameters:{jsCode:coveragePlan.toString()+"\nconst plan=coveragePlan($('Read Coverage Page').first().json,$input.all().map(x=>x.json));return plan?[{json:plan,pairedItem:{item:0}}]:[];"}},iff('New Coverage Gap','={{ $json.notify.length > 0 }}',1000),alert,http('Acknowledge Coverage Page',"={{ JSON.stringify({action:'ack',token:$('Plan Coverage Outcome').first().json.token,missing_ids:$('Plan Coverage Outcome').first().json.missing_ids}) }}",1400)];
  const connections={};const link=(a,b,i=0)=>{const main=(connections[a]??={main:[]}).main;while(main.length<=i)main.push([]);main[i].push({node:b,type:'main',index:0});};
  link('Every Fifteen Minutes','Read Coverage Page');link('Read Coverage Page','Coverage Ready');link('Coverage Ready','Read Source Receipts');link('Read Source Receipts','Plan Coverage Outcome');link('Plan Coverage Outcome','New Coverage Gap');link('New Coverage Gap','Notify Coverage Gap');link('New Coverage Gap','Acknowledge Coverage Page',1);link('Notify Coverage Gap','Acknowledge Coverage Page');
  return {name:'Magic Mike — Source Delivery Coverage — 2026-10-18',nodes,connections,settings:{executionOrder:'v1',executionTimeout:180,saveDataErrorExecution:'all',saveDataSuccessExecution:'all',errorWorkflow:'mgvnNUDfqNatEy3e'}};
}
if(process.argv[1] && fileURLToPath(import.meta.url)===resolve(process.argv[1])) {
  const baseline=JSON.parse(zlib.gunzipSync(fs.readFileSync(process.argv[2])));
  baseline.L8Nn7xncA9ZPDdWA=baseline.official;
  const out=process.argv[3];if(!out)throw Error('Private output directory required');fs.mkdirSync(out,{recursive:true});
  for(const[id,operations]of Object.entries(buildPatches(baseline)))fs.writeFileSync(out+'/'+id+'.ops.json',JSON.stringify(operations));
  fs.writeFileSync(out+'/coverage.json',JSON.stringify(buildCoverage(baseline)));
  console.log('Built scoped patches and coverage checker; no production changes made by builder.');
}
