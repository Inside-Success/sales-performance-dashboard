import fs from "node:fs";

const [workerInput, launcherInput, workerOutput, launcherOutput, deployedWorkerId = ""] = process.argv.slice(2);
if (!workerInput || !launcherInput || !workerOutput || !launcherOutput) {
  throw new Error("Usage: node build-rep-scoring-v6-3.mjs <v62-worker> <v62-launcher> <v63-worker> <v63-launcher>");
}

const worker = JSON.parse(fs.readFileSync(workerInput, "utf8"));
const launcher = JSON.parse(fs.readFileSync(launcherInput, "utf8"));

function codeNode(workflow, name) {
  const node = workflow.nodes.find((candidate) => candidate.name === name);
  if (!node || node.type !== "n8n-nodes-base.code") throw new Error(`Missing Code node: ${name}`);
  return node;
}

function replaceOrThrow(value, find, replacement, label) {
  if (!value.includes(find)) throw new Error(`Could not patch ${label}`);
  return value.replace(find, replacement);
}

function renameWorkflow(workflow, replacements) {
  let serialized = JSON.stringify(workflow);
  for (const [from, to] of replacements) serialized = serialized.split(from).join(to);
  return JSON.parse(serialized);
}

const v63Worker = renameWorkflow(worker, [
  ["MM Rep Scoring V6.2 - Single Primary + Selective Verification Worker (NO BACKFILL)", "MM Rep Scoring V6.3 - Realistic Anchors + Fair Attribution Worker (NO BACKFILL)"],
  ["V6.2", "V6.3"],
  ["v6.2", "v6.3"],
  ["v6_2", "v6_3"],
  ["n8n-v6-2-calibration", "n8n-v6-3-calibration"],
]);
delete v63Worker.id;
delete v63Worker.versionId;
delete v63Worker.activeVersionId;
delete v63Worker.active;
delete v63Worker.createdAt;
delete v63Worker.updatedAt;
delete v63Worker.shared;
delete v63Worker.versionCounter;
delete v63Worker.triggerCount;
delete v63Worker.staticData;
delete v63Worker.pinData;
delete v63Worker.meta;
delete v63Worker.tags;
delete v63Worker.description;
delete v63Worker.isArchived;
delete v63Worker.sourceWorkflowId;

const prepare = codeNode(v63Worker, "Prepare Evidence-Bound Request");
const identityStart = prepare.parameters.jsCode.indexOf("const normalizeIdentity =");
const identityEnd = prepare.parameters.jsCode.indexOf("\n\n\nconst call1 =");
if (identityStart < 0 || identityEnd < 0) throw new Error("Could not locate V6.2 identity block");
const identityBlock = `const normalizeIdentity = (value) => String(value || '').normalize('NFKD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase().replace(/\\([^)]*\\)/g, ' ').replace(/[^a-z0-9@.]+/g, ' ').replace(/\\s+/g, ' ').trim();
const cleanName = (value) => normalizeIdentity(value).replace(/@.*$/, '').replace(/\\b(casting manager|sales manager|sales rep|sales closer|closer|manager|host|speaker)\\b/g, ' ').replace(/\\s+/g, ' ').trim();
const isGeneric = (value) => /^(casting|sales|closer|booking|appointment|inside success|team|admin|host|speaker|unknown)( team| rep| closer| sales)?$/i.test(cleanName(value));
const rosterByEmail = new Map();
for (const raw of (Array.isArray(source.repRoster) ? source.repRoster : [])) {
  const email = String(raw?.email || '').trim().toLowerCase();
  const name = String(raw?.name || '').trim();
  if (email && name && !isGeneric(name) && !rosterByEmail.has(email)) rosterByEmail.set(email, { email, name });
}
if (source.repEmail && source.repName && !rosterByEmail.has(String(source.repEmail).toLowerCase())) {
  rosterByEmail.set(String(source.repEmail).toLowerCase(), { email: String(source.repEmail).toLowerCase(), name: String(source.repName) });
}
const roster = [...rosterByEmail.values()];
const aliasesByEmail = new Map();
const aliasOwners = new Map();
for (const rep of roster) {
  const tokens = cleanName(rep.name).split(' ').filter(Boolean);
  const emailLocal = rep.email.split('@')[0].replace(/[._-]+/g, ' ');
  const aliases = new Set([cleanName(rep.name), cleanName(rep.email), cleanName(emailLocal)]);
  if (tokens.length) aliases.add(tokens[0]);
  if (tokens.length > 1) aliases.add(tokens[tokens.length - 1]);
  aliasesByEmail.set(rep.email, aliases);
  for (const alias of aliases) {
    if (!alias || alias.length < 3) continue;
    const owners = aliasOwners.get(alias) || new Map();
    owners.set(rep.email, rep);
    aliasOwners.set(alias, owners);
  }
}
const uniqueAliases = new Map([...aliasOwners.entries()].filter(([, owners]) => owners.size === 1).map(([alias, owners]) => [alias, [...owners.values()][0]]));
const rawSpeakerStats = new Map();
const allSpeakerLabels = new Set();
for (const line of transcript.split(/\\r?\\n/)) {
  const match = line.match(/^\\s*\\[([^\\]]+)]\\s*([^:\\n]{1,100}):\\s*(.*)$/);
  if (!match) continue;
  const label = match[2].trim();
  const key = cleanName(label);
  allSpeakerLabels.add(label);
  const entry = rawSpeakerStats.get(key) || { key, labels: new Set(), turns: 0, words: 0 };
  entry.labels.add(label);
  entry.turns += 1;
  entry.words += match[3].trim() ? match[3].trim().split(/\\s+/).length : 0;
  rawSpeakerStats.set(key, entry);
}
const matchSpeakerToRep = (speakerKey) => {
  if (!speakerKey) return null;
  if (uniqueAliases.has(speakerKey)) return { rep: uniqueAliases.get(speakerKey), method: 'unique_exact_alias' };
  const possible = new Map();
  for (const [alias, rep] of uniqueAliases) {
    if (alias.length >= 4 && speakerKey.length >= 4 && (alias.startsWith(speakerKey) || speakerKey.startsWith(alias))) possible.set(rep.email, rep);
  }
  return possible.size === 1 ? { rep: [...possible.values()][0], method: 'unique_prefix_alias' } : null;
};
const matchedByEmail = new Map();
for (const stats of rawSpeakerStats.values()) {
  const match = matchSpeakerToRep(stats.key);
  if (!match) continue;
  const entry = matchedByEmail.get(match.rep.email) || { rep: match.rep, labels: new Set(), turns: 0, words: 0, methods: new Set() };
  for (const label of stats.labels) entry.labels.add(label);
  entry.turns += stats.turns;
  entry.words += stats.words;
  entry.methods.add(match.method);
  matchedByEmail.set(match.rep.email, entry);
}
const ranked = [...matchedByEmail.values()].sort((a, b) => b.words - a.words || b.turns - a.turns || a.rep.email.localeCompare(b.rep.email));
const assignedEmail = String(source.repEmail || '').toLowerCase();
const assigned = matchedByEmail.get(assignedEmail) || null;
const totalMatchedWords = ranked.reduce((sum, row) => sum + row.words, 0);
const primary = assigned && assigned.turns >= 2 && assigned.words >= 12 ? assigned : ranked[0];
const second = ranked.find((row) => row.rep.email !== primary?.rep?.email);
const primaryShare = totalMatchedWords && primary ? primary.words / totalMatchedWords : 0;
const secondShare = totalMatchedWords && second ? second.words / totalMatchedWords : 0;
const unmatched = [...rawSpeakerStats.values()].filter((row) => !matchSpeakerToRep(row.key)).sort((a, b) => b.words - a.words);
const resolutionDiagnostic = {
  matchedRepCount: ranked.length,
  matchedTurns: ranked.reduce((sum, row) => sum + row.turns, 0),
  matchedWords: totalMatchedWords,
  primaryShare: Math.round(primaryShare * 1000) / 1000,
  secondShare: Math.round(secondShare * 1000) / 1000,
  assignedMatched: Boolean(assigned),
  speakers: ranked.map((row) => ({ email: row.rep.email, name: row.rep.name, turns: row.turns, words: row.words, labels: [...row.labels], methods: [...row.methods] })),
  unmatched: unmatched.slice(0, 6).map((row) => ({ labels: [...row.labels], turns: row.turns, words: row.words })),
};
if (!primary || primary.turns < 2 || primary.words < 12) return quarantine('speaker_resolution_unmapped_or_insufficient', resolutionDiagnostic);
if (second && !(primaryShare >= 0.60 && secondShare <= 0.30)) return quarantine('speaker_resolution_ambiguous_multiple_reps', resolutionDiagnostic);
source.resolvedRepEmail = primary.rep.email;
source.resolvedRepName = primary.rep.name;
source.attributionSubstituted = primary.rep.email !== assignedEmail;
source.speakerResolutionMethod = source.attributionSubstituted ? 'transcript_unique_alias_substitute_v6_3' : 'transcript_assigned_alias_v6_3';
source.speakerResolutionConfidence = assigned === primary || primaryShare >= 0.72 ? 'high' : 'medium';
source.resolvedSpeakerLabels = [...primary.labels].sort();
source.allSpeakerLabels = [...allSpeakerLabels].sort();
source.speakerResolutionDiagnostic = resolutionDiagnostic;`;
prepare.parameters.jsCode = prepare.parameters.jsCode.slice(0, identityStart) + identityBlock + prepare.parameters.jsCode.slice(identityEnd);
prepare.parameters.jsCode = replaceOrThrow(prepare.parameters.jsCode,
  "  '- met: the criterion’s functional purpose is clearly achieved.',",
  "  '- exceptional: rare, complete, context-specific execution that clearly exceeds ordinary competent script compliance; require exact evidence and no material counterevidence.',\n  '- met: competent and correct execution that clearly achieves the criterion’s functional purpose; normal good work is met, not exceptional.',",
  "criterion status anchors");
prepare.parameters.jsCode = replaceOrThrow(prepare.parameters.jsCode,
  "status:'met|partial|missed|harmful|not_applicable|not_observable'",
  "status:'exceptional|met|partial|missed|harmful|not_applicable|not_observable'",
  "primary response schema");
prepare.parameters.jsCode = replaceOrThrow(prepare.parameters.jsCode,
  "- Every met, partial, missed, or harmful criterion needs at least one exact contiguous transcript quote with timestamp and speaker.",
  "- Every exceptional, met, partial, missed, or harmful criterion needs at least one exact contiguous transcript quote with timestamp and speaker.",
  "evidence requirement");
prepare.parameters.jsCode = replaceOrThrow(prepare.parameters.jsCode,
  "'- A missed criterion requires a fair, observable opportunity. If a criterion was not reasonably relevant at this stage, use not_applicable. If the transcript cannot establish it, use not_observable.',",
  "'- A missed criterion requires a fair, observable opportunity. If a criterion was not reasonably relevant at this stage, use not_applicable. If the transcript cannot establish it, use not_observable.',\n  '- Opportunity classification is context only and never adds or subtracts points. Limited or unclosable prospects must not lower the rep score when the rep makes the correct progression or closure decision.',\n  '- Do not award exceptional merely because the call reached a sale, advanced, or ended cleanly. Exceptional describes unusually complete rep execution across the applicable criterion.',",
  "prospect neutrality anchors");

const validate = codeNode(v63Worker, "Validate Evidence and Compute Score");
validate.parameters.jsCode = replaceOrThrow(validate.parameters.jsCode,
  "const statusPoints={met:100,partial:55,missed:15,harmful:0};",
  "const statusPoints={exceptional:100,met:85,partial:55,missed:15,harmful:0};",
  "deterministic criterion points");
validate.parameters.jsCode = replaceOrThrow(validate.parameters.jsCode,
  "['met','partial','missed','harmful','not_applicable','not_observable']",
  "['exceptional','met','partial','missed','harmful','not_applicable','not_observable']",
  "criterion status allowlist");
validate.parameters.jsCode = replaceOrThrow(validate.parameters.jsCode,
  "['met','partial','missed','harmful'].includes(status)",
  "['exceptional','met','partial','missed','harmful'].includes(status)",
  "evidence-required statuses");
validate.parameters.jsCode = replaceOrThrow(validate.parameters.jsCode,
  "'Model Params Hash':'v6.3-criteria-first-temperature0-selective-verifier-deterministic-score'",
  "'Model Params Hash':'v6.3-exceptional100-met85-partial55-missed15-temperature0-selective-verifier'",
  "model params hash");

const selective = codeNode(v63Worker, "Prepare V6.3 Selective Review");
selective.parameters.jsCode = replaceOrThrow(selective.parameters.jsCode,
  "corrected_status: 'met|partial|missed|harmful|not_applicable|not_observable'",
  "corrected_status: 'exceptional|met|partial|missed|harmful|not_applicable|not_observable'",
  "selective review schema");
selective.parameters.jsCode = replaceOrThrow(selective.parameters.jsCode,
  "'A difficult prospect, lead quality, or technical issue is not a rep fault. Return one valid JSON object and no prose outside it.',",
  "'A difficult prospect, lead quality, or technical issue is not a rep fault. Opportunity is context only and never a direct score adjustment.',\n  'Exceptional is rare and requires complete context-specific execution beyond ordinary competent compliance. Ordinary good execution is met.',\n  'Return one valid JSON object and no prose outside it.',",
  "selective review fairness");

const apply = codeNode(v63Worker, "Apply V6.3 Selective Review");
apply.parameters.jsCode = replaceOrThrow(apply.parameters.jsCode,
  "new Set(['met', 'partial', 'missed', 'harmful', 'not_applicable', 'not_observable'])",
  "new Set(['exceptional', 'met', 'partial', 'missed', 'harmful', 'not_applicable', 'not_observable'])",
  "selective status allowlist");

const v63Launcher = renameWorkflow(launcher, [
  ["MM Rep Scoring V6.2 - One-Time 100-Call Backfill Validation Launcher", "MM Rep Scoring V6.3 - One-Time Balanced 30-Call Multi-Day Calibration Launcher"],
  ["V6.2", "V6.3"],
  ["v6.2", "v6.3"],
  ["v6_2", "v6_3"],
]);
delete v63Launcher.id;
delete v63Launcher.versionId;
delete v63Launcher.activeVersionId;
delete v63Launcher.active;
delete v63Launcher.createdAt;
delete v63Launcher.updatedAt;
delete v63Launcher.shared;
delete v63Launcher.versionCounter;
delete v63Launcher.triggerCount;
delete v63Launcher.staticData;
delete v63Launcher.pinData;
delete v63Launcher.meta;
delete v63Launcher.tags;
delete v63Launcher.description;
delete v63Launcher.isArchived;
delete v63Launcher.sourceWorkflowId;

const context = codeNode(v63Launcher, "Build Validation Context");
context.parameters.jsCode = `const input=$input.first()?.json||{};
const body=input.body&&typeof input.body==='object'?input.body:{};
const zone='America/New_York';
const now=DateTime.now().setZone(zone);
const windowStart=now.minus({days:7}).startOf('day');
return [{json:{
 runId:'v6-3-balanced-30-'+now.toUTC().toISO().replace(/[^0-9]/g,'').slice(0,17),
 runMode:'v6_3_balanced_multiday_calibration_30',windowStart:windowStart.toUTC().toISO(),windowEnd:now.toUTC().toISO(),
 targetCalls:30,targetPerType:15,minimumDaysPerType:3,workerBatchSize:10,
 scorerVersion:'rep-reviewer-v6.3-realistic-fair-1',promptVersion:'rep-prompt-v6.3-exceptional-anchor-prospect-neutral-1',
 rubricVersion:'rep-rubric-v6.3-script-fairness-opportunity-context-1',weightsVersion:'rep-weights-v6.3-call-specific-1',
 bandPointsVersion:'rep-criterion-points-v6.3-0-15-55-85-100-critical-cap-69',configVersion:'rep-scoring-config-v6.3-balanced-calibration-1',
 model:'deepseek-v4-pro',seed:'v6.3-balanced-multiday-30-20260811',requestedBy:String(body.requestedBy||'syed-approved'),now:now.toUTC().toISO()
}}];`;

const sourceRead = v63Launcher.nodes.find((node) => node.name === "Read Validation Source Candidates");
sourceRead.parameters.returnAll = true;
delete sourceRead.parameters.limit;
const ledgerRead = v63Launcher.nodes.find((node) => node.name === "Read V6.3 Ledger Snapshot");
ledgerRead.parameters.filterByFormula = "=AND({Scorer Version}='rep-reviewer-v6.3-realistic-fair-1',OR({State}='completed',AND({State}='processing',IS_AFTER({Lease Expires At},NOW()))))";

const select = codeNode(v63Launcher, "Select Stratified Backfill Validation Calls");
select.name = "Select Exact Balanced Multi-Day Calls";
select.notes = "Selects exactly 15 Call 1 and 15 Call 2+ calls across at least three source days per type. It is fail-closed and does not use scores or outcomes for selection.";
select.parameters.jsCode = `const context=$('Build Validation Context').first().json;
const sourceItems=$('Read Validation Source Candidates').all();
const ledgerItems=$input.all();
const clean=(value)=>value===null||value===undefined?'':Array.isArray(value)?value.map(clean).filter(Boolean).join(', '):String(value).trim();
const completed=new Set(); const active=new Set();
for(const item of ledgerItems){const f=item.json?.fields||item.json||{};const key=clean(f['Idempotency Key']);const state=clean(f.State).toLowerCase();const expiry=Date.parse(clean(f['Lease Expires At']));if(!key)continue;if(state==='completed')completed.add(key);if(state==='processing'&&Number.isFinite(expiry)&&expiry>Date.now())active.add(key);}
if(active.size) throw new Error('V6.3 has '+active.size+' active worker lease(s); calibration dispatch stopped to prevent overlap.');
const candidates=[]; const rosterByEmail=new Map();
for(const item of sourceItems){const raw=item.json||{};const f=raw.fields&&typeof raw.fields==='object'?raw.fields:raw;const sourceRecordId=clean(raw.id||raw.recordId);const transcriptUrl=clean(f['Meeting Transcript Link']);const docId=clean(f['Transcript Google Doc ID'])||(transcriptUrl.match(/\\/document\\/d\\/([^/]+)/)||[])[1]||'';const automationKey=clean(f['Automation Key'])||('airtable:'+sourceRecordId);const callType=clean(f['Call #']);const repEmail=clean(f['Rep Email']).toLowerCase();const repName=clean(f['Rep Name'])||repEmail.split('@')[0].replace(/[._-]+/g,' ');const meetingStartAt=clean(f['Meeting Start Date']);const idempotencyKey=[sourceRecordId,automationKey,context.scorerVersion].join('|');const meetingDate=meetingStartAt.slice(0,10);if(!sourceRecordId||!docId||!repEmail||!meetingDate||!['Call 1','Call 2+'].includes(callType)||completed.has(idempotencyKey))continue;if(!rosterByEmail.has(repEmail))rosterByEmail.set(repEmail,{email:repEmail,name:repName});candidates.push({sourceBaseId:'appNIvRt5uouRrcZ6',sourceTableId:'tblD1VHKC49agh9QZ',sourceRecordId,automationKey,zoomMeetingUuid:clean(f['Zoom Meeting UUID']),recordingFileId:clean(f['Recording File ID']),docId,transcriptUrl,meetingStartAt,meetingDate,showName:clean(f['Show Name']),clientName:clean(f['Client Name']),callType,repEmail,repName,idempotencyKey,scorerVersion:context.scorerVersion,promptVersion:context.promptVersion,rubricVersion:context.rubricVersion,weightsVersion:context.weightsVersion,bandPointsVersion:context.bandPointsVersion,configVersion:context.configVersion,model:context.model,calibrationRound:'balanced-30',sampleReason:'v6_3_balanced_multiday_30',sourceV6:{sourceRecordId},sourceV5:{}});}
const hash=(value)=>{let h=2166136261;for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;};
const pickType=(type)=>{const pool=candidates.filter((call)=>call.callType===type);const days=[...new Set(pool.map((call)=>call.meetingDate))].sort().reverse();if(days.length<context.minimumDaysPerType)throw new Error(type+' has only '+days.length+' distinct source days; '+context.minimumDaysPerType+' are required.');const byDay=new Map(days.map((day)=>[day,pool.filter((call)=>call.meetingDate===day).sort((a,b)=>hash(context.seed+'|'+type+'|'+a.repEmail+'|'+a.sourceRecordId)-hash(context.seed+'|'+type+'|'+b.repEmail+'|'+b.sourceRecordId))]));const selected=[];const used=new Set();let round=0;while(selected.length<context.targetPerType){let added=0;for(const day of days){const available=(byDay.get(day)||[]).filter((call)=>!used.has(call.sourceRecordId));if(!available.length)continue;const unusedRep=available.find((call)=>!selected.some((picked)=>picked.repEmail===call.repEmail));const choice=unusedRep||available[round%available.length];selected.push(choice);used.add(choice.sourceRecordId);added++;if(selected.length>=context.targetPerType)break;}if(!added)break;round++;}if(selected.length!==context.targetPerType)throw new Error(type+' has only '+selected.length+' eligible balanced calls; exactly '+context.targetPerType+' are required.');if(new Set(selected.map((call)=>call.meetingDate)).size<context.minimumDaysPerType)throw new Error(type+' selection did not span enough days.');return selected;};
const selected=[...pickType('Call 1'),...pickType('Call 2+')].sort((a,b)=>hash(context.seed+'|order|'+a.sourceRecordId)-hash(context.seed+'|order|'+b.sourceRecordId));
if(selected.length!==30||selected.filter((call)=>call.callType==='Call 1').length!==15||selected.filter((call)=>call.callType==='Call 2+').length!==15)throw new Error('V6.3 selection invariant failed; no calls dispatched.');
if(new Set(selected.map((call)=>call.sourceRecordId)).size!==selected.length)throw new Error('Duplicate source calls detected in V6.3 selection.');
const dayCounts=Object.fromEntries(['Call 1','Call 2+'].map((type)=>[type,[...new Set(selected.filter((call)=>call.callType===type).map((call)=>call.meetingDate))].length]));
return selected.map((call,index)=>({json:{...call,validationSelectionIndex:index+1,validationSelectedTotal:30,validationCall1:15,validationCall2:15,validationDaysByType:dayCounts},pairedItem:{item:index}}));`;

for (const connections of Object.values(v63Launcher.connections)) {
  for (const output of connections.main || []) {
    for (const connection of output || []) if (connection.node === "Select Stratified Backfill Validation Calls") connection.node = "Select Exact Balanced Multi-Day Calls";
  }
}
v63Launcher.connections["Select Exact Balanced Multi-Day Calls"] = v63Launcher.connections["Select Stratified Backfill Validation Calls"];
delete v63Launcher.connections["Select Stratified Backfill Validation Calls"];

const batches = codeNode(v63Launcher, "Build Five Bounded Validation Workers");
batches.name = "Build Three Bounded Calibration Workers";
batches.notes = "Builds exactly three isolated 10-call worker payloads after the balanced-selection invariants pass.";
batches.parameters.jsCode = batches.parameters.jsCode.replace("Number(context.workerBatchSize||20)", "Number(context.workerBatchSize||10)");
for (const connections of Object.values(v63Launcher.connections)) {
  for (const output of connections.main || []) {
    for (const connection of output || []) if (connection.node === "Build Five Bounded Validation Workers") connection.node = "Build Three Bounded Calibration Workers";
  }
}
v63Launcher.connections["Build Three Bounded Calibration Workers"] = v63Launcher.connections["Build Five Bounded Validation Workers"];
delete v63Launcher.connections["Build Five Bounded Validation Workers"];

const complete = codeNode(v63Launcher, "Validation Launch Complete");
complete.parameters.jsCode = `const dispatched=$input.all().length;const selected=$('Select Exact Balanced Multi-Day Calls').all();const calls=selected.map((item)=>item.json||{});const call1=calls.filter((call)=>call.callType==='Call 1');const call2=calls.filter((call)=>call.callType==='Call 2+');const days={call1:[...new Set(call1.map((call)=>call.meetingDate))].sort(),call2:[...new Set(call2.map((call)=>call.meetingDate))].sort()};if(calls.length!==30||call1.length!==15||call2.length!==15||dispatched!==3)throw new Error('V6.3 dispatch summary invariant failed.');return [{json:{ok:true,status:'v6.3_balanced_multiday_calibration_dispatched',workerDispatches:dispatched,selectedCalls:calls.length,call1:call1.length,call2:call2.length,days,message:'Exactly 30 balanced multi-day V6.3 calls were dispatched once. No wider backfill was started.'}}];`;

const dispatch = v63Launcher.nodes.find((node) => node.name === "Dispatch V6.3 Validation Workers");
if (!dispatch) throw new Error("Missing V6.3 dispatch node");
dispatch.notes = "Asynchronously dispatches exactly three 10-call workers to the isolated V6.3 worker. The worker is idempotent and ledger-protected.";
if (deployedWorkerId) {
  dispatch.parameters.workflowId.value = deployedWorkerId;
  dispatch.parameters.workflowId.cachedResultName = v63Worker.name;
}

fs.writeFileSync(workerOutput, JSON.stringify({ name: v63Worker.name, nodes: v63Worker.nodes, connections: v63Worker.connections, settings: v63Worker.settings }, null, 2));
fs.writeFileSync(launcherOutput, JSON.stringify({ name: v63Launcher.name, nodes: v63Launcher.nodes, connections: v63Launcher.connections, settings: v63Launcher.settings }, null, 2));
