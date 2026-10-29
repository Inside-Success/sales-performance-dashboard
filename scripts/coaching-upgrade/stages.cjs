/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS is embedded in n8n Code nodes and run directly by Node. */
// Pure stage adapters: replace existing writer/reviewer work, never add AI passes.
const {OBJECTION_VERSION,objectionErrors,normalizeObjectionReport,assertObjectionReport,renderObjectionReport}=require('../../src/lib/objection-coaching.cjs');
function enhancedPrepared(p){return p?.state?.coaching_version===OBJECTION_VERSION;}
function validateEnhancedDraft(p,generated,repaired=false) {
 const expected=repaired?p.provider_request.request_id:p.prepared.provider_request.request_id;
 if(generated.request_id!==expected)throw Error('Coaching source alignment failed');
 let analysis=generated.parsed_json;
 if(!analysis&&typeof generated.model_text==='string'){try{analysis=JSON.parse(generated.model_text.replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,''));}catch{}}
 analysis=normalizeObjectionReport(analysis);
 const errors=objectionErrors(analysis,p.prepared.blocks);
 if(generated.ok===false||['length','max_tokens'].includes(generated.stop_reason))errors.push('Incomplete provider response');
 if(analysis?.status==='refused'&&!repaired)errors.push('Eligibility disagreement requires confirmation');
 if(repaired&&errors.length)throw Error('Coaching draft remains invalid after one repair: '+errors.join('; '));
 return {prepared:p.prepared,generated:{...generated,request_id:p.prepared.provider_request.request_id,parsed_json:analysis},analysis,needs_repair:!!errors.length,eligible:!errors.length&&analysis?.status!=='refused',errors,repaired};
}
function acceptEnhancedAudit(prepared,response,expectedId) {
 if(response.request_id!==expectedId)throw Error('Audit source alignment failed');
 if(response.ok===false||['length','max_tokens'].includes(response.stop_reason))throw Error('Coaching audit generation failed');
 const audit=response.parsed_json,known=new Set(prepared.blocks.map(b=>b.id));
 if(typeof audit?.pass!=='boolean'||!Array.isArray(audit.findings))throw Error('Incomplete factual audit');
 for(const f of audit.findings)if(typeof f.issue!=='string'||!f.issue.trim()||!Array.isArray(f.evidence_ids)||f.evidence_ids.some(id=>!known.has(id)))throw Error('Invalid coaching audit evidence');
 if(audit.pass && (audit.findings.length||audit.corrected_report!==null))throw Error('Conflicting coaching audit verdict');
 if(!audit.pass && !audit.findings.length)throw Error('Correction requires explicit findings');
 const report=assertObjectionReport(normalizeObjectionReport(audit.pass?prepared.analysis:audit.corrected_report),prepared.blocks);
 if(report.status==='refused')throw Error('Audit cannot silently change eligibility');
 const provenance={generation:OBJECTION_VERSION,policy_revision:prepared.state.coaching_policy_revision,policy_hash:prepared.state.coaching_policy_hash,policy_text:prepared.state.coaching_policy_text,writer_model:prepared.generated.model,reviewer_model:response.model,writer_request_id:prepared.generated.request_id,audit_request_id:response.request_id};
 return renderObjectionReport(report,prepared.blocks,'pending',provenance);
}
function enhancedSafetyView(record) {
 assertObjectionReport(record);
 const {provenance,evidence_times,source_id,...analysis}=record;
 void provenance;void evidence_times;void source_id;
 return JSON.parse(JSON.stringify(analysis));
}
function finishEnhancedSafety(state,analysis,sourceId) {
 const original=state.reviewed_coaching_v2;
 if(!original)throw Error('Enhanced coaching safety hold: missing reviewed report');
 if((state.repair_targets||[]).some(target=>!(state.repair_rows||[]).some(row=>row.id===target.id&&row.applied)))throw Error('Enhanced coaching safety hold: unapplied repair');
 if(state.safety_screen_error||state.repair_error)throw Error('Enhanced coaching safety hold: incomplete safety stage');
 const index=state.coaching_evidence_index;
 if(!Array.isArray(index)||!index.length)throw Error('Enhanced coaching safety hold: missing evidence index');
 const validated=assertObjectionReport(normalizeObjectionReport(analysis),index);
 // Safety may reduce prose, but cannot silently reclassify the call or its buyers.
 const identity=r=>({version:r.version,show:r.show,offer_family:r.offer_family,evidence_quality:r.evidence_quality,payment:r.outcome?.payment,objections:r.objections?.map(o=>[o.category,o.handling,o.resolution,o.evidence_ids,o.counterevidence_ids]),not_raised:r.not_raised});
 if(JSON.stringify(identity(validated))!==JSON.stringify(identity(original)))throw Error('Enhanced coaching safety hold: classification changed');
 return renderObjectionReport(validated,index,String(sourceId||''),{...original.provenance,safety_repaired:!!state.repair_rows?.some(r=>r.applied),safety_reviewed:true});
}
function bindEnhancedAfterSafety(record,before,after,sourceId) {
 if(!record)return null;
 if(!sourceId)throw Error('Enhanced coaching source identity missing');
 assertObjectionReport(record);
 // A later safety edit must never be bypassed by a stale rich object. Keep held
 // for review/recovery instead of publishing an Enhanced badge on old content.
 const fields=['one_line_verdict','biggest_strength','what_id_polish','coaching_tip','rudys_note','what_went_well','what_to_improve','why_no_close','what_made_this_close_work','objections_surfaced','winnability'];
 if(fields.some(k=>JSON.stringify(before[k])!==JSON.stringify(after[k])))throw Error('Enhanced coaching safety hold: structured report changed after review');
 return {...record,source_id:String(sourceId)};
}
module.exports={enhancedSafetyView,finishEnhancedSafety,enhancedPrepared,validateEnhancedDraft,acceptEnhancedAudit,bindEnhancedAfterSafety};
