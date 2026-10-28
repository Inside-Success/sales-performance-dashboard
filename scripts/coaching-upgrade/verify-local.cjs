/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS is embedded in n8n Code nodes and run directly by Node. */
// Execute candidate Code nodes against saved isolated evidence, without network.
const fs=require('node:fs'),assert=require('node:assert/strict');
const {transcriptBlocks}=require('../coaching-release/structured-coaching.cjs');
const {OBJECTION_VERSION}=require('../../src/lib/objection-coaching.cjs');
const dir=process.argv[2],inputs=process.argv[3];
if(!dir||!inputs)throw Error('Private snapshots and evaluation input file required');
const ops=JSON.parse(fs.readFileSync(dir+'/candidate-operations.json'));
const run=async(id,name,json,nodes={},extra={})=>{
 const code=ops[id].find(o=>o.nodeName===name)?.updates['parameters.jsCode'];if(!code)throw Error('Missing candidate '+name);
 const $=name=>{if(!nodes[name])throw Error('Unexpected node read '+name);return {item:{json:nodes[name]},first:()=>({json:nodes[name]}),itemMatching:()=>({json:nodes[name]})};};
 const $input={first:()=>({json}),all:()=>[{json}]};
 return new (Object.getPrototypeOf(async function(){}).constructor)('$json','$','$input',...Object.keys(extra),code)(json,$,$input,...Object.values(extra));
};
(async()=>{
 const calls=JSON.parse(fs.readFileSync(inputs));for(const call of calls.filter(c=>fs.existsSync(dir+'/final-'+c.id+'-v7.json'))){const blocks=transcriptBlocks(call.transcript);
 const draft=JSON.parse(fs.readFileSync(dir+'/final-'+call.id+'-v7.json')).reviewed_coaching_v2;
 const generated={ok:true,stop_reason:'end_turn',request_id:'test-writer',parsed_json:draft,model:'test',costs:{total_cost_usd:0},usage:{input_tokens:0}};
 const state={case_id:'recTest',coaching_version:OBJECTION_VERSION,coaching_policy_revision:draft.provenance.policy_revision,coaching_policy_text:draft.provenance.policy_text,coaching_evidence_index:blocks.map(({id,timestamp})=>({id,timestamp})),result_id:'upgrade-safety-'+call.id,coaching_model:'test',provider_results:[],gate_output:{call_status:'scored'},selectedCard:{fact_card_id:'main_istv'},compliance_post_filter:{red_flags:[]},caseItem:{case_id:'recTest',metadata:{airtable_record_id:'recTest',rep_name:'Test',client_name:'Buyer'},source:{'Source Airtable Record ID':'recTest'},cleaned_transcript:call.transcript}};
 const prepared={state,blocks,provider_request:{request_id:'test-writer',system:'test'}};
 const actualWriter=(await run('L8Nn7xncA9ZPDdWA','MM Build Coaching Request',{state})).json;
 assert.equal(actualWriter.provider_request.model,'claude-sonnet-5-5');assert.equal(actualWriter.provider_request.prompt_cache,true);
 assert.equal(actualWriter.provider_request.call_purpose,'objection_v2_writer');assert.equal(actualWriter.blocks.length,blocks.length);
 assert.equal(actualWriter.state.coaching_evidence_index.length,blocks.length);

 const checked=(await run('FShnTde2OGhIUZE4','Validate Draft',{prepared,generated})).json;assert.equal(checked.needs_repair,false);
 const auditPrepared=(await run('FShnTde2OGhIUZE4','Build Factual Audit',checked)).json;
 const audit={ok:true,stop_reason:'end_turn',request_id:auditPrepared.provider_request.request_id,parsed_json:{pass:true,findings:[],corrected_report:null},model:'test',costs:{total_cost_usd:0},usage:{input_tokens:0}};
 const reviewed=(await run('FShnTde2OGhIUZE4','Render Reviewed Report',audit,{'Build Factual Audit':auditPrepared})).json;
 assert.equal(reviewed.parsed_json.reviewed_coaching_v2.version,'objection-coaching-v2');
 const flat=reviewed.parsed_json;state.coaching_raw=flat;state.reviewed_coaching_v2=flat.reviewed_coaching_v2;
 const safety=(await run('L8Nn7xncA9ZPDdWA','MM Build Safety Screen Request',{ok:true,parsed_json:{red_flags:[]}}, {'MM Build Compliance Request':{state}})).json;
 fs.writeFileSync(dir+'/safety-'+call.id+'.request.json',JSON.stringify({...safety.provider_request,request_id:'upgrade-'+call.id+'-safety-v8'}));
 fs.writeFileSync(dir+'/safety-'+call.id+'.prepared.json',JSON.stringify(safety));
 assert.ok(!JSON.stringify(safety.state.coaching_raw).includes('policy_text'));
 const screen={ok:true,request_id:safety.provider_request.request_id,parsed_json:{case_pass:true,unsupported_specifics:[],collisions:[],additional_safety_hits:[]}};
 const repairPrepared=(await run('L8Nn7xncA9ZPDdWA','MM Prepare Repair',screen,{'MM Build Safety Screen Request':safety})).json;
 if(repairPrepared.repair_target_count){
  // Exercise the existing bounded safety repair with exact source sentence edits.
  const repairs=repairPrepared.state.repair_targets.map(t=>({id:t.id,operation:'remove-span',after:t.before.replace(/approved|correct/gi,'current')}));
  const repaired=(await run('L8Nn7xncA9ZPDdWA','Performance Agent',{ok:true,parsed_json:{repairs},state:repairPrepared.state}, {'MM Prepare Repair':repairPrepared})).json;
  assert.ok(repaired.reviewed_coaching_v2.provenance.safety_repaired);
 }

 const final=(await run('L8Nn7xncA9ZPDdWA','Performance Agent',{state:safety.state})).json;
 assert.equal(final.reviewed_coaching_v2.source_id,'recTest');assert.equal(final.agent_version,OBJECTION_VERSION);
 const slack=(await run('L8Nn7xncA9ZPDdWA','Code in JavaScript',{'Sales Rep':'Test','Client Name':'Buyer'}, {'Performance Agent':final,'If':{}}))[0].json;
 assert.ok(JSON.parse(slack.top_level_payload).blocks[0].text.text.includes('Enhanced'));
 assert.ok(slack.thread_payload.includes('Objections and responses'));
 const cached=(await run('X9L4JtDbpkSCflxZ','Restore Cached Result',{call_purpose:'objection_v2_writer',request_id:'new-request',checkpoint:{result:generated}},{'Validate Claim':{call_purpose:'objection_v2_writer',checkpoint:{result:generated}}}))[0].json;
 assert.equal(cached.request_id,'new-request');assert.equal(cached.costs.total_cost_usd,0);assert.equal(cached.checkpoint_reused,true);
 const invalid={...generated,parsed_json:{version:'objection-coaching-v2'}};
 const transport=(await run('X9L4JtDbpkSCflxZ','Validate Result',invalid,{'Validate Claim':{call_purpose:'objection_v2_writer',case_id:'recTest',checkpoint:{token:'test'}}}))[0].json;
 assert.equal(transport.valid,true);assert.ok(transport.result.contract_errors.length); // API rejects reusable cache; draft still reaches bounded repair.
 const manualInput={public_id:'manual-test',rep_name:'Test',client_name:'Buyer',cleaned_transcript:call.transcript};
 const manualPrepared={...prepared,state:{...state,input:manualInput,provider_results:[]}};
 const manualWriter=(await run('BMRrGxHyXMcgO6j3','MM Manual Build Structured Coaching',{state:manualPrepared.state})).json;
 assert.equal(manualWriter.provider_request.model,'claude-sonnet-5-5');assert.equal(manualWriter.provider_request.prompt_cache,true);
 assert.equal(manualWriter.blocks.length,blocks.length);

 const manualAuditPrepared=(await run('BMRrGxHyXMcgO6j3','MM Manual Build Factual Audit',generated,{'MM Manual Build Structured Coaching':manualPrepared})).json;
 const manualReviewed=(await run('BMRrGxHyXMcgO6j3','MM Manual Render Audited Coaching',{...audit,request_id:manualAuditPrepared.provider_request.request_id},{'MM Manual Build Factual Audit':manualAuditPrepared})).json;
 const manualSafety=(await run('BMRrGxHyXMcgO6j3','MM Manual Build Safety Screen Request',manualReviewed)).json;
 assert.ok(!JSON.stringify(manualSafety.state.coaching_raw).includes('policy_text'));
 const manualFinal=(await run('BMRrGxHyXMcgO6j3','MM Manual Finalize Coaching',manualSafety)).json;
 const manualParsed=(await run('BMRrGxHyXMcgO6j3','Parse AI Output',manualFinal,{'Build AI Prompt':manualInput,'MM Manual Build Structured Coaching':manualPrepared}))[0].json;
 assert.equal(manualParsed.reviewed_coaching_v2.source_id,'manual-test');assert.equal(manualParsed.coaching_version,OBJECTION_VERSION);
 const doc=(await run('BMRrGxHyXMcgO6j3','Build Google Doc',manualParsed))[0].json;
 assert.ok(doc.doc_text.includes('Enhanced'));assert.ok(doc.doc_text.includes('Objections and responses'));assert.ok(!doc.doc_text.includes('not_raised'));
 const callback=(await run('BMRrGxHyXMcgO6j3','Build Complete Callback',{}, {'Build Google Doc':doc,'Create Google Doc':{id:'doc-test'}}))[0].json;
 assert.equal(callback.coaching_version,OBJECTION_VERSION);assert.equal(callback.reviewed_coaching_v2.source_id,'manual-test');
 console.log('Passed compiled handoffs for case '+call.id);
 }
 console.log('Compiled manual audit, safety binding, parse, Google Doc and callback handoffs passed.');
 console.log('Compiled official validation, audit, final safety binding, cache reuse and malformed-draft handoff passed.');
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
