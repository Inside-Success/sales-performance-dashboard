// Additive offline patch builder. It never activates a workflow or creates credentials.
const {openAiUsage}=require('../coaching-lab/usage.cjs');
function normalizeOpenAi(body,now=new Date().toISOString()){
 for(const k of ['request_id','case_id','call_purpose','model','system','prompt'])if(typeof body[k]!=='string'||!body[k].trim())throw Error('Missing OpenAI '+k);
 if(body.provider!=='openai'||!Number.isInteger(body.max_tokens)||body.max_tokens<1)throw Error('Invalid OpenAI configuration');
 for(const k of ['input_mtok','cache_read_mtok','cache_write_mtok','output_mtok'])if(!Number.isFinite(body.pricing?.[k])||body.pricing[k]<0)throw Error('Missing usage price');
 const request_body={model:body.model,messages:[{role:'system',content:body.system},{role:'user',content:body.prompt}],max_completion_tokens:body.max_tokens,reasoning_effort:body.reasoning_effort||'high',response_format:{type:'json_object'}};
 return {ok:true,provider:'openai',request_id:body.request_id,result_id:body.result_id||body.request_id,case_id:body.case_id,call_purpose:body.call_purpose,model:body.model,pricing:body.pricing,started_at:now,request_body_json:JSON.stringify(request_body)};
}
function decodeOpenAi(raw,request,finished=new Date().toISOString()){
 const base={request_id:request.request_id,result_id:request.result_id,case_id:request.case_id,call_purpose:request.call_purpose,provider:'openai',model:raw.model||request.model,started_at:request.started_at,finished_at:finished,latency_ms:Math.max(0,Date.parse(finished)-Date.parse(request.started_at))};
 if(raw.error||!raw.id)return {...base,ok:false,parsed_json:null,parse_error:'Provider response unavailable',stop_reason:'error'};
 let parsed_json=null,parse_error=null;const choice=raw.choices?.[0];try{parsed_json=JSON.parse(choice?.message?.content||'');if(!parsed_json||typeof parsed_json!=='object'||Array.isArray(parsed_json))throw Error('Object required');}catch{parse_error='Invalid JSON object';}
 let accounting;try{accounting=openAiUsage(raw,request.pricing);}catch{return {...base,ok:false,parsed_json:null,parse_error:'Missing or invalid usage receipt',stop_reason:choice?.finish_reason,provider_response_id:raw.id};}
 return {...base,...accounting,ok:!parse_error&&!choice?.message?.refusal,provider_response_id:raw.id,parsed_json,parse_error,stop_reason:choice?.message?.refusal?'refusal':choice?.finish_reason,model_text:choice?.message?.content||''};
}
function patchProvider(baseline,credential){
 if(!credential?.id||!credential?.name)throw Error('Explicit authorized credential reference required');
 const w=structuredClone(baseline),names=new Set(w.nodes.map(n=>n.name));
 for(const name of ['Normalize Provider Request','If Anthropic','DeepSeek HTTP','Validate Claim','Validate Result','Restore Cached Result'])if(!names.has(name))throw Error('Unsupported baseline: '+name);
 if(names.has('OpenAI HTTP'))throw Error('OpenAI already installed; inspect instead of replay');
 const normal=w.nodes.find(n=>n.name==='Normalize Provider Request');
 normal.parameters.jsCode=`const candidate=$input.first().json.body||$input.first().json;\nif(candidate.provider==='openai'){const normalizeOpenAi=${normalizeOpenAi.toString()};return [{json:normalizeOpenAi(candidate)}];}\n`+normal.parameters.jsCode;
 const gate=structuredClone(w.nodes.find(n=>n.name==='If Anthropic'));gate.id='foundations-openai-gate';gate.name='If OpenAI';gate.parameters.conditions.conditions[0].leftValue="={{ $json.provider === 'openai' }}";
 const http={id:'foundations-openai-http',name:'OpenAI HTTP',type:'n8n-nodes-base.httpRequest',typeVersion:4.4,position:[1600,400],retryOnFail:false,maxTries:1,continueOnFail:true,parameters:{method:'POST',url:'https://api.openai.com/v1/chat/completions',authentication:'genericCredentialType',genericAuthType:'httpHeaderAuth',sendBody:true,contentType:'raw',rawContentType:'application/json',body:'={{ $json.request_body_json }}',options:{timeout:300000}},credentials:{httpHeaderAuth:credential}};
 const decoder={id:'foundations-openai-decode',name:'Decode OpenAI',type:'n8n-nodes-base.code',typeVersion:2,position:[1800,400],parameters:{jsCode:`const openAiUsage=${openAiUsage.toString()};const decodeOpenAi=${decodeOpenAi.toString()};return [{json:decodeOpenAi($json,$('Validate Claim').first().json)}];`}};
 const old=w.connections['If Anthropic']?.main?.[1];if(old?.length!==1||old[0].node!=='DeepSeek HTTP')throw Error('Unexpected provider routing');
 w.nodes.push(gate,http,decoder);const edge=node=>({node,type:'main',index:0});w.connections['If Anthropic'].main[1]=[edge('If OpenAI')];w.connections['If OpenAI']={main:[[edge('OpenAI HTTP')],old]};w.connections['OpenAI HTTP']={main:[[edge('Decode OpenAI')]]};w.connections['Decode OpenAI']={main:[[edge('Validate Result')]]};
 const validator=w.nodes.find(n=>n.name==='Validate Result');const before=validator.parameters.jsCode;validator.parameters.jsCode=before.replace("['Anthropic HTTP','DeepSeek HTTP']","['Anthropic HTTP','DeepSeek HTTP','OpenAI HTTP']");if(before===validator.parameters.jsCode)throw Error('Unsupported provider error boundary');
 return w;
}
module.exports={normalizeOpenAi,decodeOpenAi,patchProvider};
