// Build reviewed candidate graphs offline. Never calls n8n or activates a parent.
const esbuild=require('esbuild'),path=require('node:path');
const {build:documents}=require('./workflow-adapters.cjs');
const record=require('../../src/lib/foundations-record.cjs');
function runtime(){return 'const structuredClone=value=>JSON.parse(JSON.stringify(value));\n'+esbuild.buildSync({stdin:{contents:"module.exports={...require('./src/lib/foundations-record.cjs'),...require('./scripts/coaching-foundations/production-boundary.cjs'),transition:require('./scripts/coaching-foundations/transition.cjs')}",resolveDir:path.resolve(__dirname,'../..')},bundle:true,write:false,format:'iife',globalName:'MM_FOUNDATIONS',platform:'node',target:'es2022'}).outputFiles[0].text;}
function replaceOnce(text,from,to){if(text.split(from).length!==2)throw Error('Workflow anchor drift: '+from.slice(0,80));return text.replace(from,to);}
function build(baselines,{coreWorkflowId,system,models,modelConfigs}){
 if(!coreWorkflowId||['L8Nn7xncA9ZPDdWA','BMRrGxHyXMcgO6j3','X9L4JtDbpkSCflxZ','FShnTde2OGhIUZE4'].includes(coreWorkflowId))throw Error('Separate candidate core required');
 const out=documents(baselines),code=runtime(),edge=node=>({node,type:'main',index:0});
 for(const [id,channel,start,provider,adapter,final]of[
 ['L8Nn7xncA9ZPDdWA','official','MM Build Coaching Request','MM Coaching Provider','MM Reliable Coaching','Performance Agent'],
 ['BMRrGxHyXMcgO6j3','manual','MM Manual Build Structured Coaching','MM Manual Structured Coaching Provider','MM Manual Build Factual Audit','MM Manual Finalize Coaching']]){
  const w=out[id],get=name=>{const n=w.nodes.find(n=>n.name===name);if(!n)throw Error('Missing node '+name);return n;};
  const initial=get(start);initial.parameters.jsCode=code+'\nconst built=await(async()=>{\n'+initial.parameters.jsCode+'\n})();\n'+`
const p=built.json,state=p.state;
const sourceId=${channel==='manual'?'state.input?.public_id':"state.caseItem?.metadata?.airtable_record_id||state.caseItem?.metadata?.source_airtable_record_id||state.caseItem?.source?.['Source Airtable Record ID']||state.caseItem?.case_id"};
if(!sourceId)throw Error('Missing exact coaching source');
const call={metadata:state.caseItem?.metadata||state.input,blocks:p.blocks};
const prepared=MM_FOUNDATIONS.prepare({sourceId:String(sourceId),policyRevision:'foundations-presentation-2026-11-09',policyText:${JSON.stringify(system)},blocks:p.blocks});
p.foundations_input={prepared,call,system:${JSON.stringify(system)},models:${JSON.stringify(models)},channel:${JSON.stringify(channel)}};
const t=MM_FOUNDATIONS.transition.start(p.foundations_input),cfg=${JSON.stringify(modelConfigs)}[t.request.model];
p.provider_request={...cfg,...t.request,model:cfg.model,call_purpose:'foundations_writer_v3'};
state.coaching_version=MM_FOUNDATIONS.GENERATION;state.coaching_revision=MM_FOUNDATIONS.GENERATION;state.coaching_policy_revision=prepared.policyRevision;state.coaching_policy_hash=prepared.policyHash;state.coaching_policy_text=${JSON.stringify(system)};state.coaching_model=${JSON.stringify(modelConfigs[models.writer].model)};
return [{json:p}];`;
  const p=get(provider);p.parameters={workflowId:{__rl:true,value:coreWorkflowId,mode:'id'},workflowInputs:{mappingMode:'defineBelow',value:{body:`={{ $('${start}').item.json.foundations_input }}`},matchingColumns:[],schema:[{id:'body',displayName:'body',required:true,type:'object'}],attemptToConvertTypes:false,convertFieldsToString:false},options:{waitForSubWorkflow:true}};
  const a=get(adapter);a.type='n8n-nodes-base.code';a.typeVersion=2;delete a.credentials;
  a.parameters={jsCode:code+`\nconst prepared=$('${start}').itemMatching(0).json;const state=MM_FOUNDATIONS.bindState(prepared.state,$json,${JSON.stringify(channel)});return [{json:{ok:true,parsed_json:state.coaching_raw,state,coaching_version:MM_FOUNDATIONS.GENERATION}}];`};
  if(channel==='manual'){
   const parse=get('Parse AI Output');parse.parameters.jsCode=replaceOnce(parse.parameters.jsCode,'if(upgraded&&$json.error)',"if((upgraded||$('MM Manual Build Structured Coaching').item.json.state?.coaching_version==="+JSON.stringify(record.GENERATION)+")&&$json.error)");
   w.connections[adapter]={main:[[edge(final)]]};
   const n=get(final);n.parameters.jsCode=code+'\n'+n.parameters.jsCode;
   n.parameters.jsCode=replaceOnce(n.parameters.jsCode,'let coaching = clone(state.coaching_raw || {});',`if(state.coaching_version===MM_FOUNDATIONS.GENERATION){const parsed=MM_FOUNDATIONS.project(state.coaching_raw,state.input.public_id,'manual');return [{json:{...state.input,manual_parsed:parsed,manual_safety_log:state.coaching_safety_log,provider_results:state.provider_results,agent_version:MM_FOUNDATIONS.GENERATION,coaching_version:MM_FOUNDATIONS.GENERATION,coaching_model:state.coaching_model}}];}\nlet coaching = clone(state.coaching_raw || {});`);
   for(const [name,anchor,addition]of[
    ['Parse AI Output','reviewed_coaching_v1: parsed.reviewed_coaching_v1 || null,','reviewed_coaching_v3: parsed.reviewed_coaching_v3 || null, '],
    ['Build Complete Callback','reviewed_coaching_v1: report.reviewed_coaching_v1 || null,','reviewed_coaching_v3: report.reviewed_coaching_v3 || null, ']])get(name).parameters.jsCode=replaceOnce(get(name).parameters.jsCode,anchor,addition+anchor);
  }else{
   const comp=get('MM Build Compliance Request');comp.parameters.jsCode=replaceOnce(comp.parameters.jsCode,'state.provider_results.push({ purpose: "coaching", result: coachingResult });','if(coachingResult.state?.coaching_version===MM_FOUNDATIONS_GENERATION){state.provider_results=coachingResult.state.provider_results;state.coaching_safety_log=coachingResult.state.coaching_safety_log;}else state.provider_results.push({ purpose: "coaching", result: coachingResult });');comp.parameters.jsCode='const MM_FOUNDATIONS_GENERATION='+JSON.stringify(record.GENERATION)+';\n'+comp.parameters.jsCode;comp.parameters.jsCode=replaceOnce(comp.parameters.jsCode,'state.reviewed_coaching_v2 = reviewedResult.reviewed_coaching_v2 || null;','state.reviewed_coaching_v3 = reviewedResult.reviewed_coaching_v3 || null;\nstate.reviewed_coaching_v2 = reviewedResult.reviewed_coaching_v2 || null;');
   const screen=get('MM Build Safety Screen Request');screen.parameters.jsCode=code+'\n'+screen.parameters.jsCode;
   screen.parameters.jsCode=replaceOnce(screen.parameters.jsCode,'state.compliance_filter_log = filtered.filterLog;',`state.compliance_filter_log = filtered.filterLog;\nif(state.coaching_version===MM_FOUNDATIONS.GENERATION){const payload={coaching_version:state.coaching_version,reviewed_coaching_v3:state.reviewed_coaching_v3};MM_FOUNDATIONS.read(payload,state.reviewed_coaching_v3?.source_id,'official');state.coaching_raw=MM_FOUNDATIONS.project(payload,state.reviewed_coaching_v3.source_id,'official');return [{json:{state,foundations_safety_cleared:true}}];}`);
   const previous=w.connections[screen.name];if(previous.main[0].length!==1)throw Error('Safety routing drift');
   const route={id:'foundations-safe-route',name:'MM Foundations Safety Already Reviewed',type:'n8n-nodes-base.if',typeVersion:2.2,position:[screen.position[0]+180,screen.position[1]],parameters:{conditions:{options:{version:2,typeValidation:'strict'},conditions:[{id:'safe',leftValue:'={{ $json.foundations_safety_cleared === true }}',rightValue:'',operator:{type:'boolean',operation:'true',singleValue:true}}],combinator:'and'},options:{}}};w.nodes.push(route);w.connections[screen.name]={...previous,main:[[edge(route.name)],...previous.main.slice(1)]};w.connections[route.name]={main:[[edge(final)],previous.main[0]]};
   const n=get(final);n.parameters.jsCode=code+'\n'+n.parameters.jsCode;
   n.parameters.jsCode=replaceOnce(n.parameters.jsCode,'let coaching = clone(state.coaching_raw || {});',`if(state.coaching_version===MM_FOUNDATIONS.GENERATION){const payload={coaching_version:state.coaching_version,reviewed_coaching_v3:state.reviewed_coaching_v3};const coaching=MM_FOUNDATIONS.project(payload,sourceIdFromState(state),'official');const output=buildScoredOutput(state,coaching);return [{json:{...state.caseItem.source,output,reviewed_coaching_v3:state.reviewed_coaching_v3,coaching_version:MM_FOUNDATIONS.GENERATION,agent_version:MM_FOUNDATIONS.GENERATION,pipeline:{gate_output:state.gate_output,compliance_filter_log:state.compliance_filter_log,coaching_safety_log:state.coaching_safety_log,provider_results:state.provider_results}}}];}\nlet coaching = clone(state.coaching_raw || {});`);
   const slack=get('Code in JavaScript');slack.parameters.jsCode=code+'\n'+slack.parameters.jsCode;
   slack.parameters.jsCode=replaceOnce(slack.parameters.jsCode,'function coachingSections(report, { splitClosingLabels = true } = {}) {',"function coachingSections(report, { splitClosingLabels = true } = {}) {if(report.coaching_version===MM_FOUNDATIONS.GENERATION)return MM_FOUNDATIONS.sections(report,report.reviewed_coaching_v3?.source_id||'','official');");
   slack.parameters.jsCode=replaceOnce(slack.parameters.jsCode,'const report={reviewed_coaching_v2:',"const report={coaching_version:$('Performance Agent').itemMatching(0).json.coaching_version,reviewed_coaching_v3:$('Performance Agent').itemMatching(0).json.reviewed_coaching_v3,reviewed_coaching_v2:");
   slack.parameters.jsCode=replaceOnce(slack.parameters.jsCode,"(report.reviewed_coaching_v2?'Enhanced':'Legacy')","(report.coaching_version===MM_FOUNDATIONS.GENERATION?'Enhanced':'Legacy')");
   const post=get('Post to Dashboard');post.parameters.body=replaceOnce(post.parameters.body,"reviewed_coaching_v1: $('Performance Agent').item.json.reviewed_coaching_v1 || null,","reviewed_coaching_v3: $('Performance Agent').item.json.reviewed_coaching_v3 || null, reviewed_coaching_v1: $('Performance Agent').item.json.reviewed_coaching_v1 || null,");
  }
  for(const name of [start,adapter,final,...(channel==='official'?['MM Build Safety Screen Request']:[])]){const n=get(name);if(n.parameters.mode==='runOnceForEachItem')n.parameters.jsCode='const __foundationsItem=await(async()=>{\n'+n.parameters.jsCode+'\n})();return Array.isArray(__foundationsItem)?__foundationsItem[0]:__foundationsItem;';}
  w.active=false;w.name='CANDIDATE ONLY - '+w.name;
 }
 return out;
}
module.exports={build,replaceOnce,runtime};
