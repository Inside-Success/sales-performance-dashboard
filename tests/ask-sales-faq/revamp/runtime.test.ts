import { describe,it,expect } from "vitest";
import { runAskSalesRevamp,validateEvidenceReferences } from "../../../src/lib/ask-sales-faq/revamp/runtime";
import { reconcileEvidence } from "../../../src/lib/ask-sales-faq/revamp/knowledge";
import { retrieveEvidence } from "../../../src/lib/ask-sales-faq/revamp/retrieval";
import { createRevampProvider } from "../../../src/lib/ask-sales-faq/revamp/provider";
import type { Evidence,JsonProvider,Answer } from "../../../src/lib/ask-sales-faq/revamp/types";
const fact=(id:string,text:string,scopes=["main_istv"]):Evidence=>({id,title:id,decisionKey:id,text,scopes,questions:[],sourceIds:[],reviewedAt:"2026-09-15",authority:10,kind:"policy",risk:"high",routeKey:null,conditions:[],supersedes:[]});
const attempt={provider:"openai" as const,model:"test",purpose:"test",status:"success" as const,latencyMs:1,inputTokens:1,cachedTokens:0,outputTokens:1};
const answer:Answer={status:"answer",paragraphs:[{text:"The approved price is $20,000.",kind:"company_fact",evidenceIds:["price"]}],routeKey:null};
const modelAnswer:Answer={...answer,paragraphs:answer.paragraphs.map(p=>({...p,evidenceIds:["E1"]}))};
describe("revamp isolation and evidence boundaries",()=>{
 it("rejects dangling supersession references instead of silently serving conflicting knowledge",()=>{
  expect(()=>reconcileEvidence([{...fact("new","current"),supersedes:["missing"]}])).toThrow("Unknown superseded evidence");
 });
 it("rejects cycles that would silently remove every competing source",()=>{
  expect(()=>reconcileEvidence([{...fact("a","a"),supersedes:["b"]},{...fact("b","b"),supersedes:["a"]}])).toThrow("Cyclic evidence supersession");
 });
 it("preserves the last replacement in a valid supersession chain",()=>{
  expect(reconcileEvidence([fact("a","old"),{...fact("b","intermediate"),supersedes:["a"]},{...fact("c","current"),supersedes:["b"]}]).map(r=>r.id)).toEqual(["c"]);
 });
 it("only retires explicit IDs, preserving other scopes and exceptions",()=>{
  const a=fact("old","six months"), b={...fact("new","three months"),supersedes:["old"]}, c=fact("exception","six months",["dj_nlceo"]);
  expect(reconcileEvidence([a,b,c]).map(r=>r.id)).toEqual(["new","exception"]);
 });
 it("preserves direct query candidates across semantic query expansion",()=>{
  const records=[fact("reapply","reapply wait three months"),fact("noshow","call 1 wait five minutes")];
  const result=retrieveEvidence(records,"wait to reapply",{intent:"company_question",question:"wait to reapply",scopes:["main_istv"],queries:["call 1 wait"]});
  expect(result.some(r=>r.record.id==="reapply")).toBe(true);
 });
 it("excludes explicitly different product prices",()=>{
  const rows=retrieveEvidence([fact("main","package price"),fact("reality","package price",["reality"])],"price",{intent:"company_question",question:"price",scopes:["reality"],queries:[]});
  expect(rows.map(r=>r.record.id)).toEqual(["reality"]);
 });
 it("recognizes inherited DJ scope aliases in a reality request",()=>{
  const rows=retrieveEvidence([fact("dj","filming reaudition six months",["daymond_john"]),fact("reality","filming",["reality"])],"filming reaudition",{intent:"company_question",question:"filming",scopes:["reality"],queries:[]});
  expect(rows.map(r=>r.record.id)).toEqual(["reality"]);
 });
 it("does not extend pre-reality unspecified upgrade rules into reality",()=>{
  const old={...fact("legacy-upgrade","standard vip upgrade",["product_agnostic"]),conditions:["legacy_scope_not_verified_for_reality"]};
  const shared=fact("new-shared","standard vip upgrade",["shared"]);
  const rows=retrieveEvidence([old,shared],"upgrade",{intent:"company_question",question:"upgrade",scopes:["reality"],queries:[]});
  expect(rows.map(r=>r.record.id)).toEqual(["new-shared"]);
 });
 it("requires real references for company facts and rejects invented resource URLs",()=>{
  expect(validateEvidenceReferences(answer,[fact("price","$20,000")])).toBe(true);
  expect(validateEvidenceReferences(answer,[])).toBe(false);
  expect(validateEvidenceReferences({...answer,paragraphs:[{...answer.paragraphs[0],text:"https://fake.test"}]},[fact("price","$20,000")])).toBe(false);
 });
 it("does not require evidence or Slack for ordinary conversation",async()=>{
  const replies=[{intent:"conversation",question:"how is everything going on",scopes:[],queries:[]},{status:"conversation",paragraphs:[{text:"I'm here and ready to help. How are you doing?",kind:"conversation",evidenceIds:[]}],routeKey:null}];
  let calls=0;const provider:JsonProvider=async()=>({value:replies[calls++],attempt});
  const result=await runAskSalesRevamp("how is everything going on",[],{provider,evidence:[]});
  expect(calls).toBe(2);expect(result.needsRoute).toBe(false);expect(result.outcome).toBe("conversation_reply");
 });
 it("keeps full 12000-char latest question and redacts credentials before model dispatch",async()=>{
  const question="context ".repeat(1000)+"my api key is sk-abcdefghijklmnopqrstuv and final question";
  const provider:JsonProvider=async(_,input)=>{
   const q=(input as {question:string}).question;expect(q).toContain("final question");expect(q).not.toContain("sk-abcdefghijklmnopqrstuv");throw new Error("stop");
  };
  const r=await runAskSalesRevamp(question,[],{provider,evidence:[]});expect(r.errorClass).toBe("revamp_invalid_output");
 });
 it("reports provider failure as technical failure without a Slack referral",async()=>{
  const provider=createRevampProvider({provider:"openai",model:"test",apiKey:"test",fetcher:async()=>new Response("private body",{status:429})});
  const result=await runAskSalesRevamp("what is our price",[],{provider,evidence:[]});
  expect(result.errorClass).toBe("revamp_provider_http_429");expect(result.answer).toContain("technical problem");expect(result.answer).not.toContain("Slack");expect(result.needsRoute).toBe(false);
 });
 it("lets the planned reviewer repair draft schema without adding a retry",async()=>{
  let calls=0;const provider:JsonProvider=async()=>({value:[{intent:"company_question",question:"price",scopes:["main_istv"],queries:[]},{...modelAnswer,paragraphs:[{...modelAnswer.paragraphs[0],kind:"sales_advice"}]},modelAnswer][calls++],attempt});
  const result=await runAskSalesRevamp("price",[],{provider,evidence:[fact("price","price $20,000")]});
  expect(calls).toBe(3);expect(result.errorClass).toBeNull();
  expect(result.structuredAnswer?.confidenceBasis).toBe("unscored");
 });
 it("normalizes shared query scope without accepting invented products",async()=>{
  let calls=0;const provider:JsonProvider=async()=>({value:[{intent:"company_question",question:"price",scopes:["shared"],queries:[]},modelAnswer,modelAnswer][calls++],attempt});
  const result=await runAskSalesRevamp("price",[],{provider,evidence:[fact("price","price $20,000")]});
  expect(result.errorClass).toBeNull();
 });
 it("does not dispatch or charge when no key or budget is available",async()=>{
  let dispatches=0,charges=0;
  const fetcher:typeof fetch=async()=>{dispatches++;return new Response("{}");};
  const missing=createRevampProvider({provider:"openai",model:"test",apiKey:"",fetcher,afterCall:async()=>{charges++;}});
  await expect(missing("system",{},"plan")).rejects.toThrow("provider_not_configured");
  const limited=createRevampProvider({provider:"openai",model:"test",apiKey:"test",fetcher,beforeCall:async()=>{throw new Error("budget exhausted");},afterCall:async()=>{charges++;}});
  await expect(limited("system",{},"plan")).rejects.toThrow("budget exhausted");
  expect(dispatches).toBe(0);expect(charges).toBe(0);
 });
 it("reviews company answers and uses repaired output",async()=>{
  let calls=0;const provider:JsonProvider=async()=>({value:[{intent:"company_question",question:"price",scopes:["main_istv"],queries:[]},modelAnswer,{...modelAnswer,paragraphs:[{...modelAnswer.paragraphs[0],text:"The package costs $20,000."}]}][calls++],attempt});
  const result=await runAskSalesRevamp("price",[],{provider,evidence:[fact("price","price $20,000")]});
  expect(calls).toBe(3);expect(result.answer).toBe("The package costs $20,000.");
  expect(result.runtimeMetadata?.revamp?.selectedEvidenceIds).toEqual(["price"]);
 });
});
