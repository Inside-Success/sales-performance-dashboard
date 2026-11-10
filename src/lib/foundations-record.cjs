// Offline adapter candidate. This module does not call providers or publish reports.
const {digest}=require('./coaching-canonical.cjs');
const contract=require('./foundations-contract.cjs');
const LEGACY_GENERATION='magic-mike-foundations-candidate-2026-11-06';
const GENERATION='magic-mike-tyler-coaching-2026-11-10';
const copy=value=>structuredClone(value);
function required(value,label){if(typeof value!=='string'||!value.trim())throw Error('Missing '+label);return value;}
function receipt(response,expected){
 if(response?.request_id!==expected||response.ok!==true||!response.provider_response_id||!response.parsed_json||['length','max_tokens','refusal'].includes(response.stop_reason))throw Error('Unusable or misaligned provider receipt');
 return response.parsed_json;
}
function prepare({sourceId,policyRevision,policyText,blocks}){
 required(sourceId,'source');required(policyRevision,'policy revision');required(policyText,'policy');
 if(!Array.isArray(blocks)||!blocks.length||new Set(blocks.map(b=>b.id)).size!==blocks.length||blocks.some(b=>!b.id||typeof b.text!=='string'))throw Error('Invalid source evidence');
 return {generation:GENERATION,sourceId,policyRevision,policyText,policyHash:digest(policyText),blocks:copy(blocks),sourceHash:digest(blocks)};
}
function accept({prepared,draftResponse,draftRequestId,reviewResponse,reviewRequestId}){
 const draft=contract.validate(receipt(draftResponse,draftRequestId),prepared.blocks);
 const report=contract.acceptReview(draft,receipt(reviewResponse,reviewRequestId),prepared.blocks);
 return {prepared:copy(prepared),report:copy(report),digest:digest(report),writerRequestId:draftRequestId,reviewRequestId,safety:null};
}
function prosePaths(r){
 const paths=['outcome.text'];
 if(r.presentation==='tyler-review-v1')paths.push('summary');
 for(const [group,fields] of Object.entries({objections:['title','concern','response','assessment','teaching','example'],lessons:['title','observation','teaching','example'],next_steps:['text']}))r[group].forEach((_,i)=>fields.forEach(f=>paths.push(`${group}.${i}.${f}`)));
 if(r.presentation==='tyler-review-v1')r.objections.forEach((_,i)=>paths.push(`objections.${i}.exchange`));
 return new Set(paths);
}
function repair(candidate,expectedDigest,patches){
 if(digest(candidate.report)!==expectedDigest||candidate.digest!==expectedDigest)throw Error('Stale repair candidate');
 if(candidate.report.status!=='completed')throw Error('Excluded report is not repairable');
 const result=copy(candidate),allowed=prosePaths(result.report),seen=new Set();
 for(const p of patches){
  if(!allowed.has(p.path)||seen.has(p.path)||typeof p.before!=='string'||typeof p.after!=='string'||p.after===p.before)throw Error('Invalid atomic prose repair');
  seen.add(p.path);const keys=p.path.split('.'),last=keys.pop();let parent=result.report;for(const k of keys)parent=parent[k];
  if(parent[last]!==p.before)throw Error('Repair field changed');parent[last]=p.after;
 }
 contract.validate(result.report,result.prepared.blocks);result.digest=digest(result.report);result.safety=null;
 return result;
}
function safety(candidate,{candidateDigest,requestId,pass,unresolvedFindings}){
 required(requestId,'safety request');
 if(candidateDigest!==digest(candidate.report)||candidate.digest!==candidateDigest||pass!==true||!Array.isArray(unresolvedFindings)||unresolvedFindings.length)throw Error('Safety hold');
 return {...copy(candidate),safety:{candidateDigest,requestId,pass:true}};
}
function publish(candidate,{sourceId,channel}){
 if(!['official','manual'].includes(channel)||sourceId!==candidate.prepared.sourceId)throw Error('Publication source/channel mismatch');
 if(candidate.report.status!=='completed')throw Error('Exclusion must use exclusion accounting');
 if(!candidate.safety?.pass||candidate.safety.candidateDigest!==digest(candidate.report))throw Error('Unreviewed candidate');
 contract.validate(candidate.report,candidate.prepared.blocks);
 const {prepared,...reviewed}=copy(candidate);
 return {coaching_version:GENERATION,reviewed_coaching_v3:{...reviewed,source_id:sourceId,channel,source_hash:prepared.sourceHash,source_blocks:prepared.blocks,knowledge_manifest:prepared.knowledgeManifest||null,policy_revision:prepared.policyRevision,policy_hash:prepared.policyHash,policy_text:prepared.policyText,evidence_index:prepared.blocks.map(({id,timestamp})=>({id,timestamp:timestamp||null}))},markdown:contract.render(candidate.report,prepared.blocks)};
}
function read(payload,sourceId,channel){
 if(![GENERATION,LEGACY_GENERATION].includes(payload?.coaching_version))return null;
 const r=payload.reviewed_coaching_v3;
 if(!r||r.report?.status!=='completed'||!r.writerRequestId||!r.reviewRequestId||!r.safety?.requestId||digest(r.policy_text)!==r.policy_hash||r.source_id!==sourceId||r.channel!==channel||!r.safety?.pass||r.digest!==digest(r.report)||r.safety.candidateDigest!==r.digest)throw Error('Invalid bound report');
 if(r.source_blocks!==undefined&&(!Array.isArray(r.source_blocks)||digest(r.source_blocks)!==r.source_hash))throw Error("Invalid bound transcript");
 contract.validate(r.report,r.source_blocks||r.evidence_index);
 return {report:r.report,markdown:contract.render(r.report,r.evidence_index),policyText:r.policy_text,sourceBlocks:r.source_blocks||null};
}
module.exports={GENERATION,digest,prepare,accept,repair,safety,publish,read};
function sections(payload,sourceId,channel){
 const loaded=read(payload,sourceId,channel);if(!loaded)return null;
 // One deterministic renderer supplies Docs/chat/dashboard, without diagnostic metadata.
 const chunks=loaded.markdown.split(/^## /m),result=loaded.report.presentation==='tyler-review-v1'?[]:[{key:'outcome',title:'Call outcome',items:[chunks[0].replace(/^# Call coaching\s*\*\*Outcome:\*\*\s*/, '').trim()]}];
 for(const chunk of chunks.slice(1)){const i=chunk.indexOf('\n'),title=chunk.slice(0,i).trim(),body=chunk.slice(i+1).trim();const key=title.startsWith('Objections')?'objections':title==='Next steps'?'next-steps':title==='Coaching snapshot'?'summary':title==='Call outcome'?'outcome':({'Reading the buyer':'interpretation','Choosing your approach':'strategy','Principles to use again':'foundations'}[title]||'lessons');const items=(key==='next-steps'?body.split(/^[-] /m):body.split(/^### /m)).filter(x=>x.trim()).map(s=>s.replace(/\*\*([^*]+)\*\*/g,'$1').trim());result.push({key,title,items});}
 return result;
}
module.exports.sections=sections;
