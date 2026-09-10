function one(name){const a=$(name).all();if(a.length!==1)throw Error('Expected one aligned scoring item: '+name);return a[0].json;}
function input(){const a=$input.all();if(a.length!==1)throw Error('Expected one scoring item');return a[0].json;}
function parseCheck(text){
 let s=String(text).trim();
 const blocks=[...s.matchAll(/```(?:json)?\s*\n([\s\S]*?)```/g)];
 if(blocks.length){
  const last=blocks[blocks.length-1];
  if(s.slice(last.index+last[0].length).includes('```'))throw Error('Incomplete final JSON block');
  s=last[1].trim();
 }

 try{return {value:JSON.parse(s),repaired_quotes:0};}catch{}
 let repaired=0;
 s=s.replace(/^(\s*"(?:evidence_ids|counterevidence_ids)"\s*:\s*\[)([^\]\n]*)(\]\s*,?\s*)$/gm,(line,head,body,tail)=>{
  const parts=body.split(',');if(!parts.every(x=>/^\s*"T\d{4}"\s*$/.test(x)||/^\s*T\d{4}"\s*$/.test(x)))return line;
  return head+parts.map(x=>x.replace(/^(\s*)(T\d{4}")(\s*)$/,(m,ws,id,end)=>{repaired++;return ws+'"'+id+end;})).join(',')+tail;
 });
 if(!repaired||repaired>3)throw Error('Invalid JSON requires bounded provider repair');
 return {value:JSON.parse(s),repaired_quotes:repaired};
}

const raw=input(),build=one('Build Analysis Request');
let parsed=raw.parsed_json;try{if(!parsed)parsed=parseCheck(raw.model_text||'').value;}catch{}
const fields=['one_line_verdict','biggest_strength','what_id_polish','coaching_tip','rudys_note','what_went_well','what_to_improve','why_no_close','what_made_this_close_work','objections_surfaced'];
const m=parsed?.manager_score;
const needs_repair=raw.ok===true&&(!parsed||fields.some(k=>!(k in parsed))||!m||!m.review||(m.eligible===true&&(!m.dimensions||!m.close_signals)));
if(parsed)raw.parsed_json=parsed;
const request={...build.provider_request,request_id:String(build.provider_request.request_id||'scorer')+'-format-repair',system:String(build.provider_request.system||'')+'\nReturn the complete required JSON schema. The previous response was incomplete or malformed. Preserve every supported assessment and do not change grades to satisfy formatting. One structural recovery attempt only.',call_purpose:'call2_score_primary_structure_recovery'};
return [{json:{raw,needs_repair,provider_request:request}}];
