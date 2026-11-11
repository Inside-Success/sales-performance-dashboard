// A terminal failed safety response is retained evidence, never approval.
// The core can repair the initial stage once; a failed repair is retained and held.
// Keep this pure predicate shared by the durable API and compiled n8n handoff.
function repairableSafetyReceipt(stage, r) {
 return ['foundations_safety_v3','foundations_safety_contract_repair_v3'].includes(stage) && r?.ok === true &&
  typeof r.provider_response_id === 'string' && Boolean(r.provider_response_id) &&
  typeof r.request_id === 'string' && Boolean(r.request_id) &&
  ['stop','end_turn','length','max_tokens'].includes(r.stop_reason) &&
  ['input_tokens','output_tokens'].every(k => Number.isFinite(r.usage?.[k]) && r.usage[k] >= 0) &&
  (['length','max_tokens'].includes(r.stop_reason) || Boolean(r.parse_error) || !r.parsed_json);
}
module.exports = {repairableSafetyReceipt};

// A complete, transport-valid first draft/review with a contract fault can be
// replayed into its ONE repair stage. Repair-stage failures cannot buy more repair.
function retainedContractReceipt(stage, r) {
 return ['foundations_writer_v3','foundations_reviewer_v3'].includes(stage) &&
  r?.ok===true && typeof r.provider_response_id==='string' && Boolean(r.provider_response_id) &&
  typeof r.request_id==='string' && Boolean(r.request_id) &&
  ['stop','end_turn'].includes(r.stop_reason) && !r.parse_error &&
  r.parsed_json && typeof r.parsed_json==='object' && !Array.isArray(r.parsed_json) &&
  ['input_tokens','output_tokens'].every(k=>Number.isFinite(r.usage?.[k])&&r.usage[k]>=0);
}
function reusedReceipt(r) {
 return {...r,checkpoint_reused:true,checkpoint_original_costs:r.costs,checkpoint_original_usage:r.usage,
  usage:Object.fromEntries(Object.entries(r.usage||{}).map(([k,v])=>[k,typeof v==='number'?0:v])),
  costs:{input_cost_usd:0,cache_write_cost_usd:0,cache_read_cost_usd:0,output_cost_usd:0,total_cost_usd:0}};
}
module.exports.retainedContractReceipt=retainedContractReceipt;
module.exports.reusedReceipt=reusedReceipt;
