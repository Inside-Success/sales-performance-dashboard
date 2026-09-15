/** Generates review artifacts only. Does not connect to or mutate n8n. */
import { writeFileSync,mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { KNOWLEDGE_REFRESH_SOURCES } from "../src/lib/ask-sales-faq/knowledge-refresh-sources";
import baselines from "../tests/ask-sales-faq/revamp/collector-guard-baselines.json";
import parentBaseline from "../tests/ask-sales-faq/revamp/orchestrator-source-baseline.json";
const output=resolve("rollout/ask-sales-collector-patches.json");
const patches=baselines.map(baseline=>{
  const slack=baseline.nodeName.includes("Slack");
  const ids=KNOWLEDGE_REFRESH_SOURCES.filter(s=>s.enabled && (slack?s.kind==="slack_channel":s.kind!=="slack_channel")).map(s=>s.externalId);
  const jsCode=baseline.parameters.jsCode.replace(/const allowed = new Set\(\[[^\]]*\]\);/,`const allowed = new Set(${JSON.stringify(ids)});`);
  if(jsCode===baseline.parameters.jsCode) throw new Error("Expected an allowlist expansion");
  return {workflowId:baseline.workflowId,expectedActiveVersionId:baseline.expectedActiveVersionId,
    nodeId:baseline.nodeId,nodeName:baseline.nodeName,expectedParameters:baseline.parameters,
    replacementParameters:{...baseline.parameters,jsCode},
    // Source collectors receive raw credentials occasionally. Retain operational
    // status, but do not persist raw successful/error/manual execution payloads.
    expectedSettings:{saveDataSuccessExecution:"all",saveDataErrorExecution:"all",saveManualExecutions:true},
    replacementSettings:{saveDataSuccessExecution:"none",saveDataErrorExecution:"none",saveManualExecutions:false},
  };
});
mkdirSync(resolve("rollout"),{recursive:true});
// The parent and analyzer also receive the raw snapshot before ingestion
// redaction. Child-only retention settings would leave a second raw copy.
const privacySettingsPatches=[
  {workflowId:"ua18B5wbsYptLqJX",expectedActiveVersionId:"cc371a8d-2a4b-4d60-971a-459ffc747bc6"},
  {workflowId:"rNc9rWTBHRSEwM3P",expectedActiveVersionId:"42b83ebc-c159-4ec2-a4c3-b84e63e0d769"},
].map(patch=>({...patch,expectedSettings:{saveDataSuccessExecution:"all",saveDataErrorExecution:"all",saveManualExecutions:true},
  replacementSettings:{saveDataSuccessExecution:"none",saveDataErrorExecution:"none",saveManualExecutions:false,saveExecutionProgress:false}}));
const slackIds=KNOWLEDGE_REFRESH_SOURCES.filter(s=>s.enabled && s.kind==="slack_channel").map(s=>s.externalId);
const parentCode=parentBaseline.parameters.jsCode.replace(/const allowedSlack = new Set\(\[[^\]]*\]\);/,`const allowedSlack = new Set(${JSON.stringify(slackIds)});`);
if(parentCode===parentBaseline.parameters.jsCode) throw new Error("Expected parent Slack allowlist expansion");
const orchestrationPatches=[{workflowId:parentBaseline.workflowId,expectedActiveVersionId:parentBaseline.expectedActiveVersionId,
  nodeId:parentBaseline.nodeId,nodeName:parentBaseline.nodeName,expectedParameters:parentBaseline.parameters,
  replacementParameters:{...parentBaseline.parameters,jsCode:parentCode}}];
writeFileSync(output,JSON.stringify({schemaVersion:1,status:"NOT_APPLIED",patches,privacySettingsPatches,orchestrationPatches},null,2)+"\n");
console.log(`Generated ${patches.length} collector patches; no live changes`);
