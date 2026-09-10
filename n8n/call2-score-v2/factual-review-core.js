// Pure, bounded application of a factual editor's replacements. Never execute model paths/code.
function applyFactualReview(draft, review, transcript, claims) {
  const fail = reason => ({ok:false, reason});
  const obj = x => x !== null && typeof x === 'object' && !Array.isArray(x);
  const coaching = ['one_line_verdict','biggest_strength','what_id_polish','coaching_tip','rudys_note','what_went_well','what_to_improve','why_no_close','what_made_this_close_work','objections_surfaced'];
  const dims = ['frame_and_control','prospect_read_and_tailoring','objection_handling','close_mechanics_and_momentum'];
  const manager = ['critical_events','close_signals','review','eligible','ineligible_reason','call_phase','confidence','lead_context'];
  const allowed = new Set([...dims.flatMap(x=>['reason','band','evidence','counterevidence'].map(k=>'/manager_score/dimensions/'+x+'/'+k)),...manager.map(x=>'/manager_score/'+x)]);
  const normalize = x => String(x || '').replace(/[\u2018\u2019]/g,"'").replace(/[\u201c\u201d]/g,'"').replace(/\s+/g,' ').trim().toLowerCase();
  const valueAt = (root,path) => path.slice(1).split('/').reduce((v,k)=>obj(v) && Object.hasOwn(v,k) ? v[k] : undefined,root);
  const strings = x => typeof x==='string' ? x : Array.isArray(x) ? x.map(strings).join('\n') : obj(x) ? Object.values(x).map(strings).join('\n') : '';
  const lines=String(transcript||'').split(/\r?\n/);
  const grounded = e => {
    if(!obj(e)||typeof e.timestamp!=='string'||typeof e.quote!=='string'||!e.quote.trim())return false;
    const stamp=e.timestamp.replace(/^\[|\]$/g,'');
    if(!/^\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?$/.test(stamp))return false;
    const matches=lines.filter(line=>/^\[\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?\]/.test(line) && normalize(line.slice(line.indexOf(']')+1).replace(/^[^:]*:/,'')).includes(normalize(e.quote)));
    return matches.some(line=>line.includes('['+stamp+']')) || (normalize(e.quote).split(' ').length>=5 && matches.length===1);
  };
  if(!obj(draft)||!obj(draft.manager_score))return fail('missing_draft');
  if(!Array.isArray(claims)||!claims.length)return fail('missing_claims');
  if(!obj(review)||!Array.isArray(review.checks)||!['approved','corrected','withhold'].includes(review.verdict)||!Array.isArray(review.findings)||!Array.isArray(review.patches)||typeof review.summary!=='string')return fail('invalid_review_schema');
  const claimIds=new Set(claims.map(c=>c.id));
  if(review.checks.length!==claims.length || new Set(review.checks.map(c=>c.claim_id)).size!==claims.length || review.checks.some(c=>!obj(c)||!claimIds.has(c.claim_id)||!['supported','correction_required','uncertain'].includes(c.status)||typeof c.explanation!=='string'||!Array.isArray(c.finding_ids)))return fail('incomplete_claim_review');
  if(review.checks.some(c=>c.status==='uncertain') && review.verdict!=='withhold')return fail('unresolved_claim');
  if(review.checks.some(c=>c.status==='supported'&&c.finding_ids.length || c.status==='correction_required'&&!c.finding_ids.length))return fail('unlinked_claim_review');
  if(review.findings.length>30||review.patches.length>allowed.size)return fail('oversized_review');
  if(review.verdict==='withhold')return fail('reviewer_withheld');
  if(review.verdict==='approved')return review.findings.length===0&&review.patches.length===0&&review.checks.every(c=>c.status==='supported') ? {ok:true,draft:JSON.parse(JSON.stringify(draft)),changedPaths:[],verdict:'approved'} : fail('contradictory_approval');
  if(!review.findings.length||!review.patches.length)return fail('empty_correction');
  const ids=new Set(), paths=new Map();
  for(const f of review.findings){
    if(!obj(f)||typeof f.id!=='string'||!f.id||ids.has(f.id)||typeof f.problem!=='string'||!f.problem.trim()||!Array.isArray(f.affected_paths)||!f.affected_paths.length||!Array.isArray(f.source_evidence)||!f.source_evidence.length||!Array.isArray(f.retracted_phrases))return fail('invalid_finding');
    ids.add(f.id);
    if(f.affected_paths.some(path=>!allowed.has(path)))return fail('forbidden_finding_path');
    if(f.source_evidence.some(e=>!grounded(e)))return fail('ungrounded_review_finding');
    for(const phrase of f.retracted_phrases){
      if(typeof phrase!=='string'||phrase.trim().length<4||!f.affected_paths.some(path=>normalize(strings(valueAt(draft,path))).includes(normalize(phrase))))return fail('invalid_retracted_phrase');
    }
  }
  if(review.checks.some(c=>c.finding_ids.some(id=>!ids.has(id))) || review.findings.some(f=>!review.checks.some(c=>c.status==='correction_required'&&c.finding_ids.includes(f.id))))return fail('orphan_finding');
  const next=JSON.parse(JSON.stringify(draft));
  for(const patch of review.patches){
    if(!obj(patch)||!allowed.has(patch.path)||paths.has(patch.path)||!Object.hasOwn(patch,'value')||!Array.isArray(patch.finding_ids)||!patch.finding_ids.length||patch.finding_ids.some(id=>!ids.has(id))||typeof patch.reason!=='string'||!patch.reason.trim())return fail('invalid_patch');
    if(patch.finding_ids.some(id=>!review.findings.find(f=>f.id===id).affected_paths.includes(patch.path)))return fail('unlinked_patch');
    if(coaching.includes(patch.path.slice(1)) && (typeof patch.value!=='string'||!patch.value.trim()))return fail('invalid_coaching_patch');
    if(patch.path==='/manager_score/critical_events'){
      const events=new Set(['no_close_attempt','no_concrete_next_step','abandoned_primary_objection','lost_control_unrecovered','no_adaptation_after_clear_signal']);
      if(!Array.isArray(patch.value)||patch.value.some(e=>!obj(e)||!events.has(e.type)))return fail('invalid_critical_event_patch');
    }
    const parts=patch.path.slice(1).split('/'),key=parts.pop();
    let parent=next;
    for(const part of parts){if(!obj(parent[part]))return fail('missing_patch_parent');parent=parent[part];}
    parent[key]=JSON.parse(JSON.stringify(patch.value));paths.set(patch.path,patch);
  }
  for(const f of review.findings){
    for(const path of f.affected_paths){
      if(!paths.has(path)||!paths.get(path).finding_ids.includes(f.id))return fail('unapplied_finding');
      if(f.retracted_phrases.some(phrase=>normalize(strings(valueAt(next,path))).includes(normalize(phrase))))return fail('retracted_claim_survived');
    }
  }
  return {ok:true,draft:next,changedPaths:[...paths.keys()],verdict:'corrected'};
}
