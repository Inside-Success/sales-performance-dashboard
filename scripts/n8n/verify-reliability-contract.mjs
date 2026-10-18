import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import {buildPatches,buildCoverage} from './build-reliability-contract.mjs';
import {failureDecision,normalizeCoaching,coachingContractErrors} from '../../src/lib/coaching-reliability-policy.mjs';
const code=(name,jsCode)=>({id:name,name,type:'n8n-nodes-base.code',parameters:{jsCode}});
const http={id:'claim',name:'Claim Checkpoint',type:'n8n-nodes-base.httpRequest',typeVersion:4.4,position:[0,0],parameters:{url:'checkpoint',options:{timeout:30000}},credentials:{httpHeaderAuth:{id:'existing-reference'}}};
const validator="const s=$('Validate Claim').first().json;const r=$json;let valid=true;const providerError='';return [{json:{valid,result:r,error:providerError || r.parse_error || ('invalid')}}];";
const renderer="function renderCoaching(analysis,blocks,options={}) {return analysis;}return [];";
const baseline={
  X9L4JtDbpkSCflxZ:{nodes:[http,code('Validate Result',validator),code('Restore Cached Result','const s=$json;const r=s.checkpoint.result;return [{json:r}];')]},
  FShnTde2OGhIUZE4:{nodes:[code('Validate Draft',renderer)]},
  BMRrGxHyXMcgO6j3:{nodes:[code('MM Manual Render Audited Coaching',renderer)]},
  L8Nn7xncA9ZPDdWA:{nodes:[]},
  mIsdpJO71D8DMrxe:{nodes:[code('Read Failed Executions',''),code('Read Crashed Executions',''),code('Select Unscanned Failures',"return selectFailures([$('Read Failed Executions').first().json,$('Read Crashed Executions').first().json],[]);"),{id:'receipts',name:'Read Completion Receipts',type:'n8n-nodes-base.dataTable',parameters:{}},{id:'alert',name:'Notify Recovered Batch Gap',type:'n8n-nodes-base.slack',parameters:{}}]},
};
const b=process.argv[2]?JSON.parse(zlib.gunzipSync(fs.readFileSync(process.argv[2]))):baseline;
if(b.official)b.L8Nn7xncA9ZPDdWA=b.official;
const patches=buildPatches(b),coverage=buildCoverage(b);
for(const operations of Object.values(patches))for(const op of operations){
  const body=op.updates?.['parameters.jsCode']||op.node?.parameters?.jsCode;
  if(body)new Function(body);
}
const allowed=new Set(['updateNode','addNode','rewireConnection','addConnection']);
assert(Object.values(patches).flat().every(op=>allowed.has(op.type)));
assert(patches.L8Nn7xncA9ZPDdWA.some(op=>op.node?.name==='MM Read Checkpoint State'));
assert(!coverage.nodes.some(n=>/anthropic|deepseek|googleDrive|airtable|chainLlm/i.test(n.type)));
assert(coverage.nodes.filter(n=>n.type==='n8n-nodes-base.httpRequest').every(n=>n.parameters.url.endsWith('/api/internal/coaching-coverage')));
const names=new Set(coverage.nodes.map(n=>n.name));
for(const [name,outputs]of Object.entries(coverage.connections)){assert(names.has(name));for(const edge of outputs.main.flat())assert(names.has(edge.node));}
for(const n of coverage.nodes)if(n.parameters.jsCode)new Function(n.parameters.jsCode);
// Reproduce the real Matt field mismatch against the compiled provider node, not a mirrored validator.
const parsed={status:'completed',call_status:'scored',outcome:{payment:'not_confirmed',summary:'No payment',evidence_ids:['T1']},payment_actions:[],strengths:[{action:'Exact saved action',evidence_ids:['T1']}],improvements:[],blockers:[],next_steps:[]};
const body=patches.X9L4JtDbpkSCflxZ.find(op=>op.nodeName==='Validate Result').updates['parameters.jsCode'];
if(!process.argv[2]){
 const output=new Function('$json','$',body)({ok:true,parsed_json:parsed},()=>({first:()=>({json:{call_purpose:'call2_sonnet5_writer',checkpoint:{}}})}));
 assert.equal(output[0].json.valid,true);
 const malformed=new Function('$json','$',body)({ok:true,parsed_json:{...parsed,call_status:'transcript_too_short'}},()=>({first:()=>({json:{call_purpose:'call2_sonnet5_writer',checkpoint:{}}})}));
 assert.equal(malformed[0].json.valid,true,'Transport-valid drafts must reach the existing targeted repair');
 assert(malformed[0].json.result.contract_errors.includes('invalid coaching status'));
}
assert.equal(coachingContractErrors(normalizeCoaching(parsed)).length,0);
assert.equal(failureDecision('Missing strength | Transcript chars: 40503',[],2).retryable,false);
assert.equal(failureDecision('HTTP 503 Service Unavailable').retryable,true);
assert.equal(failureDecision('Error executing workflow with item at index 0',[{status:'running',stage:'audit',updated_at:'2026-10-18',lease_until:'2099-01-01'}]).retryable,true);
console.log('Reliability contract: compiled node syntax, cached alias incident, retry classification, diagnostic wiring and read-only coverage boundaries passed.');
