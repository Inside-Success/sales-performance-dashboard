function singleInput() { const rows = $input.all(); if(rows.length !== 1) throw new Error('Expected one scoring input'); return rows[0].json; }
function single(name) { const rows = $(name).all(); if(rows.length !== 1) throw new Error('Expected one aligned scoring item: '+name); return rows[0].json; }
const retried = singleInput();
const initial = single('Decide Automatic Validation Retry');
const fields = ['input_cost_usd','cache_write_cost_usd','cache_read_cost_usd','output_cost_usd','total_cost_usd'];
const combined = {};
for (const field of fields) combined[field] = Number(initial.provider_costs?.[field] || 0) + Number(retried.provider_costs?.[field] || 0);
return [{ json: {
  ...retried,
  provider_costs: combined,
  automatic_retry: {
    attempted: true,
    attempts: 2,
    initial_reason: initial.__automatic_retry_reason || null,
    succeeded: retried.validation?.valid === true,
    initial_cost_usd: Number(initial.provider_costs?.total_cost_usd || 0),
    retry_cost_usd: Number(retried.provider_costs?.total_cost_usd || 0)
  }
} }];
