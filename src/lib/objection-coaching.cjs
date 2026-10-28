// Shared pure contract, embedded verbatim into n8n. No I/O or credentials.
const OBJECTION_VERSION = 'magic-mike-objection-coaching-2026-10-29';
const OBJECTION_SCHEMA_VERSION = 'objection-coaching-v2';
const OBJECTION_CATEGORIES = {
  cost: 'Cost and payment barriers', value: 'Perceived value/benefits',
  confidence: 'Confidence in ISTV', terms: 'Contract/Terms concerns',
  fit: 'Offer suitability / Fit for the applicant',
  practical: 'Practical feasibility and constraints',
  portrayal: 'Portrayal and publicity concerns', approval: 'Approval',
  commitment: 'Commitment and Priority concerns', unclassified: 'Unclassified objection',
};

function objectionErrors(r, blocks) {
  const errors = [];
  const known = blocks ? new Set(blocks.map(b => b.id)) : null;
  const text = (v, key, max=1800, optional=false) => {
    if (typeof v !== 'string' || (!optional && !v.trim()) || v.length > max) errors.push('Invalid '+key);
    else if (/\bT\d{4,}\b|_{3,}|\[insert\b|\{\{[^}]+\}\}/i.test(v)) errors.push('Unfinished or internal text in '+key);
  };
  const refs = (v, key, optional=false) => {
    if (!Array.isArray(v) || (!optional && !v.length) || v.length>40 || new Set(v).size!==v.length || v.some(id=>typeof id!=='string'||!/^T\d{4,}$/.test(id)||(known&&!known.has(id)))) errors.push('Invalid evidence for '+key);
  };
  const list = (v, key, max) => { if(!Array.isArray(v)||v.length>max){errors.push('Invalid '+key);return [];} return v; };
  if(!r || typeof r!=='object' || Array.isArray(r)) return ['Missing objection coaching'];
  if(r.version!==OBJECTION_SCHEMA_VERSION) errors.push('Wrong objection coaching version');
  if(r.status!==undefined&&!['completed','refused'].includes(r.status))errors.push('Invalid report status');
  if(r.status==='refused') {
    if(!['call_1','prospect_no_show','rep_no_show','transcript_too_short','internal_training'].includes(r.call_status))errors.push('Invalid exclusion');
    text(r.refusal_reason,'exclusion reason');refs(r.eligibility_evidence_ids,'exclusion');return errors;
  }
  if(!['main_istv','next_level_ceo','reality','mixed','unknown'].includes(r.offer_family))errors.push('Invalid offer family');
  if(!['sufficient','limited'].includes(r.evidence_quality))errors.push('Invalid evidence quality');
  text(r.summary,'summary',500);text(r.show,'show',120);
  if(!['confirmed','not_confirmed','unclear'].includes(r.outcome?.payment))errors.push('Invalid payment state');
  text(r.outcome?.summary,'outcome');refs(r.outcome?.evidence_ids,'outcome');
  const obs=list(r.objections,'objections',20);
  for(const o of obs){
    if(!o||typeof o!=='object'){errors.push('Invalid objection');continue;}
    if(!Object.hasOwn(OBJECTION_CATEGORIES,o.category))errors.push('Unknown objection category');
    for(const k of ['title','concern','response','assessment'])text(o[k],k,k==='title'?120:1800);
    if(!['handled_well','could_be_handled_better','not_enough_evidence'].includes(o.handling))errors.push('Invalid handling');
    if(!['resolved','partly_resolved','unresolved','unclear'].includes(o.resolution))errors.push('Invalid resolution');
    text(o.recommendation,'recommendation',1800,true);text(o.suggested_words,'suggested words',1000,true);
    if(o.handling==='could_be_handled_better' && !o.recommendation?.trim())errors.push('Missing useful recommendation');
    if(o.handling!=='could_be_handled_better' && (o.recommendation?.trim()||o.suggested_words?.trim()))errors.push('Advice for sound or uncertain handling');
    refs(o.evidence_ids,'objection');refs(o.counterevidence_ids,'objection counterevidence',true);
  }
  text(r.no_objections_reason,'no objections reason',1200,true);
  if(obs.length && r.no_objections_reason?.trim())errors.push('Contradictory no-objection claim');
  if(!obs.length && !r.no_objections_reason?.trim())errors.push('Missing no-objection explanation');
  if(!obs.length && r.evidence_quality==='limited' && /no objections (?:identified|raised|occurred)/i.test(r.no_objections_reason||''))errors.push('Missing evidence is not no objections');
  const absent=list(r.not_raised,'not raised',9),raised=new Set(obs.map(o=>o?.category));
  if(new Set(absent).size!==absent.length||absent.some(k=>k==='unclassified'||!Object.hasOwn(OBJECTION_CATEGORIES,k)||raised.has(k)))errors.push('Contradictory category accounting');
  if(r.evidence_quality==='limited' && absent.length)errors.push('Limited evidence cannot establish absent categories');
  if(r.evidence_quality==='sufficient')for(const k of Object.keys(OBJECTION_CATEGORIES).filter(k=>k!=='unclassified'))if(!raised.has(k)&&!absent.includes(k))errors.push('Unaccounted category '+k);
  for(const p of list(r.improvements,'improvements',8)){
    if(!p||typeof p!=='object'){errors.push('Invalid improvement');continue;}
    for(const k of ['title','observation','why_it_matters','action'])text(p[k],k,k==='title'?120:1800);
    refs(p.evidence_ids,'improvement');refs(p.counterevidence_ids,'improvement counterevidence',true);
  }
  for(const p of list(r.strengths,'strengths',8)){
    if(!p||typeof p!=='object'){errors.push('Invalid strength');continue;}
    for(const k of ['title','observation','why_it_matters'])text(p[k],k,k==='title'?120:1800);
    refs(p.evidence_ids,'strength');
  }
  for(const p of list(r.next_steps,'next steps',8)){
    if(!p||typeof p!=='object'){errors.push('Invalid next step');continue;}
    if(!['agreed','recommended'].includes(p.kind))errors.push('Invalid next step kind');
    text(p.observation,'next step');refs(p.evidence_ids,'next step');
  }
  return [...new Set(errors)];
}

function normalizeObjectionReport(value) {
 if(!value||typeof value!=='object'||Array.isArray(value)||value.status==='refused'||!Array.isArray(value.objections))return value;
 // Absent-category bookkeeping is deterministic, not another model judgment.
 const raised=new Set(value.objections.map(o=>o?.category));
 return {...value,not_raised:value.evidence_quality==='sufficient'?Object.keys(OBJECTION_CATEGORIES).filter(k=>k!=='unclassified'&&!raised.has(k)):[]};
}
function objectionProviderStage(stage) {return ['objection_v2_writer','objection_v2_repair','objection_v2_audit','objection_v2_audit_repair'].includes(stage);}
function objectionProviderErrors(stage,value) {
 if(!objectionProviderStage(stage))return [];
 if(!stage.includes('audit'))return objectionErrors(normalizeObjectionReport(value));
 if(!value||typeof value.pass!=='boolean'||!Array.isArray(value.findings))return ['Invalid objection audit contract'];
 const errors=[];
 if(value.pass&&(value.findings.length||value.corrected_report!==null))errors.push('Conflicting audit verdict');
 if(!value.pass){if(!value.findings.length)errors.push('Missing audit findings');errors.push(...objectionErrors(normalizeObjectionReport(value.corrected_report)));}
 for(const f of value.findings)if(!f||typeof f.issue!=='string'||!f.issue.trim()||!Array.isArray(f.evidence_ids)||!f.evidence_ids.length||f.evidence_ids.some(id=>typeof id!=='string'||!/^T\d{4,}$/.test(id)))errors.push('Invalid audit finding');
 return errors;
}

function assertObjectionReport(r,blocks){const e=objectionErrors(r,blocks);if(e.length)throw Error('Invalid coaching contract: '+e.join('; '));return r;}

function objectionSections(r, blocks=[]) {
  assertObjectionReport(r);
  const byId=new Map(blocks.map(b=>[b.id,b]));
  const evidence=p=>[...new Set([...(p.evidence_ids||[]),...(p.counterevidence_ids||[])].map(id=>byId.get(id)?.timestamp||r.evidence_times?.[id]).filter(Boolean))];
  const line=(text,p)=>text+(evidence(p).length?' ['+evidence(p).join(', ')+']':'');
  const handling={handled_well:'Handled well',could_be_handled_better:'Could be handled better',not_enough_evidence:'Not enough evidence to judge'};
  const resolution={resolved:'Resolved',partly_resolved:'Partly resolved',unresolved:'Unresolved',unclear:'Resolution unclear'};
  return [
    {key:'takeaway',title:'Main takeaway',items:[r.summary]},
    {key:'outcome',title:'Call outcome',items:[line(r.outcome.summary,r.outcome)]},
    {key:'objections',title:'Objections and responses',items:r.objections.length?r.objections.map(o=>line([
      o.title,'Concern: '+o.concern,'Your response: '+o.response,
      handling[o.handling]+' · '+resolution[o.resolution],o.assessment,
      o.recommendation?'Next time: '+o.recommendation:'',o.suggested_words?'You could say: “'+o.suggested_words+'”':'',
    ].filter(Boolean).join('\n'),o)):[r.no_objections_reason]},
    {key:'improvements',title:'Other ways to improve',items:r.improvements.map(p=>line('Focus: '+p.title+'\n'+p.observation+'\nWhy it matters: '+p.why_it_matters+'\nNext time: '+p.action,p))},
    {key:'strengths',title:'What you did well',items:r.strengths.map(p=>line(p.observation+' '+p.why_it_matters,p))},
    {key:'next-steps',title:'Next steps',items:r.next_steps.map(p=>line((p.kind==='agreed'?'Agreed: ':'Recommended: ')+p.observation,p))},
  ].filter(s=>s.items.length);
}

function renderObjectionReport(r,blocks,sourceId,provenance={}) {
  assertObjectionReport(r,blocks);
  if(r.status==='refused')return {status:'refused',call_status:r.call_status,refusal_reason:r.refusal_reason};
  if(typeof sourceId!=='string'||!sourceId)throw Error('Missing coaching source identity');
  const evidence_times=Object.fromEntries(blocks.filter(b=>b.timestamp).map(b=>[b.id,b.timestamp]));
  const saved={...r,source_id:sourceId,evidence_times,provenance};
  const sections=objectionSections(saved,blocks), section=k=>sections.find(s=>s.key===k)?.items.join('\n\n')||'';
  const primary=r.objections.find(o=>o.handling==='could_be_handled_better');
  const action=primary?.recommendation||r.improvements[0]?.action||r.summary;
  return {status:'completed',call_status:'scored',refusal_reason:null,
    one_line_verdict:r.outcome.summary,biggest_strength:r.strengths[0]?.observation||'No specific repeatable strength is established by the available transcript.',
    what_id_polish:primary?primary.concern+'\nNext time: '+action:r.improvements[0]?.observation||'No specific improvement is supported by this call.',
    coaching_tip:action,rudys_note:r.summary,what_went_well:section('strengths')||'No specific repeatable strength is established by the available transcript.',
    what_to_improve:section('improvements')||'No additional improvement is supported by this call.',
    why_no_close:r.outcome.payment==='confirmed'?'Not applicable: payment was confirmed on this call.':r.outcome.summary+(section('next-steps')?'\n\n'+section('next-steps'):''),
    what_made_this_close_work:r.outcome.payment==='confirmed'?r.outcome.summary:'No completed payment was confirmed on this call.',
    objections_surfaced:section('objections'),winnability:r.outcome.summary,
    reviewed_coaching_v2:saved};
}

function readObjectionCoaching(payload,sourceId) {
  if(!payload||typeof payload!=='object'||payload.coaching_version!==OBJECTION_VERSION)return null;
  const r=payload.reviewed_coaching_v2;
  if(!r||r.status==='refused'||objectionErrors(r).length||!sourceId||r.source_id!==sourceId)return null;
  return r;
}

module.exports={OBJECTION_VERSION,OBJECTION_SCHEMA_VERSION,OBJECTION_CATEGORIES,objectionErrors,normalizeObjectionReport,objectionProviderStage,objectionProviderErrors,assertObjectionReport,objectionSections,renderObjectionReport,readObjectionCoaching};
