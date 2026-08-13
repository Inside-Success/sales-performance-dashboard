const context = $('Build V7.1 Checkpoint Context').first().json;
const sourceItems = $('Read V7 Checkpoint Candidates').all();
const ledgerItems = $input.all();
const clean = (value) => value === null || value === undefined
  ? ''
  : Array.isArray(value) ? value.map(clean).filter(Boolean).join(', ') : String(value).trim();

if (sourceItems.some((item) => item.json?.error) || ledgerItems.some((item) => item.json?.error)) {
  throw new Error('Source or V7.1 ledger snapshot was unavailable; checkpoint failed closed before dispatch.');
}

const completed = new Set();
const active = new Set();
for (const item of ledgerItems) {
  const fields = item.json?.fields || item.json || {};
  const key = clean(fields['Idempotency Key']);
  const state = clean(fields.State).toLowerCase();
  const expiry = Date.parse(clean(fields['Lease Expires At']));
  if (!key) continue;
  if (state === 'completed') completed.add(key);
  if (state === 'processing' && Number.isFinite(expiry) && expiry > Date.now()) active.add(key);
}
if (active.size) throw new Error(`V7.1 has ${active.size} active worker lease(s); checkpoint stopped before selection.`);

const candidates = [];
for (const item of sourceItems) {
  const raw = item.json || {};
  const fields = raw.fields && typeof raw.fields === 'object' ? raw.fields : raw;
  const sourceRecordId = clean(raw.id || raw.recordId);
  const transcriptUrl = clean(fields['Meeting Transcript Link']);
  const docId = clean(fields['Transcript Google Doc ID']) || (transcriptUrl.match(/\/document\/d\/([^/]+)/) || [])[1] || '';
  const automationKey = clean(fields['Automation Key']) || `airtable:${sourceRecordId}`;
  const callType = clean(fields['Call #']);
  const repEmail = clean(fields['Rep Email']).toLowerCase();
  const repName = clean(fields['Rep Name']) || repEmail.split('@')[0].replace(/[._-]+/g, ' ');
  const meetingStartAt = clean(fields['Meeting Start Date']);
  const meetingMs = Date.parse(meetingStartAt);
  const idempotencyKey = [sourceRecordId, automationKey, context.scorerVersion].join('|');
  if (!sourceRecordId || !docId || !repEmail || !['Call 1', 'Call 2+'].includes(callType)) continue;
  if (!Number.isFinite(meetingMs) || meetingMs < Date.parse(context.boundaryStart) || meetingMs > Date.parse(context.windowEnd)) continue;
  if (completed.has(idempotencyKey) || active.has(idempotencyKey)) continue;
  candidates.push({
    sourceBaseId: 'appNIvRt5uouRrcZ6', sourceTableId: 'tblD1VHKC49agh9QZ', sourceRecordId, automationKey,
    zoomMeetingUuid: clean(fields['Zoom Meeting UUID']), recordingFileId: clean(fields['Recording File ID']),
    docId, transcriptUrl, meetingStartAt, showName: clean(fields['Show Name']), clientName: clean(fields['Client Name']),
    callType, repEmail, repName, idempotencyKey, scorerVersion: context.scorerVersion,
    promptVersion: context.promptVersion, rubricVersion: context.rubricVersion, weightsVersion: context.weightsVersion,
    bandPointsVersion: context.bandPointsVersion, configVersion: context.configVersion, model: context.model,
    calibrationRound: 'checkpoint-250', sampleReason: 'v7_1_approved_additional_250_checkpoint',
    sourceV6: { sourceRecordId }, sourceV5: {}, meetingMs,
  });
}

const hash = (value) => {
  let result = 2166136261;
  for (let index = 0; index < value.length; index++) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
};
const fairPick = (pool, limit, salt) => {
  const groups = new Map();
  for (const call of pool) {
    const key = `${call.repEmail}|${call.meetingStartAt.slice(0, 10)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(call);
  }
  for (const rows of groups.values()) rows.sort((a, b) => hash(`${context.seed}|${salt}|${a.sourceRecordId}`) - hash(`${context.seed}|${salt}|${b.sourceRecordId}`));
  const keys = [...groups.keys()].sort((a, b) => hash(`${context.seed}|${salt}|${a}`) - hash(`${context.seed}|${salt}|${b}`));
  const picked = [];
  let round = 0;
  while (picked.length < limit) {
    let added = 0;
    for (const key of keys) {
      const row = groups.get(key)?.[round];
      if (!row) continue;
      picked.push(row);
      added++;
      if (picked.length >= limit) break;
    }
    if (!added) break;
    round++;
  }
  return picked;
};

const perType = Math.floor(context.targetCalls / 2);
const call1 = candidates.filter((call) => call.callType === 'Call 1');
const call2 = candidates.filter((call) => call.callType === 'Call 2+');
let selected = [...fairPick(call1, perType, 'call-1'), ...fairPick(call2, context.targetCalls - perType, 'call-2')];
const selectedIds = new Set(selected.map((call) => call.sourceRecordId));
if (selected.length < context.targetCalls) {
  selected = selected.concat(fairPick(candidates.filter((call) => !selectedIds.has(call.sourceRecordId)), context.targetCalls - selected.length, 'balanced-fill'));
}
selected = selected.slice(0, context.targetCalls);
const uniqueSources = new Set(selected.map((call) => call.sourceRecordId));
const uniqueKeys = new Set(selected.map((call) => call.idempotencyKey));
if (selected.length !== context.targetCalls || uniqueSources.size !== context.targetCalls || uniqueKeys.size !== context.targetCalls) {
  throw new Error(`Exact checkpoint invariant failed: selected ${selected.length} unique calls from ${candidates.length} eligible candidates.`);
}
const byType = { call1: selected.filter((call) => call.callType === 'Call 1').length, call2: selected.filter((call) => call.callType === 'Call 2+').length };
return selected.map((call, index) => ({ json: { ...call, checkpointSelectionIndex: index + 1, checkpointSelectedTotal: selected.length, checkpointCall1: byType.call1, checkpointCall2: byType.call2 }, pairedItem: { item: index } }));
