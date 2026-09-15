const assert = require('node:assert/strict');
const test = require('node:test');
const nodes = require('./released-code-nodes.json');
const run = (name, json, lookup = {}) => new Function('$json', '$', '$execution', nodes[name])(json, n => ({item: {json: lookup[n]}, isExecuted: n === 'MM Recovery Entry'}), {id: 'test'});
const draft = () => ({status:'completed',call_status:'scored',outcome:{payment:'not_confirmed',summary:'A follow-up was agreed.',evidence_ids:['b1']},payment_actions:[],strengths:[{observation:'You confirmed the next meeting.',why_useful:'Sets a clear next step.',evidence_ids:['b1']}],improvements:[],blockers:[],next_steps:[]});
const prepared = () => ({blocks:[{id:'b1',timestamp:'00:01:00',text:'Let us meet tomorrow.'}],provider_request:{request_id:'call-a',prompt:'For refused calls use empty arrays and an unclear outcome.'}});
const input = a => ({prepared:prepared(),generated:{ok:true,request_id:'call-a',parsed_json:a}});
test('valid coaching requires no repair',()=>assert.equal(run('Validate Draft',input(draft())).json.needs_repair,false));
test('unknown citations and inconsistent status route to repair',()=>{
 const a=draft();a.outcome.evidence_ids=['missing'];assert.equal(run('Validate Draft',input(a)).json.needs_repair,true);
 a.call_status='transcript_too_short';assert.equal(run('Validate Draft',input(a)).json.needs_repair,true);
});
test('refusal must be independently confirmed with actual transcript references',()=>{
 const a={status:'refused',call_status:'transcript_too_short',refusal_reason:'Administrative conversation only.',outcome:{evidence_ids:['b1']}};
 assert.equal(run('Validate Draft',input(a)).json.needs_repair,true);
 const p={...input(a),provider_request:{request_id:'call-a-schema-repair'}};
 assert.equal(run('Validate Repaired Draft',{ok:true,request_id:p.provider_request.request_id,parsed_json:a},{'Draft Repair Request':p}).json.eligible,false);
 a.outcome.evidence_ids=['missing'];delete a.eligibility_evidence_ids;assert.throws(()=>run('Validate Repaired Draft',{ok:true,request_id:p.provider_request.request_id,parsed_json:a},{'Draft Repair Request':p}),/after one repair/);
});
test('misaligned response is rejected, not attached to another call',()=>{const p=input(draft());p.generated.request_id='other-call';assert.throws(()=>run('Validate Draft',p),/alignment/)});
test('fenced JSON can be parsed without another AI request',()=>{const p=input(draft());p.generated.model_text='```json\n'+JSON.stringify(p.generated.parsed_json)+'\n```';delete p.generated.parsed_json;assert.equal(run('Validate Draft',p).json.needs_repair,false)});
test('repair prompt resolves contradictory refusal instructions',()=>{const p=run('Validate Draft',input({status:'completed',call_status:'internal_training'})).json;const text=run('Draft Repair Request',p).json.provider_request.prompt;assert(!text.includes('For refused calls use empty arrays and an unclear outcome.'));assert(text.includes('outcome.evidence_ids'))});
test('audit failure cannot turn into a successful factual review',()=>{
 const p={analysis:draft(),blocks:prepared().blocks,provider_request:{request_id:'audit'},generated:{}};
 const a={outcome_pass:false,rejected_strengths:[],rejected_improvements:[],rejected_examples:[],rejected_blockers:[],rejected_next_steps:[],improvement_reviews:[],findings:[]};
 assert.throws(()=>run('Render Reviewed Report',{ok:true,request_id:'audit',parsed_json:a},{'Build Factual Audit':p}),/factual audit/);
 a.outcome_pass=true;delete a.findings;assert.throws(()=>run('Render Repaired Audit',{ok:true,request_id:'audit-schema-repair',parsed_json:a},{'Build Factual Audit':p}),/Missing audit findings/);
});
test('existing report short circuits replay and validates source alignment',()=>{
 const id='rec12345678901234';const lookup={'MM Recovery Entry':{source_id:id},'MM Recovery Source Record':{id,fields:{'Processing Status':'Processed','Meeting Transcript Link':'https://example.com/transcript'}}};
 assert.equal(run('MM Recovery Guard',{records:[{id:'report-existing'}]},lookup).json.exists,true);
 assert.throws(()=>run('MM Recovery Guard',{records:[]},{...lookup,'MM Recovery Entry':{source_id:'other'}}),/source mismatch/);
});
test('delivery requires matching dashboard acknowledgement, including n8n buffered responses',()=>{
 const lookup={'If':{'Source Airtable Record ID':'source-a'},'Create a record':{id:'report-a'}};
 const response={ok:true,id:'100',airtable_record_id:'report-a'};
 assert.equal(run('MM Coaching Delivery Receipt',response,lookup).json.status,'delivered');
 assert.equal(run('MM Coaching Delivery Receipt',{_readableState:{buffer:[{data:[...Buffer.from(JSON.stringify(response))]}]}},lookup).json.status,'delivered');
 assert.equal(run('MM Coaching Delivery Receipt',{ok:true,id:'100',airtable_record_id:'wrong'},lookup).json.status,'needs_review');
});
test('classifier exclusions record a terminal result without inventing coaching',()=>{
 const lookup={'If':{'Source Airtable Record ID':'source-a'}};
 const r=run('MM Recovered Classifier Exclusion',{gate_output:{call_status:'transcript_too_short',classification_reason:'Technical interruption before sales discussion.'}},lookup);
 assert.equal(r.json.status,'excluded');assert.equal(r.json.report_id,'');
 assert.throws(()=>run('MM Recovered Classifier Exclusion',{gate_output:{call_status:'scored',classification_reason:'A sales call.'}},lookup),/Unverified/);
});
test('coaching provider transport is internal, and exclusion tracking cannot advance the loop twice',()=>{
 const t=require('./released-topology.json');
 for(const [flow,names] of [['official',['MM Coaching Provider']],['reliability',['Draft Repair Provider','Factual Audit Provider','Audit Repair Provider']]]){
  for(const name of names){const n=t[flow].nodes.find(x=>x.name===name);assert.equal(n.type,'n8n-nodes-base.executeWorkflow');assert.equal(n.calledWorkflow,t['internal-provider'].id);}
 }
 assert.equal(t.official.connections['MM Save Classifier Exclusion'],undefined);
 assert(!t['internal-provider'].nodes.some(n=>n.type==='n8n-nodes-base.webhook'));
});
test('malformed audit can take one targeted repair and then render normally',()=>{
 const p={analysis:draft(),blocks:prepared().blocks,provider_request:{request_id:'audit',prompt:'Verify against block b1.'},generated:{}};
 const request=run('Audit Repair Request',{error:'Missing audit findings'},{'Build Factual Audit':p,'Factual Audit Provider':{model_text:'{}'}}).json.provider_request;
 assert.equal(request.request_id,'audit-schema-repair');assert(request.prompt.includes('Missing audit findings'));
 const audit={outcome_pass:true,rejected_strengths:[],rejected_improvements:[],rejected_examples:[],rejected_blockers:[],rejected_next_steps:[],improvement_reviews:[],findings:[]};
 const result=run('Render Repaired Audit',{ok:true,request_id:request.request_id,parsed_json:audit},{'Build Factual Audit':p});assert.equal(result.json.parsed_json.status,'completed');
});
