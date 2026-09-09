function singleInput() { const rows = $input.all(); if(rows.length !== 1) throw new Error('Expected one scoring input'); return rows[0].json; }
function single(name) { const rows = $(name).all(); if(rows.length !== 1) throw new Error('Expected one aligned scoring item: '+name); return rows[0].json; }
const original = single('Build Analysis Request');
const failed = singleInput();
const request = { ...original.provider_request };
request.request_id = String(request.request_id || 'analysis') + '-retry-1';
request.result_id = String(request.result_id || 'result') + '-retry-1';
request.case_id = String(request.case_id || 'case') + '-retry-1';
request.system = String(request.system || '') + '\n\nAUTOMATIC VALIDATION RETRY — ONE ATTEMPT ONLY\nThe previous response failed automated validation with code: ' + String(failed.__automatic_retry_reason || 'unknown_validation_failure') + '. Return a complete fresh JSON object from the original transcript and instructions. Do not mention the failed attempt. Recheck all ten coaching fields, every manager_score field, every signal, and every exact timestamped evidence excerpt before returning. Do not lower or raise bands merely to pass validation.';
return [{ json: { ...original, retry_attempt: 1, provider_request: request } }];
