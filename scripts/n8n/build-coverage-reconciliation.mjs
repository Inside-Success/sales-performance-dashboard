import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {coveragePlan} from '../../src/lib/coaching-reliability-policy.mjs';
export function writeFailureReceipt(sourceId,executionId,failure,now=new Date().toISOString()) {
 if(!/^rec[A-Za-z0-9]+$/.test(sourceId)||!/^\d+$/.test(String(executionId)))throw Error('Invalid write-failure identity');
 return {source_id:sourceId,execution_id:String(executionId),status:'needs_review',attempts:0,report_id:'',updated_at:now,
 message:'kind=uncertain_write | Airtable scorecard write failed; verify artifacts before recovery. '+String(failure.error_details||failure.skip_reason||'Unknown write failure').replace(/Bearer\s+\S+/gi,'Bearer [redacted]').slice(0,600)};
}
export function buildReconciliation(official,coverage) {
 const copy=n=>structuredClone(official.nodes.find(x=>x.name===n));
 const record={id:'MM Record Scorecard Write Failure',name:'MM Record Scorecard Write Failure',type:'n8n-nodes-base.code',typeVersion:2,position:[12000,8500],onError:'continueErrorOutput',parameters:{mode:'runOnceForEachItem',jsCode:writeFailureReceipt.toString()+"\nreturn {json:writeFailureReceipt($('Loop Over Items').item.json['Source Airtable Record ID'],$execution.id,$json),pairedItem:{item:0}};"}};
 const save=copy('MM Save Unfinished Coaching');save.id=save.name='MM Save Scorecard Write Failure';save.onError='continueErrorOutput';save.position=[12200,8500];
 const settle=copy('MM Settle Source Claim');settle.id=settle.name='MM Settle Scorecard Hold';settle.position=[12400,8500];
 const restore={id:'MM Restore Scorecard Alert',name:'MM Restore Scorecard Alert',type:'n8n-nodes-base.code',typeVersion:2,position:[12600,8500],parameters:{mode:'runOnceForEachItem',jsCode:"return {json:$('Set: airtable_failed').item.json,pairedItem:{item:0}};"}};
 const ops=[...[record,save,settle,restore].map(node=>({type:'addNode',node})),
 {type:'rewireConnection',source:'Set: airtable_failed',from:'Build Ops Alert',to:record.name},
 {type:'addConnection',source:record.name,target:save.name},{type:'addConnection',source:save.name,target:settle.name},
 {type:'addConnection',source:settle.name,target:restore.name},{type:'addConnection',source:restore.name,target:'Build Ops Alert'},
 ...[record.name,save.name,settle.name].map(source=>({type:'addConnection',source,target:'MM Accounting Incident',sourceIndex:1}))];
 let plan=coveragePlan.toString().replace('checked:scan.checked}',"checked:scan.checked,queue_ids:(()=>{const eligible=missing.filter(id=>(scan.never_started_ids||[]).includes(id)&&!bySource.has(id));return eligible.length?[eligible[Math.floor(Date.now()/900000)%eligible.length]]:[];})()}");
 if(!plan.includes('queue_ids'))throw Error('Coverage plan anchor changed');
 plan+="\nconst plan=coveragePlan($('Read Coverage Page').first().json,$input.all().map(x=>x.json));return plan?[{json:plan,pairedItem:{item:0}}]:[];";
 return {official:ops,coverage:[{type:'updateNode',nodeName:'Plan Coverage Outcome',updates:{'parameters.jsCode':plan}}]};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const dir=process.argv[2];fs.writeFileSync(dir+'/reconciliation-ops.json',JSON.stringify(buildReconciliation(JSON.parse(fs.readFileSync(dir+'/L8Nn7xncA9ZPDdWA.json')),JSON.parse(fs.readFileSync(dir+'/yL5XsZPtVP1rsW8X.json'))),null,2));}
