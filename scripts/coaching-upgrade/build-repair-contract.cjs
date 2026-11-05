// Offline builder. Only an exact, separately verified baseline may be published.
const fs=require('node:fs'),ts=require('typescript');
const contract=require('./repair-contract.cjs');
const runtime=require('../../src/lib/objection-coaching.cjs');
const stages=require('./stages.cjs');
function replaceFunction(code,name,replacement,required=true){
 const sf=ts.createSourceFile('node.js',code,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
 const found=sf.statements.filter(s=>ts.isFunctionDeclaration(s)&&s.name?.text===name);
 if(found.length!==1){if(!required&&!found.length)return code;throw Error('Function anchor drift: '+name);}
 const n=found[0];return code.slice(0,n.getStart(sf))+replacement+code.slice(n.end);
}
function once(code,before,after){if(code.split(before).length!==2)throw Error('Repair contract anchor drift: '+before.slice(0,80));return code.replace(before,after);}
function buildRepairContract(baselines){
 const result={};
 for(const [id,manual] of [['L8Nn7xncA9ZPDdWA',false],['BMRrGxHyXMcgO6j3',true],['FShnTde2OGhIUZE4',false],['X9L4JtDbpkSCflxZ',false]]){
  const w=structuredClone(baselines[id]);if(!w)throw Error('Missing baseline');
  const prepare=manual?'MM Manual Prepare Repair':'MM Prepare Repair';
  const screen=manual?'MM Manual Build Safety Screen Request':'MM Build Safety Screen Request';
  const final=manual?'MM Manual Finalize Coaching':'Performance Agent';
  for(const node of w.nodes){
   let code=node.parameters?.jsCode;if(typeof code!=='string')continue;
   // Keep all embedded copies consistent, including validation and cached output reads.
   for(const name of ['objectionErrors','normalizeObjectionReport','objectionProviderErrors'])code=replaceFunction(code,name,runtime[name].toString(),false);
   for(const name of ['validateEnhancedDraft','acceptEnhancedAudit','enhancedSafetyView'])code=replaceFunction(code,name,stages[name].toString(),false);
   if(node.name===screen){
    // Fix lexical boundaries. Contextual negation is adjudicated by the existing screen.
    code=once(code,'/\\bas trained|as required|per policy|per process|approved|compliant\\b/i','/\\b(?:as trained|as required|per policy|per process|approved|compliant)\\b/i');
    code=once(code,'/\\bcorrect(?:ly)?|proper(?:ly)?\\b/i','/\\b(?:correct(?:ly)?|proper(?:ly)?)\\b/i');
    const sf=ts.createSourceFile('node.js',code,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
    const f=sf.statements.find(s=>ts.isFunctionDeclaration(s)&&s.name?.text==='buildDeepSeekPrompt');
    if(!f)throw Error('Missing screen prompt');
    const old=f.getText(sf).replace('function buildDeepSeekPrompt(','function buildDeepSeekPromptBeforeRepairContract(');
    code=replaceFunction(code,'buildDeepSeekPrompt',old+'\n'+contract.safetyAdjudicationPrompt.toString()+`\nfunction buildDeepSeekPrompt(state,hits){return buildDeepSeekPromptBeforeRepairContract(state,hits)+(state.coaching_version==='magic-mike-objection-coaching-2026-10-29'?safetyAdjudicationPrompt():'');}`);
   }
   if(node.name===prepare){
    code=Object.values(contract).map(f=>f.toString()).join('\n')+'\n'+code;
    code=replaceFunction(code,'mapScreenItemToTarget',`function mapScreenItemToTarget(caseId,coaching,item,prefix,index){return coaching?.version==='objection-coaching-v2'?safetyFindingTargets(caseId,coaching,item,prefix,index):mapScreenItemToTargetLegacy(caseId,coaching,item,prefix,index);}`);
    code=replaceFunction(code,'buildRepairPrompt',`function buildRepairPrompt(state,targets){return state.coaching_raw?.version==='objection-coaching-v2'?safetyRepairPrompt(state,targets):buildRepairPromptLegacy(state,targets);}`);
    const targetAst=ts.createSourceFile('node.js',code,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
    const targetOld=targetAst.statements.find(s=>ts.isFunctionDeclaration(s)&&s.name?.text==='dedupeTargets').getText(targetAst).replace('function dedupeTargets(','function dedupeTargetsLegacy(');
    code=replaceFunction(code,'dedupeTargets',targetOld+`\nfunction dedupeTargets(targets){return state.coaching_raw?.version==='objection-coaching-v2'?targets:dedupeTargetsLegacy(targets);}`);
    code=once(code,'const targets = dedupeTargets([','let targets = dedupeTargets([');
    const l1=manual?'...(Array.isArray(state.l1_hits) ? state.l1_hits : []),':'...(state.l1_hits || []),';
    code=once(code,l1,"...(state.coaching_raw?.version==='objection-coaching-v2'?safetyL1Decisions(state.l1_hits||[],screen):(state.l1_hits||[])),");
    code=once(code,'state.repair_targets = targets;',`if(state.coaching_raw?.version==='objection-coaching-v2'){
 if(screen.case_pass===true&&targets.length)throw Error('Enhanced coaching safety hold: conflicting screen verdict');
 if(screen.case_pass===false&&!targets.length)throw Error('Enhanced coaching safety hold: unexplained screen rejection');
 targets=safetyFieldTargets(state.coaching_raw,targets);
}
state.repair_targets = targets;`);
    // Save the exact request ID in paired state, not just the provider wrapper.
    const purpose=manual?'manual_coaching_safety_repair':'coaching_safety_repair';
    const expr=`providerBody(CUTOVER.repair, "Return JSON only.", buildRepairPrompt(state, targets), state, "${purpose}")`;
    code=once(code,'return { json: { '+(manual?'...state.input, ':'')+'state, repair_target_count: targets.length, provider_request: '+expr+' } };',
     `const repairRequest=${expr};if(state.coaching_raw?.version==='objection-coaching-v2'&&targets.length){if(repairRequest.provider!=='anthropic')throw Error('Structured repair provider required');repairRequest.output_config={...(repairRequest.output_config||{}),format:safetyRepairFormat(targets)};repairRequest.request_id=repairRequest.request_id+'-atomic-'+safetyDigest(JSON.stringify([repairRequest.prompt,repairRequest.output_config]));}state.safety_repair_request_id=repairRequest.request_id;\nreturn {json:{${manual?'...state.input,':''}state,repair_target_count:targets.length,provider_request:repairRequest}};`);
   }
   if(node.name===final){
    code=Object.values(contract).map(f=>f.toString()).join('\n')+'\n'+code;
    const sf=ts.createSourceFile('node.js',code,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
    const old=sf.statements.find(s=>ts.isFunctionDeclaration(s)&&s.name?.text==='applyRepairs').getText(sf).replace('function applyRepairs(','function applyRepairsLegacy(');
    code=replaceFunction(code,'applyRepairs',old+`\nfunction applyRepairs(coaching,targets,repairs){return coaching?.version==='objection-coaching-v2'?applySafetyFieldRepairs(coaching,targets,repairs):applyRepairsLegacy(coaching,targets,repairs);}`);
    code=once(code,'  let repairs = [];',`  let repairs = [];
  if(state.coaching_version===OBJECTION_VERSION && ($json.ok===false||!state.safety_repair_request_id||$json.request_id!==state.safety_repair_request_id))throw Error('Enhanced coaching safety hold: invalid or mismatched repair response');`);
    if(manual)code=once(code,'if(state.coaching_version===OBJECTION_VERSION && $json.state){repairs=manualLocalSafetyRepairs(state);}else{try', 'if($json.state){throw Error("Repair provider response required");}else{try');
    code=once(code,'const applied = repairs.length ? applyRepairs(coaching, state.repair_targets, repairs) : deterministicDeleteTargets(coaching, state.repair_targets);',"const applied = state.coaching_version===OBJECTION_VERSION||repairs.length ? applyRepairs(coaching, state.repair_targets, repairs) : deterministicDeleteTargets(coaching, state.repair_targets);");
   }
   new (Object.getPrototypeOf(async function(){}).constructor)('$json','$',code);
   node.parameters.jsCode=code;
  }
  if(manual){
   // Reuse the unreachable audit-confirmation provider: no increase in node count.
   const spare='MM Manual Audit Confirmation Provider',unused='MM Manual Build Audit Confirmation',name='MM Manual Repair Provider';
   const incoming=n=>Object.entries(w.connections).filter(([,v])=>JSON.stringify(v).includes('"node":"'+n+'"'));
   if(incoming(unused).length||incoming(spare).some(([from])=>from!==unused))throw Error('Confirmation branch is reachable; cannot repurpose');
   const node=w.nodes.find(n=>n.name===spare),template=baselines.L8Nn7xncA9ZPDdWA.nodes.find(n=>n.name==='MM Repair Provider');
   if(!node||!template)throw Error('Missing durable repair provider');
   Object.assign(node,{name,type:template.type,typeVersion:template.typeVersion,parameters:structuredClone(template.parameters),onError:'continueErrorOutput',retryOnFail:false});
   delete w.connections[unused];delete w.connections[spare];
   // Native authenticated subworkflow recovery uses the same input validation and
   // failure handler. It avoids same-instance webhook calls or cloned delivery.
   const recovery=w.nodes.find(n=>n.name===unused);
   if(!recovery)throw Error('Missing dormant recovery slot');
   Object.assign(recovery,{name:'MM Manual Recovery Entry',type:'n8n-nodes-base.executeWorkflowTrigger',typeVersion:1.1,parameters:{inputSource:'passthrough'}});
   w.connections[recovery.name]={main:[[{node:'Normalize Input',type:'main',index:0}]]};
   w.connections['MM Manual If Repair Needed'].main[0]=[{node:name,type:'main',index:0}];
   w.connections[name]={main:[[{node:final,type:'main',index:0}],[{node:final,type:'main',index:0}]]};
  }
  if(w.nodes.length!==baselines[id].nodes.length)throw Error('Node count changed');
  result[id]=w;
 }
 return result;
}
module.exports={replaceFunction,buildRepairContract};
if(require.main===module)fs.writeFileSync(process.argv[3],JSON.stringify(buildRepairContract(JSON.parse(fs.readFileSync(process.argv[2])))));
