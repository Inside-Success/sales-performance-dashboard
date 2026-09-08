// Match by durable call key. Empty Airtable results may combine multiple paired inputs.
function attachReconciliationPrecheck(sources,searchItems){
 const clean=v=>String(v??'').trim(),byKey=new Map(),sourceKeys=new Set();
 for(const item of sources){const key=clean(item.json?.automationKey);if(!key||sourceKeys.has(key))throw Error('Missing or duplicate reconciliation source key');sourceKeys.add(key);}
 for(let i=0;i<searchItems.length;i++){
  const record=searchItems[i].json||{};if(record.error)throw Error('Reconciliation search failed');if(!record.id)continue;
  const fields=record.fields||record,key=clean(fields['Automation Key']);
  if(!sourceKeys.has(key))throw Error('Reconciliation search key does not match this batch');
  if(byKey.has(key))throw Error('Multiple Airtable records for reconciliation key');byKey.set(key,{record,fields,index:i});
 }
 return sources.map(item=>{
  const source=item.json,key=clean(source.automationKey),match=byKey.get(key),fields=match?.fields||{};
  const complete=!!match&&clean(fields['Processing Status'])==='Processed'&&['Meeting Transcript Link','Transcript Google Doc ID','Recording File ID'].every(k=>clean(fields[k]));
  return {json:{...source,reconciliationPrecheckFound:!!match,reconciliationPrecheckRecordId:match?match.record.id:'',reconciliationPrecheckComplete:!!complete,reconciliationSkipExpensivePath:!!complete,reconciliationPrecheckReason:complete?'Exact existing processed Airtable row has transcript doc; skipped expensive reconciliation path.':match?'Exact Airtable row exists but is incomplete; continuing repair path.':'No exact Airtable row found; continuing ingest path.'},pairedItem:{item:match?.index??0}};
 });
}
module.exports={attachReconciliationPrecheck};
