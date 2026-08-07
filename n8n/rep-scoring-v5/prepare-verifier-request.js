const response = $input.first()?.json || {};
const source = $('Prepare Evidence-Bound Request').first().json;
const content = response.choices?.[0]?.message?.content;
const primaryText = typeof content === 'string' ? content : JSON.stringify(content || {});
const system = `You are an independent evidence verifier for Magic Mike V5 calibration. Do not rescore the call and do not make the assessment harsher or easier. Check whether the primary assessment follows the fairness contract and is supported by the exact transcript. Return one JSON object only.

Verify: transcript reliability; separation of prospect opportunity from rep execution; correct Call 1 disposition logic; context-sensitive treatment of difficult prospects, repetition, and call length; checkpoint applicability; exact quotes; no credit for prerecorded/other-speaker conduct; no forced weakness or strength; and whether any critical finding is directly evidenced and materially serious.

An applicable completed/partial/missed checkpoint needs evidence showing both the context/fair opportunity and the behavior being judged. Missing behavior may be supported by the surrounding exchange, but must not be inferred from silence in a truncated transcript. Do not invalidate a fair assessment merely because you would phrase it differently.`;
const user = `CALL TYPE: ${source.callType}
RESOLVED REP SPEAKER LABELS: ${source.resolvedSpeakerLabels.join(' | ')}
REQUIRED CHECKPOINT KEYS: ${source.checkpointDefinitions.map(row => row.key).join(', ')}

PRIMARY ASSESSMENT:
${primaryText}

TRANSCRIPT:
${source.transcript}

Return:
{"accepted":true|false,"material_disagreement":true|false,"invalid_checkpoint_keys":["key"],"invalid_finding_labels":["label"],"warnings":["concise warning"],"reason":"concise verification summary"}`;
const requestBody = { model: 'deepseek-v4-pro', messages: [{ role: 'system', content: system }, { role: 'user', content: user }], thinking: { type: 'disabled' }, temperature: 0, response_format: { type: 'json_object' }, stream: false, max_tokens: 5000 };
return [{ json: { ...source, primaryResponse: response, requestBody } }];
