import {describe,it,expect} from "vitest";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { KNOWLEDGE_REFRESH_SOURCES } from "../../../src/lib/ask-sales-faq/knowledge-refresh-sources";
import { redactKnowledgeRefreshContent } from "../../../src/lib/ask-sales-faq/knowledge-refresh-privacy";
import {semanticScores,evidenceFingerprint,EMBEDDING_MODEL,EMBEDDING_DIMENSIONS} from "../../../src/lib/ask-sales-faq/revamp/semantic";
import type { Evidence } from "../../../src/lib/ask-sales-faq/revamp/types";
describe("collector deployment contract",()=>{
 const artifact=JSON.parse(readFileSync("rollout/ask-sales-collector-patches.json","utf8"));
 it("dispatches every enabled Slack source through the parent without mixing metadata",()=>{
  const patch=artifact.orchestrationPatches[0];
  const sources=KNOWLEDGE_REFRESH_SOURCES.map(s=>({id:s.id,kind:s.kind,external_id:s.externalId,enabled:s.enabled,last_cursor:{latestTs:s.id}}));
  sources.push({id:"unapproved",kind:"slack_channel",external_id:"unapproved",enabled:true,last_cursor:{latestTs:"x"}});
  const result=runInNewContext(`(function(){${patch.replacementParameters.jsCode}})()`,{$input:{first:()=>({json:{sources}})},$execution:{id:"isolated-test"}});
  expect(result.map((r:{json:{id:string}})=>r.json.id)).toEqual(sources.filter(s=>s.enabled && s.id!=="unapproved").map(s=>s.id));
  for(const item of result) expect(item.json.last_cursor.latestTs).toBe(item.json.id);
 });
 it("also protects the parent and analyzer and excludes applicant-letter logs",()=>{
  expect(artifact.privacySettingsPatches.map((p:{workflowId:string})=>p.workflowId).sort()).toEqual(["rNc9rWTBHRSEwM3P","ua18B5wbsYptLqJX"]);
  for(const p of artifact.privacySettingsPatches) {
   expect(p.replacementSettings.saveDataErrorExecution).toBe("none");
   expect(p.replacementSettings.saveExecutionProgress).toBe(false);
  }
  expect(KNOWLEDGE_REFRESH_SOURCES.find(s=>s.externalId==="1R-8BnPOygF8EQbFo9KFiJcc7Xw0F6xlwSE3m6Rnv8Ic")?.enabled).toBe(false);
 });
 for(const patch of artifact.patches) it(`${patch.nodeName} accepts exactly the enabled source family`,()=>{
  const slack=patch.nodeName.includes("Slack");
  const run=(source:unknown)=>runInNewContext(`(function(){${patch.replacementParameters.jsCode}})()`,{$json:source,$execution:{id:"isolated-test"}});
  for(const source of KNOWLEDGE_REFRESH_SOURCES.filter(s=>s.enabled && (slack?s.kind==="slack_channel":s.kind!=="slack_channel"))) {
   const result=run({id:source.id,kind:source.kind,external_id:source.externalId});
   expect(result.json.source_id).toBe(source.id);
  }
  expect(()=>run({kind:slack?"slack_channel":"google_doc",external_id:"unapproved"})).toThrow("allowlist");
  expect(patch.expectedActiveVersionId).toBeTruthy();
  expect(patch.replacementSettings.saveDataSuccessExecution).toBe("none");
 });
 it("removes source credentials while preserving usable policy links and numbers",()=>{
  const input="password: example-private-pass\napi key is sk-example123456789012345678901\nhttps://docs.google.com/document/d/public-policy\nVIP $30,000, 4 payments of $7,500.";
  const result=redactKnowledgeRefreshContent(input);
  expect(result.text).not.toContain("example-private-pass");expect(result.text).not.toContain("sk-example");
  expect(result.text).toContain("https://docs.google.com/document/d/public-policy");expect(result.text).toContain("$30,000");
 });
 it("never reuses changed or retired evidence embeddings",()=>{
  const record={id:"current",title:"Price",questions:[],text:"20k",scopes:["reality"],conditions:[]} as unknown as Evidence;
  const vector=Array(EMBEDDING_DIMENSIONS).fill(0);vector[0]=1;
  const index={model:EMBEDDING_MODEL,dimensions:EMBEDDING_DIMENSIONS,entries:{current:{fingerprint:evidenceFingerprint(record),vector},retired:{fingerprint:"old",vector}}};
  expect([...semanticScores([record],index,vector)]).toEqual([["current",1]]);
  expect(semanticScores([{...record,text:"30k"}],index,vector).size).toBe(0);
  expect(semanticScores([],index,vector).size).toBe(0);
 });
});
