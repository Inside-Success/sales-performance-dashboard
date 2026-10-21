import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
export function buildHandoffSafety(b) {
 const get=n=>structuredClone(b.official.nodes.find(x=>x.name===n));
 const add=node=>({type:'addNode',node});
 const edge=(source,target,sourceIndex=0)=>({type:'addConnection',source,target,sourceIndex});
 const http=(name,body)=>({...get('MM Observe Source Start'),id:name,name,position:[400,1000],parameters:{...get('MM Observe Source Start').parameters,url:'https://sales-performance-dashboard-rose.vercel.app/api/internal/coaching-source-claim',body,options:{timeout:60000}}});
 const iff=(name,expression)=>({id:name,name,type:'n8n-nodes-base.if',typeVersion:2.2,position:[600,1000],parameters:{conditions:{options:{version:2,caseSensitive:true,leftValue:'',typeValidation:'strict'},conditions:[{id:name,leftValue:expression,rightValue:true,operator:{type:'boolean',operation:'equals'}}],combinator:'and'},options:{}}});
 const code=(name,jsCode)=>({id:name,name,type:'n8n-nodes-base.code',typeVersion:2,position:[800,1000],parameters:{jsCode}});
 const claimBody="={{ JSON.stringify({action:'claim',source_id:$('Loop Over Items').item.json['Source Airtable Record ID'],identity:$('Loop Over Items').item.json['Scorecard Key'],execution_id:String($execution.id),recovery:$('MM Recovery Entry').isExecuted}) }}";
 const claim=http('MM Claim Source',claimBody);
 const restore=code('MM Restore Claimed Source',"return $input.all().map((item,i)=>({json:$('Loop Over Items').itemMatching(i).json,pairedItem:{item:i}}));");
 const previous=structuredClone(b.executionHttp);previous.id=previous.name='MM Read Previous Source Execution';previous.parameters.url="={{ 'https://insidesuccess.app.n8n.cloud/api/v1/executions/' + $json.owner }}";previous.onError='continueErrorOutput';
 const takeover=http('MM Claim Terminal Source',"={{ JSON.stringify({action:'claim',source_id:$('Loop Over Items').item.json['Source Airtable Record ID'],identity:$('Loop Over Items').item.json['Scorecard Key'],execution_id:String($execution.id),recovery:true,previous_owner:String($json.id),previous_status:$json.status}) }}");
 const terminal=iff('MM Previous Source Terminal',"={{ ['error','crashed','canceled'].includes($json.status) && String($json.id) === String($('MM Claim Source').item.json.owner) }}");
 const ops=[add(claim),add(iff('MM Source Acquired','={{ $json.acquired === true }}')),add(restore),
 add(iff('MM Can Check Previous Source',"={{ $('MM Recovery Entry').isExecuted && $json.status === 'running' && $json.source_id === $('Loop Over Items').item.json['Source Airtable Record ID'] && /^\\d+$/.test(String($json.owner || '')) }}")),add(previous),add(terminal),add(takeover),add(iff('MM Terminal Source Acquired','={{ $json.acquired === true }}')),
 {type:'rewireConnection',source:'Loop Over Items',from:'MM Observe Source Start',to:'MM Claim Source',sourceIndex:1},
 edge('MM Claim Source','MM Source Acquired'),edge('MM Claim Source','Set: fetch_failed',1),
 edge('MM Source Acquired','MM Restore Claimed Source'),edge('MM Source Acquired','MM Can Check Previous Source',1),edge('MM Restore Claimed Source','MM Observe Source Start'),
 edge('MM Can Check Previous Source','MM Read Previous Source Execution'),edge('MM Can Check Previous Source','Loop Over Items',1),
 edge('MM Read Previous Source Execution','MM Previous Source Terminal'),edge('MM Read Previous Source Execution','MM Accounting Incident',1),
 edge('MM Previous Source Terminal','MM Claim Terminal Source'),edge('MM Previous Source Terminal','Loop Over Items',1),
 edge('MM Claim Terminal Source','MM Terminal Source Acquired'),edge('MM Claim Terminal Source','Set: fetch_failed',1),
 edge('MM Terminal Source Acquired','MM Restore Claimed Source'),edge('MM Terminal Source Acquired','Loop Over Items',1)];
 // One settlement after persisted receipts. Owner comparison prevents another run releasing the claim.
 const finish=http('MM Settle Source Claim',"={{ JSON.stringify({action:'settle',source_id:$json.source_id,execution_id:String($execution.id),status:$json.status}) }}");
 ops.push(add(finish),edge('MM Settle Source Claim','MM Accounting Incident',1));
 for(const name of ['MM Save Coaching Delivery','MM Save Coaching Exclusion','MM Save Classifier Exclusion','MM Save Unfinished Coaching'])ops.push(edge(name,'MM Settle Source Claim'));
 // Recovery artifact check also covers duplicate intake rows for one recording.
 const duplicate=get('MM Recovery Existing Reports');
 duplicate.parameters.queryParameters.parameters[0].value="={{ \"OR({source_airtable_record_id}='\" + $('MM Recovery Entry').item.json.source_id + \"',{scorecard_key}='\" + String($('MM Recovery Source Record').item.json.fields?.['Automation Key'] || 'airtable:' + $('MM Recovery Entry').item.json.source_id).replace(/\\\\/g,'\\\\\\\\').replace(/'/g,\"\\\\'\") + \"')\" }}";
 ops.push({type:'updateNode',nodeName:duplicate.name,updates:{'parameters.queryParameters':duplicate.parameters.queryParameters}});
 const plan=b.coverage.nodes.find(n=>n.name==='Plan Coverage Outcome').parameters.jsCode.replace('checked:scan.checked','checked:scan.checked,queue_ids:missing.filter(id=>(scan.never_started_ids||[]).includes(id)&&!bySource.has(id)).slice(0,1)');
 if(plan===b.coverage.nodes.find(n=>n.name==='Plan Coverage Outcome').parameters.jsCode)throw Error('Plan anchor changed');
 const reserve=http('Reserve Missing Start',"={{ JSON.stringify({action:'reserve',source_id:$json.queue_ids[0]}) }}");delete reserve.onError;
 const save=get('MM Save Unfinished Coaching');save.id=save.name='Queue Missing Start';
 const prepare=code('Prepare Missing Start',"return [{json:{source_id:$json.source_id,status:'queued',execution_id:String($execution.id),updated_at:new Date().toISOString(),report_id:'',attempts:0,message:'kind=missing_handoff | verified never-started source; recover through normal coaching checks'},pairedItem:{item:0}}];");
 const restorePlan=code('Restore Coverage Plan',"return [{json:$('Plan Coverage Outcome').first().json,pairedItem:{item:0}}];");
 const coverage=[{type:'updateNode',nodeName:'Plan Coverage Outcome',updates:{'parameters.jsCode':plan}},
 add(iff('Has Missing Start','={{ $json.queue_ids.length > 0 }}')),add(reserve),add(iff('Missing Start Reserved','={{ $json.reserved === true }}')),add(prepare),add(save),add(restorePlan),
 {type:'rewireConnection',source:'Plan Coverage Outcome',from:'New Coverage Gap',to:'Has Missing Start'},
 edge('Has Missing Start','Reserve Missing Start'),edge('Has Missing Start','New Coverage Gap',1),edge('Reserve Missing Start','Missing Start Reserved'),
 edge('Missing Start Reserved','Prepare Missing Start'),edge('Missing Start Reserved','Restore Coverage Plan',1),edge('Prepare Missing Start','Queue Missing Start'),edge('Queue Missing Start','Restore Coverage Plan'),edge('Restore Coverage Plan','New Coverage Gap'),
 {type:'updateNode',nodeName:'Notify Coverage Gap',updates:{'parameters.text':"={{ 'Magic Mike coverage: '+$('Plan Coverage Outcome').first().json.notify.length+' unresolved source(s). Sources: '+$('Plan Coverage Outcome').first().json.notify.slice(0,10).join(', ')+'. Verified never-started calls are eligible for bounded recovery; partial or uncertain deliveries remain held.' }}"}}];
 return {official:ops,coverage};
}
if(process.argv[1]===fileURLToPath(import.meta.url))fs.writeFileSync(process.argv[3],JSON.stringify(buildHandoffSafety(JSON.parse(fs.readFileSync(process.argv[2]))),null,2));
