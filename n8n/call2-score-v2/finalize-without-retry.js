function singleInput() { const rows = $input.all(); if(rows.length !== 1) throw new Error('Expected one scoring input'); return rows[0].json; }
const input = singleInput();
const { __automatic_retry_required, __automatic_retry_reason, ...result } = input;
return [{ json: { ...result, automatic_retry: { attempted: false, attempts: 1, initial_reason: null, succeeded: null } } }];
