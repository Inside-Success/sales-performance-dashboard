function one(name){const a=$(name).all();if(a.length!==1)throw Error('Expected one aligned scoring item: '+name);return a[0].json;}
function input(){const a=$input.all();if(a.length!==1)throw Error('Expected one scoring item');return a[0].json;}

const s=input();let result=s.baseline;
if(s.status==='checked'){
 try{
  const scoped=acceptedReviewScope(s.raw,s.build,s.audit,s.review),revised=apply(s.raw,s.build,s.audit,scoped),checked=reviewedValidate(revised,s.build)[0].json;
  if(checked.validation?.valid!==true)throw Error('Corrected assessment failed validation: '+(checked.validation?.errors||[]).join(','));
  result=checked;s.status='passed';
 }catch(e){s.status='failed';s.failure='correction_validation:'+String(e.message).slice(0,180);}
}
const costs={};for(const key of ['input_cost_usd','cache_write_cost_usd','cache_read_cost_usd','output_cost_usd','total_cost_usd'])costs[key]=[s.raw,...s.responses].reduce((sum,r)=>sum+Number(r.costs?.[key]||0),0);
const audit={revision:'bounded-claims-2026-09-10',status:s.status,model:'claude-sonnet-4-6',checker_called:s.should_review,reassessment_called:s.needs_reassessment,completion_repair_called:s.completion_repair_attempted===true,accepted_corrections:s.status==='passed'?(s.review.decisions||[]).filter(x=>x.accepted).map(x=>x.claim_id):[],syntax_repairs:s.syntax_repairs||0,failure:s.failure||null};
result=JSON.parse(JSON.stringify(result));result.provider_costs=costs;result.factual_review=audit;result.automatic_retry={attempted:s.raw.primary_format_repair===true,attempts:s.raw.primary_format_repair?2:1,initial_reason:s.raw.primary_format_repair?'malformed_primary_structure':null,succeeded:s.raw.primary_format_repair?result.validation?.valid===true:null};
if(result.current_call_score?.review)result.current_call_score.review.factual_review=audit;
result.validation.warnings=[...(result.validation.warnings||[]),...(s.status==='failed'?['bounded_review_failed_baseline_preserved:'+s.failure]:[])];
if(s.status==='failed' && s.audit && !s.completion_repair_attempted && /^(correction_validation:|reassessment_contract:)/.test(s.failure||'') && s.responses.every(r=>r.ok===true))result.__review_recovery=JSON.parse(JSON.stringify(s));
return [{json:result}];

