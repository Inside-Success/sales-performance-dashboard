const rows = $input.all().map(item => item.json?.fields ? { id: item.json.id, ...item.json.fields } : item.json).filter(Boolean);
const version = 'rep-reviewer-v5-calibration-1';
const pick = (callType) => {
  const candidates = rows.filter(row => row['Call Type'] === callType && Number.isFinite(Number(row['Composite Score'])) && row['Transcript URL'] && row['Source Record ID']);
  candidates.sort((a, b) => Number(a['Composite Score']) - Number(b['Composite Score']) || String(a['Meeting Start At']).localeCompare(String(b['Meeting Start At'])));
  if (candidates.length < 6) throw new Error(`Need at least six ${callType} V4.3 calls; found ${candidates.length}.`);
  const indexes = [0, Math.floor((candidates.length - 1) * 0.2), Math.floor((candidates.length - 1) * 0.4), Math.floor((candidates.length - 1) * 0.6), Math.floor((candidates.length - 1) * 0.8), candidates.length - 1];
  const selected = [];
  const usedAssessments = new Set();
  const usedReps = new Set();
  for (const index of indexes) {
    const preferred = candidates[index];
    const pool = [preferred, ...candidates];
    const candidate = pool.find(row => !usedAssessments.has(row['Assessment ID']) && !usedReps.has(String(row['Scored Rep Email'] || '').toLowerCase())) || pool.find(row => !usedAssessments.has(row['Assessment ID']));
    if (!candidate) continue;
    selected.push(candidate);
    usedAssessments.add(candidate['Assessment ID']);
    usedReps.add(String(candidate['Scored Rep Email'] || '').toLowerCase());
  }
  for (const candidate of candidates) {
    if (selected.length >= 6) break;
    if (!usedAssessments.has(candidate['Assessment ID'])) selected.push(candidate);
  }
  return selected.slice(0, 6);
};
const chosen = [...pick('Call 1'), ...pick('Call 2+')];
const rosterByEmail = new Map();
for (const row of rows) {
  const email = String(row['Scored Rep Email'] || row['Airtable Rep Email'] || '').trim().toLowerCase();
  const name = String(row['Scored Rep Label'] || row['Airtable Rep Name'] || '').trim();
  if (email && name && !rosterByEmail.has(email)) rosterByEmail.set(email, { email, name });
}
const transcriptDocId = (row) => String(row['Transcript Google Doc ID'] || String(row['Transcript URL'] || '').match(/\/d\/([^/]+)/)?.[1] || '');
const batch = chosen.map(row => {
  const automationKey = String(row['Automation Key'] || '');
  const idempotencyKey = `${row['Source Record ID']}|${automationKey}|${version}`;
  return {
    sourceBaseId: String(row['Source Base ID'] || 'appNIvRt5uouRrcZ6'),
    sourceTableId: String(row['Source Table ID'] || 'tblD1VHKC49agh9QZ'),
    sourceRecordId: String(row['Source Record ID'] || ''),
    automationKey,
    zoomMeetingUuid: String(row['Zoom Meeting UUID'] || ''),
    recordingFileId: String(row['Recording File ID'] || ''),
    docId: transcriptDocId(row),
    transcriptUrl: String(row['Transcript URL'] || ''),
    meetingStartAt: String(row['Meeting Start At'] || ''),
    showName: String(row['Show Name'] || row['Show Family'] || ''),
    clientName: '',
    callType: String(row['Call Type'] || ''),
    repEmail: String(row['Scored Rep Email'] || row['Airtable Rep Email'] || '').toLowerCase(),
    repName: String(row['Scored Rep Label'] || row['Airtable Rep Name'] || ''),
    idempotencyKey,
    scorerVersion: version,
    promptVersion: 'rep-prompt-v5-calibration-1',
    rubricVersion: 'rep-rubric-v5-script-aligned-fairness-1',
    weightsVersion: 'rep-weights-v5-checkpoints-1',
    bandPointsVersion: 'rep-band-points-v5-20-60-100',
    configVersion: 'rep-scoring-config-v5-calibration-1',
    model: 'deepseek-v4-pro',
    sourceV43: { assessmentId: String(row['Assessment ID'] || ''), score: Number(row['Composite Score']), band: String(row['Display Band'] || '') },
  };
});
if (batch.length !== 12 || batch.filter(row => row.callType === 'Call 1').length !== 6 || batch.filter(row => row.callType === 'Call 2+').length !== 6) throw new Error('Calibration sample must be exactly six Call 1 and six Call 2+ calls.');
const runId = `v5-calibration-${new Date().toISOString()}`;
const roster = [...rosterByEmail.values()];
return batch.map((call, index) => ({ json: {
  batch: [call],
  roster,
  runId,
  workerBatchId: `v5-calibration-${String(index + 1).padStart(2, '0')}`,
  sample: { sourceRecordId: call.sourceRecordId, callType: call.callType, repName: call.repName, priorV43: call.sourceV43 },
} }));
