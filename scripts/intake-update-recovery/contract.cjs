// Pure, credential-free update recovery. Never creates a record or transcript.
function intakeUpdatePayload(desired,before={}){
 const fields={};
 for(const [k,v] of Object.entries(desired))if(!['id','finalAirtableExactSearchFormula','writeMatchedBy'].includes(k)&&!k.startsWith('_'))fields[k]=v;
 if(/^Waiting for Zoom (?:audio )?transcript[;:]/i.test(String(fields['Manual Review Notes']||'')))fields['Manual Review Notes']='';
 const id=desired.id,key=fields['Automation Key'],uuid=fields['Zoom Meeting UUID'],file=fields['Recording File ID'],doc=fields['Transcript Google Doc ID'];
 if(!/^rec[a-zA-Z0-9]+$/.test(id||'')||!String(key||'').startsWith('zoom:')||!uuid||!file||!doc||fields['Processing Status']!=='Processed'||fields['Meeting Transcript Link']!=='https://docs.google.com/document/d/'+doc+'/edit')throw Error('Intake update recovery requires exact processed source and existing document');
 if(!String(key).endsWith(':'+uuid+':'+file))throw Error('Intake update recording identity mismatch');
 return {version:1,record_id:id,fields,before,attempt:0};
}
function intakeUpdatePatch(payload,record){
 const p=intakeUpdatePayload({id:payload.record_id,...payload.fields},payload.before);
 const old=record.fields||{},want=p.fields,before=p.before||{},clean=v=>String(v??'').trim();
 if(record.id!==p.record_id)throw Error('Intake recovery record ID mismatch');
 if(clean(old['Zoom Meeting UUID'])!==clean(want['Zoom Meeting UUID'])||clean(old['Meeting ID'])!==clean(want['Meeting ID']))throw Error('Intake recovery meeting identity conflict');
 const pending='zoom-pending:'+want['Automation Key'].slice(5,-(want['Recording File ID'].length+1));
 if(![want['Automation Key'],pending].includes(old['Automation Key']))throw Error('Intake recovery automation key conflict');
 for(const k of ['Recording File ID','Transcript Google Doc ID','Meeting Transcript Link'])if(clean(old[k])&&clean(old[k])!==clean(want[k]))throw Error('Intake recovery document or recording conflict');
 if(clean(old['Call #'])&&old['Call #']!=='Unknown'&&old['Call #']!==want['Call #'])throw Error('Intake recovery call classification conflict');
 if(old['Processing Status']==='Ignored')throw Error('Intake recovery source was intentionally ignored');
 const essential=['Automation Key','Recording File ID','Transcript Google Doc ID','Meeting Transcript Link','Processing Status','Call #'];
 const same=(k,a,b)=>['Meeting Start Date','Ingested At','Last Seen In Zoom At'].includes(k)&&Number.isFinite(Date.parse(a))&&Number.isFinite(Date.parse(b))?Date.parse(a)===Date.parse(b):clean(a)===clean(b);
 const patch={};
 for(const [k,v] of Object.entries(want)){
  if(same(k,old[k],v))continue;
  if(essential.includes(k)||!clean(old[k])||same(k,old[k],before[k]))patch[k]=v;
 }
 // Remove only the known obsolete pending-transcript note, never human notes.
 if(/^Waiting for Zoom (?:audio )?transcript[;:]/i.test(clean(old['Manual Review Notes'])))patch['Manual Review Notes']='';
 if(/^Waiting for Zoom transcript:/i.test(clean(old['Error Message'])))patch['Error Message']='';
 return {record_id:p.record_id,fields:patch,needs_write:Object.keys(patch).length>0};
}
function verifyIntakeUpdate(payload,record){
 const want=payload.fields,actual=record.fields||{};
 if(record.id!==payload.record_id)throw Error('Intake read-back record mismatch');
 for(const k of ['Automation Key','Zoom Meeting UUID','Recording File ID','Transcript Google Doc ID','Meeting Transcript Link','Processing Status','Call #'])if(actual[k]!==want[k])throw Error('Intake read-back mismatch: '+k);
 return true;
}
function selectIntakeUpdate(rows,now=Date.now()){
 const updates=rows.filter(r=>r.stage==='Update Airtable Record'&&r.status==='airtable_update_pending').filter(r=>{
  try{const p=JSON.parse(r.message);return p.version===1&&Number(p.attempt||0)<3&&Date.parse(p.due_at||r.occurred_at)<=now;}catch{return false;}
 });
 updates.sort((a,b)=>String(a.occurred_at).localeCompare(String(b.occurred_at)));
 return updates.slice(0,1);
}
module.exports={intakeUpdatePayload,intakeUpdatePatch,verifyIntakeUpdate,selectIntakeUpdate};
