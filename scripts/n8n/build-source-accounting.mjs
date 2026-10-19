import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {identityRep,identityPerson} from './prospect-identity.mjs';
import {coveragePlan} from '../../src/lib/coaching-reliability-policy.mjs';

function once(text,from,to) {
  if(text.split(from).length!==2)throw Error('Non-unique release anchor: '+from.slice(0,90));
  return text.replace(from,()=>to);
}
export function buildSourceAccounting(b) {
  const ops=[];
  const node=name=>b.official.nodes.find(n=>n.name===name);
  const update=(name,key,value)=>ops.push({type:'updateNode',nodeName:name,updates:{[key]:value}});
  let clean=node('Clean Response').parameters.jsCode;
  const start=clean.indexOf('function identityRep('),end=clean.indexOf('function identityBody(',start);
  if(start<0||end<0)throw Error('Missing identity anchor');
  clean=clean.slice(0,start)+identityRep.toString()+'\n'+clean.slice(end);
  const personStart=clean.indexOf('function identityPerson('),personEnd=clean.indexOf('function identityFirst(',personStart);
  if(personStart<0||personEnd<0)throw Error('Missing person anchor');
  clean=clean.slice(0,personStart)+identityPerson.toString()+'\n'+clean.slice(personEnd);
  clean=once(clean,'.filter(name => present.includes(name))',`.map(identityText).filter(name => present.includes(name))`);
  update('Clean Response','parameters.jsCode',clean);
  let parser=node('MM Parse Classifier').parameters.jsCode;
  parser=once(parser,'if (speakerName === expected) return true;',`if (speakerName === expected) return true;
  // A role-qualified first name is grounded in the assigned rep, not a global first-name match.
  if (/\\b(?:casting manager|sales rep|closer)\\b/i.test(speaker)
      && speakerName.replace(/\\b(?:casting manager|sales rep|closer)\\b/g,'').trim() === expected.split(' ')[0]) return true;`);
  parser=once(parser,'const speaker = match[1].trim();',`const speaker = match[1].normalize('NFKC').replace(/\\s+/g,' ').trim();`);
  parser=once(parser,"rawAliases.slice(0, 8).filter(alias =>", "rawAliases.slice(0, 8).map(alias => typeof alias === 'string' ? alias.normalize('NFKC').replace(/\\s+/g,' ').trim() : alias).filter(alias =>");
  parser=once(parser,'if (isNotetakerName(value)) return false;',`if (isNotetakerName(value) || /^(?:audio shared by|screen share|shared screen|recording|system)\\b/i.test(value)) return false;`);
  parser=once(parser,'const credibleClientPresent = clientPresent || (clientNameWasNotetaker && longSalesTranscript && (humanNonRepSpeakers.length > 0 || upstreamNormal));', 'const credibleClientPresent = clientPresent || (longSalesTranscript && (humanNonRepSpeakers.length > 0 || (clientNameWasNotetaker && upstreamNormal)));');
  parser=once(parser,'clientNameWasNotetaker, upstreamNormal, body };','clientNameWasNotetaker, upstreamNormal, upstreamStatus, body };');
  parser=once(parser,'next.call_status === "transcript_too_short" && !signals.repPresent && signals.humanNonRepSpeakers.length > 0', 'next.call_status === "transcript_too_short" && !signals.repPresent && signals.humanNonRepSpeakers.length > 0 && /^(?:sales_)?rep_no_show$/.test(signals.upstreamStatus)');
  parser=once(parser,'state.gate_output = applyAttendanceGuards(parsed || {}, state.caseItem);',`state.gate_output = applyAttendanceGuards(parsed || {}, state.caseItem);
state.gate_output.classifier_original_status = parsed?.call_status || parsed?.status || '';
state.gate_output.classifier_original_reason = parsed?.classification_reason || parsed?.reason || '';
state.gate_output.guard_revision = 'source-accounting-2026-10-19';`);
  update('MM Parse Classifier','parameters.jsCode',parser);
  update('Get a document','retryOnFail',true);update('Get a document','maxTries',3);update('Get a document','waitBetweenTries',3000);
  update('MM Record Recovery Classifier Gate','parameters.conditions.conditions.0.leftValue','={{ true }}');
  let receipt=node('MM Recovered Classifier Exclusion').parameters.jsCode;
  receipt=once(receipt,"attempts:1,", "attempts:$('MM Recovery Entry').isExecuted?Number($('MM Recovery Entry').first().json.recovery_attempt||1):0,");
  receipt=once(receipt,"message:g.call_status+': '+g.classification_reason", "message:JSON.stringify({revision:g.guard_revision||'source-accounting-2026-10-19',status:g.call_status,reason:g.classification_reason,original_status:g.classifier_original_status,original_reason:g.classifier_original_reason})");
  update('MM Recovered Classifier Exclusion','parameters.jsCode',receipt);
  // Early document failures occur before If exists. Use the loop's paired source.
  const queue=node('MM Queue Unfinished Coaching').parameters.jsCode;
  let early=queue.replace("$('Set: agent_failed').item.json","$('Set: fetch_failed').item.json").replace("$('If').item.json['Source Airtable Record ID']","$('Loop Over Items').item.json['Source Airtable Record ID']");
  early=once(early,"let message=String(failure.error_details||failure.error?.message||failure.message||'Coaching failed');",`let message=String(failure.error_details||failure.error?.message||failure.message||'Transcript fetch failed');
if (/service was not able to process|service unavailable|internal server error/i.test(message)) message='HTTP 503 transcript source: '+message;`);
  ops.push({type:'addNode',node:{id:'mm-queue-source-fetch',name:'MM Queue Transcript Fetch',type:'n8n-nodes-base.code',typeVersion:2,position:[11800,8900],parameters:{mode:'runOnceForEachItem',jsCode:early}}});
  ops.push({type:'addConnection',source:'Set: fetch_failed',target:'MM Queue Transcript Fetch'},{type:'addConnection',source:'MM Queue Transcript Fetch',target:'MM Save Unfinished Coaching'});
  const earlyOutcome={id:'mm-account-early-outcome',name:'MM Account Early Outcome',type:'n8n-nodes-base.code',typeVersion:2,position:[11800,9100],parameters:{mode:'runOnceForEachItem',jsCode:"const row=$('Loop Over Items').item.json; const status=$json.call_status; if(!['call_1','transcript_too_short'].includes(status))throw Error('Unexpected early outcome'); return {json:{source_id:row['Source Airtable Record ID'],status:status==='call_1'?'excluded':'needs_review',execution_id:String($execution.id),updated_at:new Date().toISOString(),attempts:$('MM Recovery Entry').isExecuted?Number($('MM Recovery Entry').first().json.recovery_attempt||1):0,report_id:'',message:JSON.stringify({revision:'source-accounting-2026-10-19',status,reason:$json.skip_reason||'Empty transcript; inspect source before retry'})},pairedItem:{item:0}};"}};
  ops.push({type:'addNode',node:earlyOutcome},{type:'addConnection',source:'Set: call_1',target:'MM Account Early Outcome'},{type:'addConnection',source:'Set: too_short',target:'MM Account Early Outcome'},{type:'addConnection',source:'MM Account Early Outcome',target:'MM Save Classifier Exclusion'});
  // Observation is append-only in owned Postgres. Its failure must never stop a source read.
  const observe=structuredClone(b.coverage.nodes.find(n=>n.name==='Read Coverage Page'));
  Object.assign(observe,{id:'mm-observe-source-start',name:'MM Observe Source Start',typeVersion:4.5,position:[0,1000],onError:'continueErrorOutput'});
  observe.parameters.body="={{ JSON.stringify({action:'observe',source_id:$json['Source Airtable Record ID'],execution_id:String($execution.id)}) }}";
  observe.parameters.options={timeout:10000};
  ops.push({type:'addNode',node:observe});
  ops.push({type:'addNode',node:{id:'mm-restore-source-start',name:'MM Restore Source Start',type:'n8n-nodes-base.code',typeVersion:2,position:[200,1000],parameters:{mode:'runOnceForEachItem',jsCode:"return {json:$('Loop Over Items').item.json,pairedItem:{item:0}};"}}});
  ops.push({type:'rewireConnection',source:'Loop Over Items',from:'Get a document',to:'MM Observe Source Start',sourceIndex:1});
  ops.push({type:'addConnection',source:'MM Observe Source Start',target:'MM Restore Source Start',sourceIndex:0},{type:'addConnection',source:'MM Observe Source Start',target:'MM Restore Source Start',sourceIndex:1},{type:'addConnection',source:'MM Restore Source Start',target:'Get a document'});
  return {official:ops,coverage:[{type:'updateNode',nodeName:'Plan Coverage Outcome',updates:{'parameters.jsCode':coveragePlan.toString()+"\nconst plan=coveragePlan($('Read Coverage Page').first().json,$input.all().map(x=>x.json));return plan?[{json:plan,pairedItem:{item:0}}]:[];"}}]};
}
if(process.argv[1]===fileURLToPath(import.meta.url)) {
  const b=JSON.parse(fs.readFileSync(process.argv[2]));
  fs.writeFileSync(process.argv[3],JSON.stringify(buildSourceAccounting(b)));
}
