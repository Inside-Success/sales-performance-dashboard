import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
export function buildRecoveryLookupSafety(workflow) {
  const lib=fs.readFileSync(new URL('./crash-recovery.mjs',import.meta.url),'utf8').replaceAll('export ','');
  const node=name=>workflow.nodes.find(n=>n.name===name);
  for(const name of ['Select Stale Processing Claim','Read Claim Execution','Confirm Terminal Stale Claim','Hold Crashed Recovery Claim','Close Unfinished Attempt']) if(!node(name))throw Error('Missing node: '+name);
  const closeFilters=structuredClone(node('Close Unfinished Attempt').parameters.filters);
  closeFilters.conditions.push({keyName:'execution_id',condition:'eq',keyValue:'={{ String($execution.id) }}'});
  return [
    {type:'updateNode',nodeName:'Select Stale Processing Claim',updates:{'parameters.jsCode':lib+"\nconst items=$input.all();return staleClaims(items.map(x=>x.json)).map(row=>({json:row,pairedItem:{item:items.findIndex(x=>x.json.id===row.id)}}));"}},
    {type:'updateNode',nodeName:'Read Claim Execution',updates:{'parameters.options':{...node('Read Claim Execution').parameters.options,response:{response:{fullResponse:true,neverError:true,responseFormat:'json'}}}}},
    {type:'updateNode',nodeName:'Confirm Terminal Stale Claim',updates:{'parameters.jsCode':lib+"\nreturn $input.all().flatMap((item,i)=>{const row=$('Select Stale Processing Claim').itemMatching(i).json;const held=inspectClaimResponse(row,item.json);return held?[{json:held,pairedItem:{item:i}}]:[];});"}},
    {type:'updateNode',nodeName:'Hold Crashed Recovery Claim',updates:{'parameters.columns.value.message':'={{ $json.hold_reason }}'}},
    {type:'updateNode',nodeName:'Close Unfinished Attempt',updates:{'parameters.filters':closeFilters}},
  ];
}
if(process.argv[1]===fileURLToPath(import.meta.url))fs.writeFileSync(process.argv[3],JSON.stringify(buildRecoveryLookupSafety(JSON.parse(fs.readFileSync(process.argv[2]))),null,2));
