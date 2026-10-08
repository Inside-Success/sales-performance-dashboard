import assert from 'node:assert/strict';
import fs from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolveProspectIdentity, identityBot } from './prospect-identity.mjs';

const base = { repName: 'Taylor Rep', clientName: 'iPhone (2)', clientNameSource: 'Zoom Display Name',
  meetingTitle: 'Jacob Example - Inside Success - Followup Casting Call',
  showName: 'Jacob Example', showNameSource: 'Zoom Meeting Title',
  mergedTranscript: '[00:01:00.000] Taylor Rep: Hi, Jake. Can you hear me?\n[00:01:03.000] iPhone (2): Yes, I can.' };
let count = 0;
function test(name, fn) { fn(); count++; console.log('PASS', name); }
test('device corrected with title corroboration; original speaker retained', () => {
  const r = resolveProspectIdentity(base);
  assert.equal(r.clientName, 'Jacob Example'); assert.deepEqual(r.clientIdentity.speakerAliases, ['iPhone (2)']);
  assert.equal(r.showName, ''); assert.equal(r.clientIdentity.originalDisplayName, 'iPhone (2)');
});
test('no transcript proof retains original device label', () => {
  assert.equal(resolveProspectIdentity({ ...base, mergedTranscript: '[00:00:01] iPhone (2): Hello.' }).clientName, 'iPhone (2)');
});
test('a valid existing human name is retained', () => {
  assert.equal(resolveProspectIdentity({ ...base, clientName: 'Jacob Example' }).clientName, 'Jacob Example');
});
test('incidental third-party mentions cannot establish identity', () => {
  assert.equal(resolveProspectIdentity({ ...base, mergedTranscript: '[00:01:00] Taylor Rep: Jake is a famous actor.\n[00:01:03] iPhone (2): Interesting.' }).clientName, 'iPhone (2)');
});
test('greeting does not overwrite contradictory human name', () => {
  assert.equal(resolveProspectIdentity({ ...base, clientName: 'Mary Example', meetingTitle:'' }).clientName, 'Mary Example');
});
test('borrowed Zoom account is corrected with a corroborating title and direct address', () => {
  const source = {...base,clientName:'Mary Example',mergedTranscript:'[00:01:00] Taylor Rep: Hi Jake, how are you?\n[00:01:03] Mary Example: Good, thank you.'};
  const resolved = resolveProspectIdentity(source);
  assert.equal(resolved.clientName,'Jacob Example'); assert.deepEqual(resolved.clientIdentity.speakerAliases,['Mary Example']);
});
test('conflicting surname is not resolved by first-name greeting', () => {
  assert.equal(resolveProspectIdentity({ ...base, clientName: 'Jacob Other' }).clientName, 'Jacob Other');
});
test('bot is not a prospect; human speaker remains usable', () => {
  const r = resolveProspectIdentity({ ...base, clientName: 'Fireflies Notetaker', meetingTitle: '', showName: '',
    mergedTranscript: '[00:01:00] Taylor Rep: Hello.\n[00:01:03] Jamie Actual: Hello.' });
  assert.equal(r.clientName, 'Jamie Actual'); assert.deepEqual(r.clientIdentity.speakerAliases, ['Jamie Actual']);
  assert.equal(identityBot('Audio shared by Taylor Rep'), true);
});
test('bot-only transcript does not establish prospect attendance', () => {
  const r = resolveProspectIdentity({ ...base, clientName: 'Fireflies Notetaker',
    mergedTranscript: '[00:01:00] Taylor Rep: Hello?\n[00:01:03] Fireflies Notetaker: Recording started.' });
  assert.equal(r.clientName, 'Prospect'); assert.deepEqual(r.clientIdentity.speakerAliases, []);
});
test('multiple speakers do not arbitrarily turn greeting into primary identity', () => {
  const r = resolveProspectIdentity({ ...base, mergedTranscript: base.mergedTranscript + '\n[00:01:08] Mary Partner: I am also here.' });
  assert.equal(r.clientName, 'iPhone (2)');
});
test('high-confidence evidence is grounded in the actual quote and speaker', () => {
  const source = { ...base, meetingTitle: '', mergedTranscript: '[00:01:03.000] iPhone (2): My name is Jamie Actual. Nice to meet you.' };
  const ai = { client_name: 'Jamie Actual', client_speaker_label: 'iPhone (2)', name_confidence: 'high',
    name_evidence: { quote: 'My name is Jamie Actual.', timestamp: '00:01:03.000', speaker: 'iPhone (2)' } };
  assert.equal(resolveProspectIdentity(source, ai).clientName, 'Jamie Actual');
  assert.equal(resolveProspectIdentity(source, { ...ai, client_name: 'Invented Name', name_evidence: { quote: 'My name is Invented Name.' } }).clientName, 'iPhone (2)');
});
test('no invented surname from a first-name quote', () => {
  const source = { ...base, meetingTitle: '', mergedTranscript: '[00:01:03] iPhone (2): My name is Jamie.' };
  const ai = { client_name: 'Jamie Invented', client_speaker_label: 'iPhone (2)', name_confidence: 'high', name_evidence: { quote: 'My name is Jamie.' } };
  assert.equal(resolveProspectIdentity(source, ai).clientName, 'iPhone (2)');
});
test('only exact matched manually verified records override extraction', () => {
  const source = { ...base, automationKey: 'zoom:instance:file', existingFields: { 'Automation Key': 'zoom:instance:file', 'Client Name': 'Approved Name', 'Client Name Source': 'Manual' } };
  assert.equal(resolveProspectIdentity(source).clientName, 'Approved Name');
  assert.equal(resolveProspectIdentity({ ...source, automationKey: 'zoom:different:file' }).clientName, 'Jacob Example');
});
test('unrelated email is not rebound to a different attendee', () => {
  const source = { ...base, clientName: 'Wrong Participant', clientEmail: 'other@example.test', clientEmailSource: 'Zoom Participant',
    mergedTranscript: '[00:01:03] iPhone (2): My name is Jacob Example.', prospectParticipants: [{name: 'iPhone (2)', email: 'jacob@example.test'}] };
  const r = resolveProspectIdentity(source);
  assert.equal(r.clientName, 'Jacob Example'); assert.equal(r.clientEmail, 'jacob@example.test');
});
test('new reality shows do not require a hardcoded show list', () => {
  const source = { ...base, showName: '', mergedTranscript: base.mergedTranscript + '\n[00:02:00] Taylor Rep: Our new reality show is Future Founders.' };
  assert.equal(resolveProspectIdentity(source, {show_name:'Future Founders',show_name_source:'transcript'}).showName, 'Future Founders');
});
test('unknown human display label retained without fabricating identity', () => {
  assert.equal(resolveProspectIdentity({ ...base, clientName: 'Family Computer', meetingTitle: '', mergedTranscript: '' }).clientName, 'Family Computer');
});
test('name-first greetings and explicit rep role labels are supported', () => {
  const source = {...base, repName:'Taylor Rep',mergedTranscript:'[00:01:00] Taylor | Casting Manager: Jake, good morning.\n[00:01:03] iPhone (2): Morning.'};
  assert.equal(resolveProspectIdentity(source).clientName,'Jacob Example');
});
test('malformed optional identity metadata does not throw', () => {
  assert.doesNotThrow(()=>resolveProspectIdentity({...base,clientIdentity:{name:'Jacob Example',speakerAliases:{}}}));
});

const [baselinePath, patchesPath] = process.argv.slice(2);
if (baselinePath && patchesPath) {
  const read = path => JSON.parse(gunzipSync(fs.readFileSync(path)).toString());
  const b = read(baselinePath), p = read(patchesPath);
  const intake = 'qMQYNQtQbRZWjtG2', official = 'L8Nn7xncA9ZPDdWA';
  const AsyncFunction = Object.getPrototypeOf(async function() {}).constructor;
  for (const nodes of Object.values(p)) for (const params of Object.values(nodes)) {
    if (params.jsCode) new AsyncFunction('$input', '$', '$json', params.jsCode);
  }
  const execute = async (code, input, named = {}, json = input[0]?.json) => {
    const lookup = name => ({ itemMatching: index => named[name][index], item: named[name]?.[0] });
    return new AsyncFunction('$input', '$', '$json', code)({all:()=>input,first:()=>input[0]},lookup,json);
  };
  const parsedSource = [base, { ...base, repName: 'Other Rep', clientName: 'Android', meetingTitle: 'Mary Actual - Inside Success - Followup Casting Call', mergedTranscript: '[00:01:00] Other Rep: Hi Mary.\n[00:01:01] Android: Hi.' }];
  const agents = parsedSource.map(() => ({json:{output:{is_sales_call:true,decision_category:'valid_sales_call',call_number:'Call 2+',confidence:'high',attendance_status:'normal'}}}));
  const classified = await execute(p[intake]['Apply AI Sales Call Classification'].jsCode, agents, {'Parse VTT Transcript':parsedSource.map(json=>({json}))});
  assert.deepEqual(classified.map(item=>item.json.clientName), ['Jacob Example','Mary Actual']);
  assert.deepEqual(classified.map(item=>item.pairedItem.item), [0,1]); count++;
  const docOutput = await execute(p[intake]['Build Transcript Document'].jsCode, classified);
  for (let i=0;i<docOutput.length;i++) {
    const doc = docOutput[i].json;
    assert.equal(doc.googleDocText.split('Full Transcript\n\n')[1], parsedSource[i].mergedTranscript);
    const clean = await execute(p[official]['Clean Response'].jsCode,[{json:{body:{content:[{paragraph:{elements:[{textRun:{content:doc.googleDocText}}]}}]}}}]);
    assert.deepEqual(clean[0].json.client_speaker_aliases, doc.clientIdentity.speakerAliases);
    const caseItem = {cleaned_transcript:doc.googleDocText,metadata:{rep_name:parsedSource[i].repName,client_name:doc.clientName,call_number:'Call 2+'},source:{'Client Speaker Aliases':JSON.stringify(clean[0].json.client_speaker_aliases)}};
    const state = {caseItem,provider_results:[]};
    const gated = await execute(p[official]['MM Parse Classifier'].jsCode,[{json:{parsed_json:{call_status:'scored'}}}],{'MM Build Classifier Request':[{json:{state}}]});
    assert.equal(gated.json.state.gate_output.call_status,'scored');
    const before = await execute(b[official].nodes['MM Parse Classifier'].parameters.jsCode,[{json:{parsed_json:{call_status:'scored'}}}],{'MM Build Classifier Request':[{json:{state}}]});
    assert.equal(before.json.state.gate_output.call_status,'transcript_too_short'); count++;
  }
  // Duplicate-control fields must not depend on a name correction.
  const source = {...classified[0].json,automationKey:'zoom:instance:file',meetingUuid:'instance',recordingFileId:'file',meetingId:'123',documentId:'doc',documentUrl:'https://example.test/doc'};
  const afterWrite = await execute(p[intake]['Prepare Airtable Write'].jsCode,[{json:source}]);
  const beforeWrite = await execute(b[intake].nodes['Prepare Airtable Write'].parameters.jsCode,[{json:source}]);
  for(const key of ['id','Automation Key','Meeting ID','Zoom Meeting UUID','Recording File ID','finalAirtableExactSearchFormula','writeMatchedBy']) assert.equal(afterWrite[0].json[key],beforeWrite[0].json[key]); count++;
  const schema = JSON.parse(p[intake]['Sales Call Structured Parser'].inputSchema);
  assert.deepEqual(schema.required,Object.keys(JSON.parse(b[intake].nodes['Sales Call Structured Parser'].parameters.jsonSchemaExample))); count++;
  const attendanceCases = [
    {body:'[00:00:01] Taylor Rep: Hello, can you hear me?',status:'transcript_too_short',expected:'prospect_no_show'},
    {body:'[00:00:01] iPhone (2): Hello, I am waiting for the rep.',status:'transcript_too_short',expected:'rep_no_show'},
    {body:'[00:00:01] Taylor Rep: Here is the pricing package.',status:'transcript_too_short',expected:'transcript_too_short'},
    {body:'',status:'transcript_too_short',expected:'transcript_too_short'},
    {body:'[00:00:01] Taylor Rep: Hello?\n[00:00:03] Fireflies Notetaker: Recording started.',status:'scored',expected:'transcript_too_short'},
  ];
  for (const fixture of attendanceCases) {
    const identity = resolveProspectIdentity({...base,mergedTranscript:fixture.body});
    const caseItem = {cleaned_transcript:fixture.body,metadata:{rep_name:base.repName,client_name:identity.clientName,call_number:'Call 2+'},source:{'Client Speaker Aliases':JSON.stringify(identity.clientIdentity.speakerAliases)}};
    const named = {'MM Build Classifier Request':[{json:{state:{caseItem,provider_results:[]}}}]};
    const gated = await execute(p[official]['MM Parse Classifier'].jsCode,[{json:{parsed_json:{call_status:fixture.status}}}],named);
    assert.equal(gated.json.state.gate_output.call_status,fixture.expected); count++;
  }
  const nameExpression = p[official]['Edit Fields'].assignments.assignments.find(field=>field.name==='Client Name').value.slice(3,-2);
  const field = new Function('$','$json','return ('+nameExpression+')');
  assert.equal(field(()=>({item:{json:{'Client Name':'Manual Person','Client Name Source':'Manual'}}}),{normalized_client_name:'Extracted Person'}),'Manual Person'); count++;
  console.log('PASS actual intake/document/attendance/write bodies, syntax, paired items and optional schema');
}
console.log(JSON.stringify({passed:count}));
