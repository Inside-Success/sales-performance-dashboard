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
function one(name){const a=$(name).all();if(a.length!==1)throw Error('Expected one aligned scoring item: '+name);return a[0].json;}
function input(){const a=$input.all();if(a.length!==1)throw Error('Expected one scoring item');return a[0].json;}

const s=one('Prepared Check State'),r=input();s.responses.push(r);
try{if(r.ok!==true)throw Error('Reassessment provider failed');s.review=r.parsed_json||parseCheck(r.model_text||'').value;}catch(e){s.status='failed';s.failure='reassessment_contract:'+String(e.message).slice(0,180);}
return [{json:s}];
