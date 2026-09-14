/** Generates review artifacts only. Does not connect to or mutate n8n. */
import { writeFileSync,mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { KNOWLEDGE_REFRESH_SOURCES } from "../src/lib/ask-sales-faq/knowledge-refresh-sources";
import baselines from "../tests/ask-sales-faq/revamp/collector-guard-baselines.json";
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
writeFileSync(output,JSON.stringify({schemaVersion:1,status:"NOT_APPLIED",patches},null,2)+"\n");
console.log(`Generated ${patches.length} collector patches; no live changes`);
