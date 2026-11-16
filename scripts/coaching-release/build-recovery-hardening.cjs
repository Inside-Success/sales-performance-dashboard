const esbuild=require('esbuild');
async function build(core,provider){
 const c=structuredClone(core),p=structuredClone(provider);
 const bundle=(await esbuild.build({stdin:{contents:"module.exports=require('./scripts/coaching-foundations/transition.cjs')",resolveDir:process.cwd()},bundle:true,write:false,format:'iife',globalName:'MM_FOUNDATIONS',platform:'browser',target:'es2022'})).outputFiles[0].text;
 for(const name of ['Start','Advance']){
  const n=c.nodes.find(n=>n.name===name);if(!n)throw Error('Missing core node');
  const at=n.parameters.jsCode.indexOf('function envelope(t)');if(at<0)throw Error('Unknown core wrapper');
  let tail=n.parameters.jsCode.slice(at);
  if(name==='Advance')tail=tail.replace("const before=$('Request Needed').itemMatching(0).json.transition;return [{json:envelope(MM_FOUNDATIONS.advance(before,$json))}];","const before=$('Request Needed').itemMatching(0).json.transition;let next;try{next=MM_FOUNDATIONS.advance(before,$json);}catch(e){next={...before,status:'held',last_error:{message:e.message,issues:e.issues||[],stage:before.request?.stage,request_id:before.request?.request_id},last_response:$json};}return [{json:envelope(next)}];");
  n.parameters.jsCode='const structuredClone=value=>JSON.parse(JSON.stringify(value));\n'+bundle+'\n'+tail;
 }
 const claim=p.nodes.find(n=>n.name==='Claim Checkpoint');if(!claim)throw Error('Missing checkpoint claim');
 claim.parameters.body="={{ JSON.stringify({action:'claim',source_id:$json.case_id || $json.request_id,stage:$json.call_purpose,provider:$json.provider,request_hash:$json.request_hash,max_cost:0.02+1.25*((String($json.request_body_json||'').length*3+4096)*Math.max($json.pricing.input_mtok||0,$json.pricing.cache_write_mtok||0,$json.pricing.cache_read_mtok||0)/1000000+Math.max(JSON.parse($json.request_body_json).max_tokens||0,JSON.parse($json.request_body_json).max_completion_tokens||0)*($json.pricing.output_mtok||0)/1000000)}) }}";
 const added=[
 {id:'mm-progress-envelope',name:'Progress Envelope',type:'n8n-nodes-base.code',typeVersion:2,position:[600,350],parameters:{jsCode:'return $input.all();'}},
 {...structuredClone(claim),id:'mm-save-progress',name:'Save Progress',position:[800,350],parameters:{...claim.parameters,url:'https://sales-performance-dashboard-rose.vercel.app/api/internal/coaching-progress',body:'={{ JSON.stringify({execution_id:String($execution.id),state:$json.transition}) }}'}},
 {id:'mm-restore-progress',name:'Restore Progress',type:'n8n-nodes-base.code',typeVersion:2,position:[1000,350],parameters:{jsCode:"if($json.ok!==true)throw Error('Progress receipt missing');const item=$('Progress Envelope').itemMatching(0).json;if($json.source_id!==item.transition.prepared.sourceId)throw Error('Progress identity mismatch');return [{json:item}];"}}
 ];
 for(const n of added)if(c.nodes.some(x=>x.id===n.id||x.name===n.name))throw Error('Already installed');
 c.nodes.push(...added);
 for(const n of ['Start','Advance']){if(c.connections[n]?.main?.[0]?.length!==1||c.connections[n].main[0][0].node!=='Request Needed')throw Error('Unexpected core wiring');c.connections[n].main[0][0].node='Progress Envelope';}
 for(const [from,to] of [['Progress Envelope','Save Progress'],['Save Progress','Restore Progress'],['Restore Progress','Request Needed']])c.connections[from]={main:[[{node:to,type:'main',index:0}]]};
 return {core:c,provider:p};
}
module.exports={build};
if(require.main===module)(async()=>{const fs=require('fs'),dir=process.argv[2];const out=await build(JSON.parse(fs.readFileSync(dir+'/core-before.json')),JSON.parse(fs.readFileSync(dir+'/provider-before.json')));for(const [k,v]of Object.entries(out))fs.writeFileSync(dir+'/'+k+'-target.json',JSON.stringify(v),{mode:384});})();
