// Execute candidate Code nodes against saved isolated evidence, without network.
const fs=require('node:fs'),assert=require('node:assert/strict');
const {transcriptBlocks}=require('../coaching-release/structured-coaching.cjs');
const {normalizeObjectionReport,renderObjectionReport,OBJECTION_VERSION}=require('../../src/lib/objection-coaching.cjs');
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
 const calls=JSON.parse(fs.readFileSync(inputs));const call=calls.find(c=>String(c.id)==='8212');const blocks=transcriptBlocks(call.transcript);
 const saved=JSON.parse(fs.readFileSync(dir+'/upgrade-8212-review-claude-opus-5-5-v6.json'));
 const draft=normalizeObjectionReport(saved.parsed_json.corrected_report||JSON.parse(fs.readFileSync(dir+'/upgrade-8212-write-claude-sonnet-5-5-v6.json')).parsed_json);
 const generated={ok:true,stop_reason:'end_turn',request_id:'test-writer',parsed_json:draft,model:'test',costs:{total_cost_usd:0},usage:{input_tokens:0}};
 const state={case_id:'recTest',coaching_version:OBJECTION_VERSION,coaching_policy_revision:'test',coaching_policy_text:'Test policy',coaching_model:'test',provider_results:[],gate_output:{call_status:'scored'},selectedCard:{fact_card_id:'main_istv'},caseItem:{case_id:'recTest',metadata:{airtable_record_id:'recTest',rep_name:'Test',client_name:'Buyer'},source:{'Source Airtable Record ID':'recTest'},cleaned_transcript:call.transcript}};
 const prepared={state,blocks,provider_request:{request_id:'test-writer',system:'test'}};
 const checked=(await run('FShnTde2OGhIUZE4','Validate Draft',{prepared,generated})).json;assert.equal(checked.needs_repair,false);
 const auditPrepared=(await run('FShnTde2OGhIUZE4','Build Factual Audit',checked)).json;
 const audit={ok:true,stop_reason:'end_turn',request_id:auditPrepared.provider_request.request_id,parsed_json:{pass:true,findings:[],corrected_report:null},model:'test',costs:{total_cost_usd:0},usage:{input_tokens:0}};
 const reviewed=(await run('FShnTde2OGhIUZE4','Render Reviewed Report',audit,{'Build Factual Audit':auditPrepared})).json;
 assert.equal(reviewed.parsed_json.reviewed_coaching_v2.version,'objection-coaching-v2');
 const flat=reviewed.parsed_json;state.coaching_raw=flat;state.reviewed_coaching_v2=flat.reviewed_coaching_v2;
 const final=(await run('L8Nn7xncA9ZPDdWA','Performance Agent',{state})).json;
 assert.equal(final.reviewed_coaching_v2.source_id,'recTest');assert.equal(final.agent_version,OBJECTION_VERSION);
 const cached=(await run('X9L4JtDbpkSCflxZ','Restore Cached Result',{call_purpose:'objection_v2_writer',request_id:'new-request',checkpoint:{result:generated}},{'Validate Claim':{call_purpose:'objection_v2_writer',checkpoint:{result:generated}}}))[0].json;
 assert.equal(cached.request_id,'new-request');assert.equal(cached.costs.total_cost_usd,0);assert.equal(cached.checkpoint_reused,true);
 const invalid={...generated,parsed_json:{version:'objection-coaching-v2'}};
 const transport=(await run('X9L4JtDbpkSCflxZ','Validate Result',invalid,{'Validate Claim':{call_purpose:'objection_v2_writer',case_id:'recTest',checkpoint:{token:'test'}}}))[0].json;
 assert.equal(transport.valid,true);assert.ok(transport.result.contract_errors.length); // API rejects reusable cache; draft still reaches bounded repair.
 const manualInput={public_id:'manual-test',rep_name:'Test',client_name:'Buyer',cleaned_transcript:call.transcript};
 const manualPrepared={...prepared,state:{...state,input:manualInput,provider_results:[]}};
 const manualAuditPrepared=(await run('BMRrGxHyXMcgO6j3','MM Manual Build Factual Audit',generated,{'MM Manual Build Structured Coaching':manualPrepared})).json;
 const manualReviewed=(await run('BMRrGxHyXMcgO6j3','MM Manual Render Audited Coaching',{...audit,request_id:manualAuditPrepared.provider_request.request_id},{'MM Manual Build Factual Audit':manualAuditPrepared})).json;
 const manualFinal=(await run('BMRrGxHyXMcgO6j3','MM Manual Finalize Coaching',manualReviewed)).json;
 const manualParsed=(await run('BMRrGxHyXMcgO6j3','Parse AI Output',manualFinal,{'Build AI Prompt':manualInput}))[0].json;
 assert.equal(manualParsed.reviewed_coaching_v2.source_id,'manual-test');assert.equal(manualParsed.coaching_version,OBJECTION_VERSION);
 const doc=(await run('BMRrGxHyXMcgO6j3','Build Google Doc',manualParsed))[0].json;
 assert.ok(doc.doc_text.includes('Enhanced'));assert.ok(doc.doc_text.includes('Objections and responses'));assert.ok(!doc.doc_text.includes('not_raised'));
 const callback=(await run('BMRrGxHyXMcgO6j3','Build Complete Callback',{}, {'Build Google Doc':doc,'Create Google Doc':{id:'doc-test'}}))[0].json;
 assert.equal(callback.coaching_version,OBJECTION_VERSION);assert.equal(callback.reviewed_coaching_v2.source_id,'manual-test');
 console.log('Compiled manual audit, safety binding, parse, Google Doc and callback handoffs passed.');
 console.log('Compiled official validation, audit, final safety binding, cache reuse and malformed-draft handoff passed.');
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
