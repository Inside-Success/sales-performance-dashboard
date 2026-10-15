// Build the internal provider from the published normalizer/decoders and credential
// references. Never export prompts, transcripts or credential values into Git.
export const REVISION = "durable-provider-2026-10-15";
export const CLASSIFIER_FORMAT = { type: "json_schema", schema: {
  type: "object", additionalProperties: false,
  properties: {
    call_status: {type:"string",enum:["scored","rep_no_show","prospect_no_show","transcript_too_short"]},
    classification_reason:{type:"string"},evidence_quote:{type:"string"},
    confidence:{type:"string",enum:["high","medium","low"]},
  }, required:["call_status","classification_reason","evidence_quote","confidence"],
}};

export function internalCall(workflowId) {
  return { source:"database",workflowId:{__rl:true,mode:"id",value:workflowId},mode:"each",
    workflowInputs:{mappingMode:"defineBelow",value:{body:"={{ $json.provider_request }}"},matchingColumns:[],
      schema:[{id:"body",displayName:"body",required:false,display:true,type:"object",canBeUsedToMatch:true}],
      attemptToConvertTypes:false,convertFieldsToString:false},options:{waitForSubWorkflow:true}};
}

export function buildProvider(template) {
  const copy=name=>structuredClone(template.nodes.find(n=>n.name===name));
  const code=(name,jsCode,x,y)=>({id:name.toLowerCase().replace(/[^a-z0-9]+/g,"-"),name,type:"n8n-nodes-base.code",typeVersion:2,position:[x,y],parameters:{jsCode}});
  const checkpoint=(name,body,x,y)=>({id:name.toLowerCase().replace(/ /g,"-"),name,type:"n8n-nodes-base.httpRequest",typeVersion:4.4,position:[x,y],parameters:{
    method:"POST",url:"https://sales-performance-dashboard-rose.vercel.app/api/internal/provider-checkpoints",
    authentication:"genericCredentialType",genericAuthType:"httpHeaderAuth",sendBody:true,contentType:"raw",rawContentType:"application/json",body,
    options:{timeout:30000}},credentials:{httpHeaderAuth:{id:"E3CMQbjt6fZ5gPXw",name:"Sales Performance Dashboard Ingest"}},retryOnFail:true,maxTries:2,waitBetweenTries:1500});
  const iff=(name,expression,x,y)=>({id:name.toLowerCase().replace(/ /g,"-"),name,type:"n8n-nodes-base.if",typeVersion:2.2,position:[x,y],parameters:{conditions:{options:{version:2,caseSensitive:true,leftValue:"",typeValidation:"strict"},conditions:[{id:name,leftValue:expression,rightValue:true,operator:{type:"boolean",operation:"equals"}}],combinator:"and"},options:{}}});
  const normalize=copy("Normalize Provider Request");
  normalize.parameters.jsCode=normalize.parameters.jsCode.replace(/if\(\$input\.first\(\)\.json\.body\?\.provider!==.*?\n/,"");
  normalize.parameters.jsCode=normalize.parameters.jsCode.replace("if (requestedEffort) {", "if (requestedOutputConfig?.format) requestBody.output_config = { format: requestedOutputConfig.format };\n  if (requestedEffort) {");
  normalize.parameters.jsCode += '\n';
  const nodes=[{id:"internal-request",name:"Internal Coaching Request",type:"n8n-nodes-base.executeWorkflowTrigger",typeVersion:1.1,position:[0,0],parameters:{workflowInputs:{values:[{name:"body",type:"object"}]}}},normalize,
    {id:"request-hash",name:"Hash Request",type:"n8n-nodes-base.crypto",typeVersion:2,position:[480,0],parameters:{action:"hash",type:"SHA256",binaryData:false,value:"={{ $json.request_body_json }}",dataPropertyName:"request_hash",encoding:"hex"}},
    checkpoint("Claim Checkpoint","={{ JSON.stringify({action:'claim',source_id:$json.case_id || $json.request_id,stage:$json.call_purpose,provider:$json.provider,request_hash:$json.request_hash}) }}",700,0),
    code("Validate Claim",`const s=$('Hash Request').first().json;const c=$json;
if(!s.ok)throw Error('Invalid provider input');
if(!['acquired','cached'].includes(c.status))throw Error('Provider checkpoint deferred; retry after '+String(c.retry_at||'lease expiry'));
return [{json:{...s,checkpoint:c}}];`,900,0),
    iff("Cached Result?","={{ $json.checkpoint.status === 'cached' }}",1100,0),
    code("Restore Cached Result",`const s=$json;const r=s.checkpoint.result;
if(!r || r.ok!==true || r.parse_error || !r.parsed_json)throw Error('Invalid cached provider result');
return [{json:{...r,request_id:s.request_id,result_id:s.result_id,case_id:s.case_id,call_purpose:s.call_purpose,started_at:s.started_at,finished_at:new Date().toISOString(),latency_ms:0,checkpoint_reused:true,checkpoint_original_costs:r.costs,checkpoint_original_usage:r.usage,usage:Object.fromEntries(Object.entries(r.usage||{}).map(([k,v])=>[k,typeof v==='number'?0:v])),costs:{input_cost_usd:0,cache_write_cost_usd:0,cache_read_cost_usd:0,output_cost_usd:0,total_cost_usd:0}}}];`,1320,-220),
    iff("If Anthropic","={{ $json.provider === 'anthropic' }}",1320,100)];
  for(const provider of ["Anthropic","DeepSeek"]) {
    const http=copy(provider+" HTTP");http.retryOnFail=false;http.maxTries=1;http.continueOnFail=true;delete http.onError;
    http.parameters.options={...http.parameters.options,timeout:provider==="Anthropic"?300000:180000};nodes.push(http);
    nodes.push(copy("Decode "+provider));
  }
  nodes.push(code("Validate Result",`const s=$('Validate Claim').first().json;const r=$json;
let valid=r.ok===true && !r.parse_error && r.parsed_json && typeof r.parsed_json==='object' && !Array.isArray(r.parsed_json) && !['max_tokens','length','refusal'].includes(r.stop_reason);
if(s.call_purpose==='classifier') { const p=r.parsed_json; valid=valid && ['scored','rep_no_show','prospect_no_show','transcript_too_short'].includes(p?.call_status) && ['high','medium','low'].includes(p?.confidence) && ['classification_reason','evidence_quote'].every(k=>typeof p?.[k]==='string'); }
const providerError=(()=>{for(const name of ['Anthropic HTTP','DeepSeek HTTP']) {try {if($(name).isExecuted){const e=$(name).first().json.error;if(e)return typeof e==='string'?e:JSON.stringify(e);}}catch{}}return ''})();
return [{json:{source_id:s.case_id||s.request_id,stage:s.call_purpose,provider:s.provider,request_hash:s.request_hash,token:s.checkpoint.token,result:r,valid:Boolean(valid),error:(providerError || r.parse_error || ('Invalid structured provider result: '+String(r.stop_reason||''))).slice(0,1500)}}];`,2000,0),
    iff("Valid Result?","={{ $json.valid }}",2220,0),
    checkpoint("Complete Checkpoint","={{ JSON.stringify({action:'complete',source_id:$json.source_id,stage:$json.stage,provider:$json.provider,request_hash:$json.request_hash,token:$json.token,result:Object.fromEntries(Object.entries($json.result).filter(([key])=>key!=='raw_response'))}) }}",2440,-100),
    code("Return Provider Result","return [{json:$('Validate Result').first().json.result}];",2660,-100),
    checkpoint("Fail Checkpoint","={{ JSON.stringify({action:'fail',source_id:$json.source_id,stage:$json.stage,provider:$json.provider,request_hash:$json.request_hash,token:$json.token,error:$json.error}) }}",2440,160),
    {id:"provider-failure",name:"Provider Failure",type:"n8n-nodes-base.stopAndError",typeVersion:1,position:[2660,160],parameters:{errorType:"errorMessage",errorMessage:"={{ $('Validate Result').first().json.stage + ': ' + $('Validate Result').first().json.error }}"}});
  const connections={};
  function link(from,to,output=0){const main=(connections[from]??={main:[]}).main;while(main.length<=output)main.push([]);main[output].push({node:to,type:"main",index:0});}
  link("Internal Coaching Request","Normalize Provider Request");link("Normalize Provider Request","Hash Request");link("Hash Request","Claim Checkpoint");link("Claim Checkpoint","Validate Claim");link("Validate Claim","Cached Result?");
  link("Cached Result?","Restore Cached Result");link("Cached Result?","If Anthropic",1);
  link("If Anthropic","Anthropic HTTP");link("If Anthropic","DeepSeek HTTP",1);
  for(const p of ["Anthropic","DeepSeek"]){link(p+" HTTP","Decode "+p);link("Decode "+p,"Validate Result");}
  link("Validate Result","Valid Result?");link("Valid Result?","Complete Checkpoint");link("Valid Result?","Fail Checkpoint",1);link("Complete Checkpoint","Return Provider Result");link("Fail Checkpoint","Provider Failure");
  return {name:"Magic Mike Durable Internal Provider — 2026-10-15",nodes,connections,settings:{executionOrder:"v1",executionTimeout:420,saveDataSuccessExecution:"all",saveDataErrorExecution:"all",saveExecutionProgress:true}};
}
