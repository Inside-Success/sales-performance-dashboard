// Explicitly isolated builder: never chooses a production workflow or delivery destination.
const esbuild=require('esbuild'),path=require('node:path');
function bundle(){return 'const structuredClone=value=>JSON.parse(JSON.stringify(value));\n'+esbuild.buildSync({stdin:{contents:"module.exports=require('./scripts/coaching-foundations/transition.cjs')",resolveDir:path.resolve(__dirname,'../..')},bundle:true,write:false,format:'iife',globalName:'MM_FOUNDATIONS',platform:'node',target:'es2022'}).outputFiles[0].text;}
function build({providerWorkflowId,models}){
 if(!providerWorkflowId||['X9L4JtDbpkSCflxZ','L8Nn7xncA9ZPDdWA','BMRrGxHyXMcgO6j3'].includes(providerWorkflowId))throw Error('Explicit isolated provider workflow required');
 const code=bundle(),node=(name,type,parameters,x,y=0)=>({id:'foundations-'+name.toLowerCase().replace(/ /g,'-'),name,type:'n8n-nodes-base.'+type,typeVersion:type==='code'?2:type==='executeWorkflow'?1.3:type==='if'?2.2:1.1,position:[x,y],parameters});
 const envelope=`function envelope(t){if(t.status==='request'){const cfg=${JSON.stringify(models)}[t.request.model];if(!cfg)throw Error('Unconfigured provider');return {transition:t,provider_request:{...cfg,...t.request,model:cfg.model,call_purpose:'foundations_'+t.request.stage.replace(/-/g,'_')+'_v3'}};}return {transition:t};}`;
 const nodes=[
 node('Input','executeWorkflowTrigger',{workflowInputs:{values:[{name:'body',type:'object'}]}},0),
 node('Start','code',{jsCode:code+'\n'+envelope+"\nreturn [{json:envelope(MM_FOUNDATIONS.start($json.body))}];"},250),
 node('Request Needed','if',{conditions:{options:{caseSensitive:true,leftValue:'',typeValidation:'strict',version:2},conditions:[{id:'request',leftValue:'={{ $json.transition.status }}',rightValue:'request',operator:{type:'string',operation:'equals'}}],combinator:'and'},options:{}},500),
 node('Provider','executeWorkflow',{workflowId:{__rl:true,value:providerWorkflowId,mode:'id'},workflowInputs:{mappingMode:'defineBelow',value:{body:'={{ $json.provider_request }}'},matchingColumns:[],schema:[],attemptToConvertTypes:false,convertFieldsToString:false},options:{waitForSubWorkflow:true}},750),
 node('Advance','code',{jsCode:code+'\n'+envelope+"\nconst before=$('Request Needed').itemMatching(0).json.transition;return [{json:envelope(MM_FOUNDATIONS.advance(before,$json))}];"},1000),
 node('Return Report','code',{jsCode:"const t=$json.transition;if(!['completed','excluded'].includes(t.status))throw Error('Non-terminal coaching result');return [{json:{status:t.status,source_id:t.prepared.sourceId,channel:t.channel,payload:t.payload||null,candidate:t.candidate,provider_results:t.provider_results}}];"},750,250)
 ];
 const edge=node=>({node,type:'main',index:0});
 return {name:'ISOLATED Magic Mike foundations integration',nodes,connections:{Input:{main:[[edge('Start')]]},Start:{main:[[edge('Request Needed')]]},'Request Needed':{main:[[edge('Provider')],[edge('Return Report')]]},Provider:{main:[[edge('Advance')]]},Advance:{main:[[edge('Request Needed')]]}},settings:{executionOrder:'v1',saveDataErrorExecution:'all',saveDataSuccessExecution:'none',saveManualExecutions:true}};
}
module.exports={build,bundle};
