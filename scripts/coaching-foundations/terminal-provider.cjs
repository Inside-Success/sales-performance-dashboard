const {repairableSafetyReceipt}=require('../../src/lib/foundations-terminal-receipt.cjs');
function patchTerminalProvider(baseline){
 const w=structuredClone(baseline);
 function edit(name,from,to){const n=w.nodes.find(n=>n.name===name);if(!n||n.parameters.jsCode.split(from).length!==2)throw Error('Terminal receipt anchor drift: '+name);n.parameters.jsCode=n.parameters.jsCode.replace(from,to);}
 edit('Validate Claim',"['acquired','cached']","['acquired','cached','repair_required']");
 const gate=w.nodes.find(n=>n.name==='Cached Result?');
 if(gate.parameters.conditions.conditions[0].leftValue!=="={{ $json.checkpoint.status === 'cached' }}")throw Error('Checkpoint route drift');
 gate.parameters.conditions.conditions[0].leftValue="={{ ['cached','repair_required'].includes($json.checkpoint.status) }}";
 const restore=w.nodes.find(n=>n.name==='Restore Cached Result');
 restore.parameters.jsCode=`const repairableSafetyReceipt=${repairableSafetyReceipt.toString()};\nconst terminal=$('Validate Claim').first().json;\nif(terminal.checkpoint.status==='repair_required'){if(!repairableSafetyReceipt(terminal.call_purpose,terminal.checkpoint.result))throw Error('Invalid terminal receipt');return [{json:terminal.checkpoint.result}];}\n`+restore.parameters.jsCode;
 edit('Validate Result','valid:Boolean(valid)','valid:Boolean(valid || repairableSafetyReceipt(s.call_purpose,r))');
 const validation=w.nodes.find(n=>n.name==='Validate Result');validation.parameters.jsCode=`const repairableSafetyReceipt=${repairableSafetyReceipt.toString()};\n`+validation.parameters.jsCode;
 return w;
}
module.exports={patchTerminalProvider};
