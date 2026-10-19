import fs from 'node:fs';
import {fileURLToPath} from 'node:url';

export function accountEarlyOutcome(row, input, executionId, attempts=0) {
  const sourceId=row?.['Source Airtable Record ID'];
  if(!/^rec[A-Za-z0-9]+$/.test(sourceId||'')) throw Error('Accounting source identity missing; no receipt written');
  const raw=input.call_status;
  const status=raw==='call_1_skipped'?'call_1':raw;
  if(!['call_1','transcript_too_short'].includes(status)) throw Error('Unexpected early outcome; no exclusion written');
  const gate=input._mm_classifier_gate?JSON.parse(input._mm_classifier_gate):null;
  if(gate && (gate.call_status!==status || !gate.classification_reason)) throw Error('Classifier/terminal outcome mismatch');
  return {source_id:sourceId,status:status==='call_1'?'excluded':'needs_review',execution_id:String(executionId),
    updated_at:new Date().toISOString(),attempts,report_id:'',message:JSON.stringify({
      revision:gate?.guard_revision||'accounting-containment-2026-10-19',status,
      raw_status:raw,reason:gate?.classification_reason||input.skip_reason||'Empty transcript; inspect source before retry',
      original_status:gate?.classifier_original_status,original_reason:gate?.classifier_original_reason})};
}

export function buildAccountingContainment(b) {
  const get=name=>{const n=b.nodes.find(n=>n.name===name);if(!n)throw Error('Missing production node '+name);return n;};
  const ops=[];
  const update=(nodeName,updates)=>ops.push({type:'updateNode',nodeName,updates});
  if(get('Set: call_1').parameters.assignments.assignments.find(a=>a.name==='call_status')?.value!=='call_1_skipped') throw Error('Unexpected Call 1 boundary');
  const assignments=structuredClone(get('Set: call_1').parameters.assignments.assignments);
  if(assignments.some(a=>a.name==='_mm_classifier_gate'))throw Error('Patch already applied');
  assignments.push({id:'mm-classifier-provenance',name:'_mm_classifier_gate',type:'string',value:'={{ JSON.stringify($json.pipeline?.gate_output || null) }}'});
  update('Set: call_1',{'parameters.assignments.assignments':assignments});
  // Classifier Call 1 goes through its terminal Set; all other classifier exclusions keep their existing writer.
  update('MM Record Recovery Classifier Gate',{'parameters.conditions.conditions.0.leftValue':"={{ $json.gate_output?.call_status !== 'call_1' }}"});
  update('MM Account Early Outcome',{'parameters.jsCode':accountEarlyOutcome.toString()+"\nreturn {json:accountEarlyOutcome($('Loop Over Items').item.json,$json,$execution.id,$('MM Recovery Entry').isExecuted?Number($('MM Recovery Entry').first().json.recovery_attempt||1):0),pairedItem:{item:0}};",onError:'continueErrorOutput'});
  update('MM Recovered Classifier Exclusion',{onError:'continueErrorOutput'});
  update('MM Save Classifier Exclusion',{onError:'continueErrorOutput',retryOnFail:true,maxTries:3,waitBetweenTries:1000});
  const incident={id:'mm-accounting-incident',name:'MM Accounting Incident',type:'n8n-nodes-base.code',typeVersion:2,position:[12400,9100],parameters:{mode:'runOnceForEachItem',jsCode:`let source='';try{source=$('Loop Over Items').item.json['Source Airtable Record ID']||'';}catch{}
const message=String($json.error?.message||$json.error||$json.message||'Source outcome receipt failed').replace(/Bearer\\s+\\S+/gi,'Bearer [redacted]').replace(/https?:\\/\\/\\S+/g,'[url]').slice(0,800);
console.error('Magic Mike accounting failure',String($execution.id),source,message);
return {json:{event_key:'accounting:'+$execution.id+':'+source,workflow_id:$workflow.id,execution_id:String($execution.id),call_key:source,stage:'source_accounting',status:'needs_review',message,occurred_at:new Date().toISOString()},pairedItem:{item:0}};`}};
  ops.push({type:'addNode',node:incident});
  const store=structuredClone(get('MM Store Recovery Event'));
  Object.assign(store,{id:'mm-store-accounting-incident',name:'MM Store Accounting Incident',position:[12700,9100],onError:'continueRegularOutput',retryOnFail:true,maxTries:3,waitBetweenTries:1000});
  ops.push({type:'addNode',node:store});
  const alert=structuredClone(get('Send Ops Alert'));
  Object.assign(alert,{id:'mm-notify-accounting-incident',name:'MM Notify Accounting Incident',position:[12700,9350],onError:'continueRegularOutput'});
  alert.parameters={resource:'message',operation:'post',select:'channel',channelId:{__rl:true,mode:'id',value:'C0B09AVJ35Z'},messageType:'text',text:"={{ 'Magic Mike source tracking needs review. Source: '+$json.call_key+'. Execution: '+$json.execution_id+'. '+$json.message+'. Other calls continue; no report was replayed.' }}",otherOptions:{includeLinkToWorkflow:false}};
  delete alert.webhookId;
  ops.push({type:'addNode',node:alert});
  for(const source of ['MM Account Early Outcome','MM Recovered Classifier Exclusion','MM Save Classifier Exclusion']) ops.push({type:'addConnection',source,target:'MM Accounting Incident',sourceIndex:1});
  for(const target of [store.name,alert.name])ops.push({type:'addConnection',source:incident.name,target});
  return ops;
}

if(process.argv[1]===fileURLToPath(import.meta.url))fs.writeFileSync(process.argv[3],JSON.stringify(buildAccountingContainment(JSON.parse(fs.readFileSync(process.argv[2])))));
