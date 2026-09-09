if ($input.all().length !== 1) throw new Error('Expected exactly one call per scoring execution');
const root = $json || {};
const call = root.call && typeof root.call === 'object' ? root.call : root;
const first = (...values) => values.find((value) => value !== undefined && value !== null && String(value).trim() !== '');
const transcript = String(first(call.transcript, call.cleaned_transcript, call['Transcript'], call['Cleaned Transcript']) || '').trim();
if (!transcript) throw new Error('Call 2 input requires call.transcript (or call.cleaned_transcript).');
const recentScores = Array.isArray(root.recent_scores) ? root.recent_scores : (Array.isArray(call.recent_scores) ? call.recent_scores : []);
return [{ json: {
  score_version: "magic-mike-call2-evidence-score-v2",
  call_type: "Call 2",
  transcript,
  recent_scores: recentScores,
  metadata: {
    rep_name: String(first(call.rep_name, call['Sales Rep'], call['Rep Name']) || '').trim(),
    rep_email: String(first(call.rep_email, call['Sales Rep Email'], call['Rep Email']) || '').trim().toLowerCase(),
    client_name: String(first(call.client_name, call['Client Name']) || '').trim(),
    call_date: String(first(call.call_date, call['Date/Time'], call['Meeting Start Date']) || '').trim(),
    meeting_id: String(first(call.meeting_id, call['Meeting ID']) || '').trim(),
    meeting_title: String(first(call.meeting_title, call['Title Of Meeting'], call['Meeting Title']) || '').trim(),
    show_name: String(first(call.show_name, call['Show Name']) || '').trim(),
    source_record_id: String(first(call.source_record_id, call['Source Airtable Record ID']) || '').trim()
  }
} }];
