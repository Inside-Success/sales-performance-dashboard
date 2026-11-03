import { describe, expect, it, vi } from 'vitest';
import { runAskSalesRevamp, stripInternalCitations } from '../../../src/lib/ask-sales-faq/revamp/runtime';
import { RevampProviderError } from '../../../src/lib/ask-sales-faq/revamp/provider';
import type { JsonProvider, Attempt } from '../../../src/lib/ask-sales-faq/revamp/types';
const attempt=(purpose:string,error?:string):Attempt=>({provider:'openai',model:'test',purpose,status:error?'failed':'success',latencyMs:1,inputTokens:0,cachedTokens:0,outputTokens:0,...(error?{error}:{})});
const plan={historyMode:'new_subject',intent:'conversation',question:'Hello',queries:[],scopes:[]};
const answer={status:'conversation',paragraphs:[{text:'Hello! How can I help?',kind:'conversation',evidenceIds:[]}],routeKey:null};
function scripted(failures: Record<number,string>, before?: (n:number)=>void) {
 const calls:string[]=[]; const timeouts:number[]=[];
 const provider:JsonProvider=async(_system,_input,purpose,options)=>{
  const n=calls.push(purpose); timeouts.push(options?.timeoutMs||0); before?.(n);
  expect(options?.timeoutMs).toBeGreaterThan(0);expect(options?.timeoutMs).toBeLessThanOrEqual(30000);
  if(failures[n]) throw new RevampProviderError(attempt(purpose,failures[n]));
  return {value:purpose==='plan'?plan:answer,attempt:attempt(purpose)};
 };
 return {provider,calls,timeouts};
}
describe('bounded recovery of transient provider failures',()=>{
 it.each([1,2,3])('retries only the failed stage %s and still reviews',async(stage)=>{
  const {provider,calls,timeouts}=scripted({[stage]:'provider_timeout'});
  const r=await runAskSalesRevamp('Hello',[],{provider,evidence:[]});
  expect(r.errorClass).toBeNull();expect(calls).toHaveLength(4);
  expect(calls[stage]).toBe(calls[stage-1]);expect(calls.at(-1)).toBe('review');
  expect(timeouts[stage]).toBe(30000);expect(timeouts.filter(t=>t===30000)).toHaveLength(1);
  expect(r.runtimeMetadata?.providerAttempts).toHaveLength(4);
  expect(r.runtimeMetadata?.revamp?.retryCount).toBe(1);
 });
 it('allows only one recovery across different failed stages',async()=>{
  const {provider,calls}=scripted({1:'provider_http_503',3:'provider_timeout'});
  const r=await runAskSalesRevamp('Hello',[],{provider,evidence:[]});
  expect(calls).toEqual(['plan','plan','answer']);expect(r.errorClass).toBe('revamp_provider_timeout');
  expect(r.answer).not.toContain('Hello!');
 });
 it.each(['provider_http_401','provider_http_429','provider_balance','provider_incomplete_output','provider_invalid_response'])('does not retry %s',async(error)=>{
  const {provider,calls}=scripted({1:error});const r=await runAskSalesRevamp('Hello',[],{provider,evidence:[]});
  expect(calls).toHaveLength(1);expect(r.errorClass).toBeTruthy();
 });
 it('does not retry a failed review when the overall deadline lacks a full attempt',async()=>{
  let time=0;const clock=vi.spyOn(Date,'now').mockImplementation(()=>time);
  try {
   const {provider,calls}=scripted({3:'provider_timeout'},n=>{if(n===3)time=80000;});
   const r=await runAskSalesRevamp('Hello',[],{provider,evidence:[]});
   expect(calls).toHaveLength(3);expect(r.runtimeMetadata?.revamp?.retryCount).toBe(0);expect(r.errorClass).toBeTruthy();
  } finally {clock.mockRestore();}
 });
 it('never treats a budget/accounting rejection as retryable',async()=>{
  let calls=0;const provider:JsonProvider=async()=>{calls++;throw new Error('Evaluation spending ceiling reached');};
  const r=await runAskSalesRevamp('Hello',[],{provider,evidence:[]});expect(calls).toBe(1);expect(r.errorClass).toBeTruthy();
 });
 it('removes internal citation groups without stripping ordinary parentheses',()=>{
  expect(stripInternalCitations('Use the current SOP (E13, E20). Keep (Call 2) and (20 minutes).')).toBe('Use the current SOP. Keep (Call 2) and (20 minutes).');
 });
});
