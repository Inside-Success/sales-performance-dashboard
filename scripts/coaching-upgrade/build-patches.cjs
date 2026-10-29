/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS is embedded in n8n Code nodes and run directly by Node. */
// Build scoped Code-node changes from private live snapshots. Never deploys.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {coachingSystem,writerPrompt,reviewerPrompt,MODELS,POLICY_REVISION}=require('./prompts.cjs');
const {policyPack}=require('./policy.cjs');
const {manualLocalSafetyRepairs}=require('./manual-safety.cjs');
const {checkpointJsonOrder}=require('./checkpoint-json.cjs');
const {patchSafetyProse}=require('./build-safety-prose.cjs');
const {OBJECTION_VERSION}=require('../../src/lib/objection-coaching.cjs');
const {replaceOnce}=require('../coaching-insights/patches.cjs');
const root=path.resolve(__dirname,'../..');
const runtime=fs.readFileSync(path.join(root,'src/lib/objection-coaching.cjs'),'utf8').replace(/module\.exports\s*=[\s\S]*$/,'');
const stages=fs.readFileSync(path.join(__dirname,'stages.cjs'),'utf8').replace(/^const .*?=require\([^\n]+\);\n/m,'').replace(/module\.exports\s*=[\s\S]*$/,'');
const embedded=runtime+'\n'+stages;
const router=fs.readFileSync(path.join(root,'src/lib/coaching-offer-context.cjs'),'utf8').replace(/module\.exports\s*=[\s\S]*$/,'');
const policy=policyPack(),system=coachingSystem(policy),policyHash=crypto.createHash('sha256').update(policy).digest('hex');
function wrapWriter(original,model){return embedded+'\n'+router+'\n'+writerPrompt.toString()+`\nconst prepared=await (async()=>{${original}\n})();
const p=prepared.json,state=p.state;
const sourceMetadata=state.caseItem?.metadata||state.input||{};
const metadata=Object.fromEntries(Object.entries(sourceMetadata).filter(([k])=>['rep_name','client_name','call_date','meeting_title','show_name','show_format','show_type','call_number'].includes(k)));
const family=resolveCoachingOfferFamily({sourcePayload:metadata,transcriptText:state.caseItem?.cleaned_transcript||state.input?.cleaned_transcript||p.blocks.map(b=>b.text).join(' ')}).family;state.coaching_offer_family=family;
const system=${JSON.stringify(system)},policy=${JSON.stringify(policy)};
state.coaching_version=OBJECTION_VERSION;state.coaching_revision=OBJECTION_VERSION;state.coaching_model=${JSON.stringify(model)};
state.coaching_policy_revision=${JSON.stringify(POLICY_REVISION)};state.coaching_policy_hash=${JSON.stringify(policyHash)};state.coaching_policy_text=policy;
state.coaching_evidence_metadata=metadata;state.coaching_evidence_index=p.blocks.map(({id,timestamp})=>({id,timestamp}));
p.provider_request={...p.provider_request,...${JSON.stringify(MODELS[model])},request_id:p.provider_request.request_id+'-'+OBJECTION_VERSION,call_purpose:'objection_v2_writer',system,prompt:writerPrompt(metadata,p.blocks)};
return {json:p};`;}
function auditBuilder(original,manual,reviewer){const prepared=manual?`$('MM Manual Build Structured Coaching').item.json`:`$json.prepared`;
const generated=manual?'$json':'$json.generated';return embedded+'\n'+reviewerPrompt.toString()+`\nconst ep=${prepared};
if(enhancedPrepared(ep)){
 const generated=${generated};if(generated.request_id!==ep.provider_request.request_id)throw Error('Coaching source alignment failed');
 if(generated.ok===false||['length','max_tokens'].includes(generated.stop_reason))throw Error('Coaching draft remains invalid: provider incomplete');
 const analysis=${manual?'normalizeObjectionReport(generated.parsed_json)':'assertObjectionReport(normalizeObjectionReport(generated.parsed_json),ep.blocks)'};
 if(!analysis||typeof analysis!=='object')throw Error('Missing coaching draft');
 if(analysis.status==='refused'){assertObjectionReport(analysis,ep.blocks);${manual?`return {json:{...ep.state.input,state:ep.state,manual_parsed:renderObjectionReport(analysis,ep.blocks,'pending'),skip_safety:true}};`:`throw Error('Unexpected coaching exclusion at audit');`}}
 return {json:{...ep,generated,analysis,skip_safety:false,provider_request:{...ep.provider_request,...${JSON.stringify(MODELS[reviewer])},request_id:ep.provider_request.request_id+'-audit',call_purpose:'objection_v2_audit',prompt:reviewerPrompt(ep.state.coaching_evidence_metadata||{},ep.blocks,analysis)+(objectionErrors(analysis,ep.blocks).length?'\\nContract errors to correct: '+JSON.stringify(objectionErrors(analysis,ep.blocks)):'')}}};
}
${original}`;}
function renderAudit(original,manual,repaired){return embedded+`\nconst ep=$(${JSON.stringify(manual?'MM Manual Build Factual Audit':'Build Factual Audit')}).item.json;
if(enhancedPrepared(ep)){
 const report=acceptEnhancedAudit(ep,$json,ep.provider_request.request_id+${JSON.stringify(repaired?'-schema-repair':'')});
 ${manual?`const state=JSON.parse(JSON.stringify(ep.state));state.parsed_status='completed';state.coaching_raw={...state.coaching_raw,...report};state.reviewed_coaching_v2=report.reviewed_coaching_v2;delete state.coaching_raw.reviewed_coaching_v2;state.provider_results.push({purpose:'structured_coaching',result:ep.generated},{purpose:'coaching_factual_audit',result:$json});return {json:{...state.input,state}};`:`const sum=(a,b)=>Object.fromEntries([...new Set([...Object.keys(a||{}),...Object.keys(b||{})])].filter(k=>typeof a?.[k]==='number'||typeof b?.[k]==='number').map(k=>[k,Number(a?.[k]||0)+Number(b?.[k]||0)]));return {json:{...ep.generated,parsed_json:report,model_text:JSON.stringify(report),costs:sum(ep.generated.costs,$json.costs),usage:sum(ep.generated.usage,$json.usage),coaching_version:OBJECTION_VERSION,factual_audit:{review:$json.parsed_json,revision:OBJECTION_VERSION}}};`}
}
${original}`;}
function build(baselines,{writer='claude-sonnet-5-5',reviewer='claude-opus-5-5'}={}) {
 if(!MODELS[writer]||!MODELS[reviewer])throw Error('Unknown model');
 const patches={};
 const get=(id,name)=>{const n=baselines[id]?.nodes.find(n=>n.name===name);if(!n)throw Error('Missing baseline '+id+' '+name);return n;};
 const edit=(id,name,fn)=>{const n=get(id,name);const before=n.parameters.jsCode;const after=fn(before);if(!before||before===after)throw Error('No change '+name);if(/\bmodule\.exports\b/.test(after))throw Error('CommonJS export leaked into embedded node '+name);new (Object.getPrototypeOf(async function(){}).constructor)('$json','$',after);(patches[id]??=[]).push({type:'updateNode',nodeName:name,updates:{'parameters.jsCode':after}});};
 const official='L8Nn7xncA9ZPDdWA',manual='BMRrGxHyXMcgO6j3',audit='FShnTde2OGhIUZE4';
 edit(official,'MM Build Coaching Request',s=>wrapWriter(s,writer));edit(manual,'MM Manual Build Structured Coaching',s=>wrapWriter(s,writer));
 for(const name of ['Validate Draft','Validate Repaired Draft'])edit(audit,name,s=>embedded+`\nconst ep=$json.prepared?$json:$('Draft Repair Request').item.json;if(enhancedPrepared(ep.prepared))return {json:validateEnhancedDraft(ep,$json.prepared?ep.generated:$json,!$json.prepared)};\n`+s);
 edit(audit,'Draft Repair Request',s=>`if($json.prepared?.state?.coaching_version===${JSON.stringify(OBJECTION_VERSION)}){const p=$json,r=p.prepared.provider_request;return {json:{...p,provider_request:{...r,request_id:r.request_id+'-schema-repair',call_purpose:'objection_v2_repair',prompt:r.prompt+'\\nRepair the complete draft against the original call and policy. Do not invent evidence. Errors: '+JSON.stringify(p.errors)+'\\nUntrusted draft: '+JSON.stringify(p.analysis)}}};}\n`+s);
 edit(audit,'Build Factual Audit',s=>auditBuilder(s,false,reviewer));edit(manual,'MM Manual Build Factual Audit',s=>auditBuilder(s,true,reviewer));
 edit(audit,'Render Reviewed Report',s=>renderAudit(s,false,false));edit(audit,'Render Repaired Audit',s=>renderAudit(s,false,true));edit(manual,'MM Manual Render Audited Coaching',s=>renderAudit(s,true,false));
 edit(audit,'Audit Repair Request',s=>`const ep=$('Build Factual Audit').item.json;if(ep.state?.coaching_version===${JSON.stringify(OBJECTION_VERSION)})return {json:{provider_request:{...ep.provider_request,request_id:ep.provider_request.request_id+'-schema-repair',call_purpose:'objection_v2_audit_repair',prompt:ep.provider_request.prompt+'\\nPrevious audit failed validation. Recheck and return the complete pass/findings/corrected_report contract. Do not flip an adverse verdict just to pass. Error: '+JSON.stringify($json.error||$json.message)}}};\n`+s);
 edit(official,'MM Build Compliance Request',s=>replaceOnce(s,'state.reviewed_coaching_v1 = reviewedResult.reviewed_coaching_v1 || null;','state.reviewed_coaching_v1 = reviewedResult.reviewed_coaching_v1 || null;\nstate.reviewed_coaching_v2 = reviewedResult.reviewed_coaching_v2 || null;'));
 edit(official,'Performance Agent',s=>embedded+'\n'+replaceOnce(replaceOnce(s,'const output = buildScoredOutput(state, complete.coaching);',`const reviewed_coaching_v2=complete.coaching.reviewed_coaching_v2||null;\nif(state.coaching_version===OBJECTION_VERSION&&!reviewed_coaching_v2)throw Error('Enhanced coaching safety hold: missing reviewed report');\nconst output = buildScoredOutput(state, complete.coaching);`),'output, reviewed_coaching_v1, agent_version:','output, reviewed_coaching_v1, reviewed_coaching_v2, agent_version:'));
 edit(manual,'MM Manual Finalize Coaching',s=>embedded+'\n'+replaceOnce(s,'const final = { ...complete.coaching, reviewed_coaching_v1, status:',`const reviewed_coaching_v2=complete.coaching.reviewed_coaching_v2||null;\nif(state.coaching_version===OBJECTION_VERSION&&!reviewed_coaching_v2)throw Error('Enhanced coaching safety hold: missing reviewed report');\nconst final = { ...complete.coaching, reviewed_coaching_v1, reviewed_coaching_v2, status:`));
 const manualFinal=patches[manual].find(p=>p.nodeName==='MM Manual Finalize Coaching');
 manualFinal.updates['parameters.jsCode']=manualLocalSafetyRepairs.toString()+'\n'+replaceOnce(manualFinal.updates['parameters.jsCode'],'try { const parsed = providerParsed($json, "manual coaching safety repair"); repairs = parsed.repairs || []; state.provider_results.push({ purpose: "manual_coaching_safety_repair", result: $json }); } catch (error) { state.repair_error = error.message; }',`if(state.coaching_version===OBJECTION_VERSION && $json.state){repairs=manualLocalSafetyRepairs(state);}else{try { const parsed = providerParsed($json, "manual coaching safety repair"); repairs = parsed.repairs || []; state.provider_results.push({ purpose: "manual_coaching_safety_repair", result: $json }); } catch (error) { state.repair_error = error.message; }}`);
 // Existing safety stages operate on the reviewed structure, not duplicated flat
 // presentation or internal policy metadata. Repairs therefore reach every output.
 for(const [id,name] of [[official,'MM Build Safety Screen Request'],[manual,'MM Manual Build Safety Screen Request']])edit(id,name,s=>{
   let code=replaceOnce(s,'state.l1_hits = runL1(state.coaching_raw,',`if(state.coaching_version===${JSON.stringify(OBJECTION_VERSION)}){state.coaching_raw=enhancedSafetyView(state.reviewed_coaching_v2);}
state.l1_hits = runL1(state.coaching_raw,`);
   code=replaceOnce(code,'String(factCard).slice(0, 12000)',`(state.coaching_version===${JSON.stringify(OBJECTION_VERSION)}?state.coaching_policy_text:String(factCard).slice(0,12000))`);
   code=replaceOnce(code,'function buildDeepSeekPrompt(state, l1Hits) {','function buildDeepSeekPromptLegacy(state, l1Hits) {');
   code+=`\nfunction buildDeepSeekPrompt(state,l1Hits){const prefix=state.coaching_version===${JSON.stringify(OBJECTION_VERSION)}?'Enhanced structured coaching: distinguish the buyer concern and the historical rep response from advice endorsed by the report. Do not treat a quoted problematic rep statement as a recommendation. Use the current offer knowledge below for coaching applicability; compliance flags are separate evidence, not permission to import policy-only criticism. Preserve supported coaching. Return exact structured prose paths and sentences for genuine unsafe or unsupported advice.\\n':'';return prefix+buildDeepSeekPromptLegacy(state,l1Hits);}`;
   return embedded+'\n'+code;
 });
 for(const [id,name,buildName] of [[official,'MM Prepare Repair','MM Build Safety Screen Request'],[manual,'MM Manual Prepare Repair','MM Manual Build Safety Screen Request']])edit(id,name,s=>`const ep=$(${JSON.stringify(buildName)}).first().json;if(ep.state?.coaching_version===${JSON.stringify(OBJECTION_VERSION)}){const screen=$json.parsed_json;if($json.ok===false||$json.request_id!==ep.provider_request.request_id||typeof screen?.case_pass!=='boolean'||!['unsupported_specifics','collisions','additional_safety_hits'].every(k=>Array.isArray(screen[k])))throw Error('Enhanced coaching safety hold: invalid or mismatched safety screen');}
`+s);
 // Legacy sentence deduplication removes repeated structured labels across distinct objections.
 for(const id of [official,manual]){
   const op=patches[id].find(p=>p.nodeName===(id===official?'Performance Agent':'MM Manual Finalize Coaching'));
   op.updates['parameters.jsCode']=replaceOnce(op.updates['parameters.jsCode'],'const complete = applyCompletenessBackstop(coaching);',`const complete = state.coaching_version===OBJECTION_VERSION?{coaching:finishEnhancedSafety(state,coaching,${id===official?'sourceIdFromState(state)':'state.input?.public_id'}),rows:[]}:applyCompletenessBackstop(coaching);`);
   op.updates['parameters.jsCode']=replaceOnce(op.updates['parameters.jsCode'],'const scrubbed = dedupeRepeatedSentencesText(scrubSafetyLanguageText(before));','const scrubbed = state.coaching_version===OBJECTION_VERSION?scrubSafetyLanguageText(before):dedupeRepeatedSentencesText(scrubSafetyLanguageText(before));');
 }
 // Preserve exact reviewed content through every delivery surface.
 edit(manual,'Parse AI Output',s=>`let upgraded=false;try{upgraded=$('MM Manual Build Structured Coaching').item.json.state?.coaching_version===${JSON.stringify(OBJECTION_VERSION)};}catch{}\nif(upgraded&&$json.error)throw Error('Enhanced coaching safety hold: '+JSON.stringify($json.error));\n`+replaceOnce(s,'reviewed_coaching_v1: parsed.reviewed_coaching_v1 || null,','reviewed_coaching_v1: parsed.reviewed_coaching_v1 || null, reviewed_coaching_v2: parsed.reviewed_coaching_v2 || null, coaching_version: first.coaching_version || null,'));
 edit(manual,'Build Complete Callback',s=>replaceOnce(s,'reviewed_coaching_v1: report.reviewed_coaching_v1 || null,','reviewed_coaching_v1: report.reviewed_coaching_v1 || null, reviewed_coaching_v2: report.reviewed_coaching_v2 || null,'));
 for(const [id,name] of [[official,'Build PDF HTML'],[manual,'Build Google Doc']])edit(id,name,s=>{
   let code=replaceOnce(s,'function coachingSections(report){',`function coachingSections(report){\n if(report.reviewed_coaching_v2)return objectionSections(report.reviewed_coaching_v2);`);
   if(id===official)code=replaceOnce(code,"const report={reviewed_coaching_v1:","const report={reviewed_coaching_v2:$('Performance Agent').itemMatching(0).json.reviewed_coaching_v2||null,reviewed_coaching_v1:");
   code=replaceOnce(code,"text:'Call Coaching Report'","text:'Call Coaching Report — '+(report.reviewed_coaching_v2?'Enhanced':'Legacy')");
   return runtime+'\n'+code;
 });
 edit(official,'Code in JavaScript',s=>{
   let code=replaceOnce(s,"function coachingSections(report, { splitClosingLabels = true } = {}) {","function coachingSections(report, { splitClosingLabels = true } = {}) {\n if(report.reviewed_coaching_v2)return objectionSections(report.reviewed_coaching_v2);");
   code=replaceOnce(code,"const report={...output.airtable?.scorecard_record,","const report={reviewed_coaching_v2:$('Performance Agent').itemMatching(0).json.reviewed_coaching_v2||null,...output.airtable?.scorecard_record,");
   code=replaceOnce(code,"('Call coaching · '+rep)","('Call coaching · '+(report.reviewed_coaching_v2?'Enhanced':'Legacy')+' · '+rep)");
   return runtime+'\n'+code;
 });
 const durable='X9L4JtDbpkSCflxZ';
 edit(durable,'Validate Result',s=>runtime+'\n'+replaceOnce(s,'const contractErrors=coachingStage(s.call_purpose)?coachingContractErrors(r.parsed_json):[];','const contractErrors=objectionProviderStage(s.call_purpose)?objectionProviderErrors(s.call_purpose,r.parsed_json):coachingStage(s.call_purpose)?coachingContractErrors(r.parsed_json):[];'));
 edit(durable,'Restore Cached Result',s=>runtime+'\n'+`const ep=$('Validate Claim').first().json;if(objectionProviderStage(ep.call_purpose)){const errors=objectionProviderErrors(ep.call_purpose,ep.checkpoint.result?.parsed_json);if(errors.length)throw Error('Invalid cached objection coaching contract: '+errors.join('; '));}\n`+s);
 const cached=patches[durable].find(p=>p.nodeName==='Restore Cached Result');
 cached.updates['parameters.jsCode']=checkpointJsonOrder.toString()+'\n'+replaceOnce(cached.updates['parameters.jsCode'],'const s=$json;const r={...s.checkpoint.result};','const s=$json;const r={...s.checkpoint.result};if(objectionProviderStage(s.call_purpose))r.parsed_json=checkpointJsonOrder(r.parsed_json,r.model_text);');
 // Delivery adapters preserve the same reviewed object; no new model calls.
 const post=get(official,'Post to Dashboard');(patches[official]??=[]).push({type:'updateNode',nodeName:post.name,updates:{'parameters.body':replaceOnce(post.parameters.body,"reviewed_coaching_v1: $('Performance Agent').item.json.reviewed_coaching_v1 || null,","reviewed_coaching_v1: $('Performance Agent').item.json.reviewed_coaching_v1 || null, reviewed_coaching_v2: $('Performance Agent').item.json.reviewed_coaching_v2 || null,")}});
 for(const id of [official,manual])for(const op of patches[id]){
  if(['MM Build Safety Screen Request','MM Manual Build Safety Screen Request','MM Prepare Repair','MM Manual Prepare Repair'].includes(op.nodeName))
   op.updates['parameters.jsCode']=patchSafetyProse(op.updates['parameters.jsCode'],op.nodeName.includes('Prepare Repair'));
 }
 return patches;
}
module.exports={build,wrapWriter,auditBuilder,renderAudit,embedded};
if(require.main===module){const dir=process.argv[2];if(!dir)throw Error('Private baseline directory required');const baselines={};for(const file of fs.readdirSync(dir).filter(f=>f.endsWith('.json'))){try{const raw=JSON.parse(fs.readFileSync(path.join(dir,file),'utf8'));const w=raw.data||raw;if(w.id&&Array.isArray(w.nodes))baselines[w.id]={...(baselines[w.id]||{}),...w,nodes:[...new Map([...(baselines[w.id]?.nodes||[]),...w.nodes].map(n=>[n.name,n])).values()]};}catch{}}
 const patches=build(baselines);fs.writeFileSync(path.join(dir,'candidate-operations.json'),JSON.stringify(patches));console.log(Object.fromEntries(Object.entries(patches).map(([id,ops])=>[id,ops.map(o=>o.nodeName)])));}
