import assert from "node:assert/strict";
import {buildProvider, CLASSIFIER_FORMAT, internalCall} from "./durable-provider.mjs";
const template={nodes:[{name:"Normalize Provider Request",parameters:{jsCode:"const requestedEffort='';if (requestedEffort) {}"}},...["Anthropic","DeepSeek"].flatMap(p=>[
  {name:p+" HTTP",parameters:{options:{timeout:600000}},retryOnFail:true},
  {name:"Decode "+p,parameters:{jsCode:"return [];"}},
])]};
const graph=buildProvider(template);
const names=new Set(graph.nodes.map(n=>n.name));
for(const [source,links] of Object.entries(graph.connections)) {
  assert(names.has(source));
  for(const edge of links.main.flat()) assert(names.has(edge.node));
}
for(const node of graph.nodes) if(node.type==="n8n-nodes-base.code" || node.parameters.jsCode) new Function(node.parameters.jsCode);
assert.equal(graph.nodes.find(n=>n.name==="DeepSeek HTTP").parameters.options.timeout,180000);
assert.equal(graph.nodes.find(n=>n.name==="Anthropic HTTP").retryOnFail,false);
assert.equal(graph.connections["Cached Result?"].main[0][0].node,"Restore Cached Result");
assert.equal(graph.connections["Cached Result?"].main[1][0].node,"If Anthropic");
assert.equal(graph.connections["Valid Result?"].main[1][0].node,"Fail Checkpoint");
assert.equal(graph.settings.executionTimeout,420);
assert.equal(internalCall("test").options.waitForSubWorkflow,true);
assert.deepEqual(CLASSIFIER_FORMAT.schema.properties.call_status.enum,["scored","rep_no_show","prospect_no_show","transcript_too_short"]);
console.log("Durable provider graph: connections, code syntax, branch isolation, deadlines and classifier contract passed.");
