// Reads private fixtures from stdin; prints only bounded metadata receipts.
// No network, model calls, document writes, dashboard writes, or notifications.
import fs from 'node:fs';
import { gunzipSync } from 'node:zlib';
import assert from 'node:assert/strict';
import { identityLines } from './prospect-identity.mjs';

const read = path => JSON.parse(gunzipSync(fs.readFileSync(path)).toString());
const [baselinePath, patchesPath] = process.argv.slice(2);
const b = read(baselinePath), p = read(patchesPath);
const intake = 'qMQYNQtQbRZWjtG2', official = 'L8Nn7xncA9ZPDdWA';
const AsyncFunction = Object.getPrototypeOf(async function() {}).constructor;
async function execute(code, input, named = {}, json = input[0]?.json) {
  const lookup = name => ({itemMatching:index=>named[name][index],item:named[name]?.[0]});
  return new AsyncFunction('$input','$','$json',code)({all:()=>input,first:()=>input[0]},lookup,json);
}
const fixtures = JSON.parse(fs.readFileSync(0, 'utf8'));
const receipts = [];
for(const fixture of fixtures) {
  const text = fixture.text.replace(/\r/g,'');
  const head = key => text.split('\n').find(line=>line.trim().startsWith(key+':'))?.trim().slice(key.length+1).trim() || '';
  const marker = text.match(/\n\s*Full Transcript\s*\n/i);
  assert.ok(marker,'source has transcript boundary');
  const transcript = text.slice(marker.index+marker[0].length).trim();
  const source = {repName:head('Rep Name'),clientName:head('Client Name'),clientNameSource:head('Client Name Source'),clientEmail:head('Client Email'),clientEmailSource:head('Client Email Source'),
    meetingTitle:head('Meeting Title'),showName:head('Show Name'),showNameSource:'Zoom Meeting Title',mergedTranscript:transcript,
    automationKey:head('Automation Key'),meetingId:head('Meeting ID'),meetingUuid:head('Zoom Meeting UUID'),recordingFileId:head('Recording File ID')};
  const ai = {is_sales_call:true,decision_category:'valid_sales_call',call_number:head('Call #'),confidence:'high',attendance_status:'normal',reason:head('AI Reason')};
  const named = {'Parse VTT Transcript':[{json:source}]};
  const input = [{json:{output:ai}}];
  const before = (await execute(b[intake].nodes['Apply AI Sales Call Classification'].parameters.jsCode,input,named))[0].json;
  const after = (await execute(p[intake]['Apply AI Sales Call Classification'].jsCode,input,named))[0].json;
  for(const key of ['isSalesCall','decisionCategory','callNumber','attendanceStatus','processingStatus','ignoredReason','automationKey','meetingId','meetingUuid','recordingFileId']) assert.deepEqual(after[key],before[key],key);
  const doc = (await execute(p[intake]['Build Transcript Document'].jsCode,[{json:after}]))[0].json;
  assert.equal(doc.googleDocText.split('Full Transcript\n\n')[1],transcript,'raw transcript preserved');
  const cleaned = (await execute(p[official]['Clean Response'].jsCode,[{json:{body:{content:[{paragraph:{elements:[{textRun:{content:doc.googleDocText}}]}}]}}}]))[0].json;
  const caseItem = {cleaned_transcript:doc.googleDocText,metadata:{rep_name:source.repName,client_name:doc.clientName,call_number:'Call 2+'},source:{'Client Speaker Aliases':JSON.stringify(cleaned.client_speaker_aliases)}};
  const gated = await execute(p[official]['MM Parse Classifier'].jsCode,[{json:{parsed_json:{call_status:'scored'}}}],{'MM Build Classifier Request':[{json:{state:{caseItem,provider_results:[]}}}]});
  // These fixtures are saved scored calls with real rep + prospect dialogue.
  assert.equal(gated.json.state.gate_output.call_status,'scored','name correction must not exclude a real conversation');
  assert.ok(cleaned.client_speaker_aliases.every(alias=>identityLines(source).some(line=>line.speaker===alias)),'aliases have transcript speakers');
  const wrote = (await execute(p[intake]['Prepare Airtable Write'].jsCode,[{json:{...doc,documentId:'fixture-document',documentUrl:'https://example.test/doc'}}]))[0].json;
  assert.equal(wrote['Client Name'],after.clientName,'doc and source name agree');
  receipts.push({id:fixture.id,original:source.clientName,resolved:after.clientName,confidence:after.clientIdentity.confidence,aliases:cleaned.client_speaker_aliases,gate:gated.json.state.gate_output.call_status,originalShow:source.showName,resolvedShow:after.showName});
}
console.log(JSON.stringify({passed:receipts.length,changed:receipts.filter(r=>r.original!==r.resolved).length,fallbackProspect:receipts.filter(r=>r.resolved==='Prospect').length,receipts},null,2));
