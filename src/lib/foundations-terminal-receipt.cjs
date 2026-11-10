// A terminal failed safety response is evidence for a bounded repair, never approval.
// Keep this pure predicate shared by the durable API and compiled n8n handoff.
function repairableSafetyReceipt(stage, r) {
 return stage === 'foundations_safety_v3' && r?.ok === true &&
  typeof r.provider_response_id === 'string' && Boolean(r.provider_response_id) &&
  typeof r.request_id === 'string' && Boolean(r.request_id) &&
  ['stop','end_turn','length','max_tokens'].includes(r.stop_reason) &&
  ['input_tokens','output_tokens'].every(k => Number.isFinite(r.usage?.[k]) && r.usage[k] >= 0) &&
  (['length','max_tokens'].includes(r.stop_reason) || Boolean(r.parse_error) || !r.parsed_json);
}
module.exports = {repairableSafetyReceipt};
