import {accountEarlyOutcome} from './build-accounting-containment.mjs';

export function accountUpstreamOutcome(row, input, executionId, attempts=0) {
  // Existing terminal Set nodes keep their original contract and classifier provenance.
  if (input.call_status !== undefined) return accountEarlyOutcome(row, input, executionId, attempts);
  const sourceId = row?.['Source Airtable Record ID'];
  const attendance = String(input['Upstream Attendance Status'] || '').trim().toLowerCase();
  const reason = String(input['Upstream Attendance Reason'] || '').trim();
  if (!/^rec[A-Za-z0-9]+$/.test(sourceId || '') || input['Source Airtable Record ID'] !== sourceId)
    throw Error('Upstream no-show source identity mismatch; no receipt written');
  if (attendance !== 'rep_no_show' || !reason || input._mm_classifier_gate)
    throw Error('Unverified upstream no-show; no exclusion written');
  return {source_id:sourceId,status:'excluded',execution_id:String(executionId),
    updated_at:new Date().toISOString(),attempts,report_id:'',message:JSON.stringify({
      revision:'upstream-no-show-accounting-2026-10-22',status:'rep_no_show',
      provenance:'upstream_attendance',reason})};
}

export const code = accountEarlyOutcome.toString()+'\n'+accountUpstreamOutcome.toString()+
  "\nreturn {json:accountUpstreamOutcome($('Loop Over Items').item.json,$json,$execution.id,$('MM Recovery Entry').isExecuted?Number($('MM Recovery Entry').first().json.recovery_attempt||1):0),pairedItem:{item:0}};";

export function buildUpstreamNoShowAccounting(before) {
  const current = before.nodes.find(n=>n.name==='MM Account Early Outcome');
  if (!current?.parameters.jsCode.startsWith(accountEarlyOutcome.toString()) || current.onError !== 'continueErrorOutput')
    throw Error('Accounting node changed; inspect before applying');
  const branch = before.connections['If Upstream Rep No Show']?.main;
  if (JSON.stringify(branch) !== JSON.stringify([
    [{node:'Set: rep_no_show',type:'main',index:0}],
    [{node:'Set: call_1',type:'main',index:0}]])) throw Error('Upstream routing changed; inspect before applying');
  return [
    {type:'updateNode',nodeName:current.name,updates:{'parameters.jsCode':code}},
    {type:'addConnection',source:'If Upstream Rep No Show',target:current.name,branch:'true'},
  ];
}
