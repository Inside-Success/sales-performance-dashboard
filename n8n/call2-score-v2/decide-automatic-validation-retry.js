function singleInput() { const rows = $input.all(); if(rows.length !== 1) throw new Error('Expected one scoring input'); return rows[0].json; }
const result = singleInput();
const reason = String(result.current_call_score?.reason || result.validation?.errors?.[0] || '');
const retryablePattern = /^(invalid_direct_ask_evidence:|contradictory_direct_ask:|provider_unparseable_json|missing_coaching_field:|missing_manager_score$|missing_score_review$|invalid_counterevidence:|missing_dimension_review:|invalid_close_signal:|missing_dimension:|ungrounded_dimension_evidence:|invalid_confidence$|invalid_not_applicable:|invalid_band:|insufficient_applicable_weight$)/;
const excluded = Boolean(result.current_call_score?.exclusion_category);
const retryable = result.validation?.valid === false && !excluded && retryablePattern.test(reason);
return [{ json: { ...result, __automatic_retry_required: retryable, __automatic_retry_reason: reason || null } }];
