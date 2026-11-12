import {beforeEach,afterEach,expect,it,vi} from 'vitest';
const {sql,claimModel,receive}=vi.hoisted(()=>({sql:Object.assign(vi.fn(),{transaction:vi.fn()}),claimModel:vi.fn(),receive:vi.fn()}));
vi.mock('@neondatabase/serverless',()=>({neon:()=>sql}));
vi.mock('@/lib/script-adherence/queue',()=>({claimModel,receive}));
import {runProviderBatch,receiptMap,terminalBatch} from '@/lib/script-adherence/provider-batch';
import {POST} from '@/app/api/internal/script-adherence/provider/route';
const fetcher=vi.fn();
beforeEach(()=>{sql.mockReset();sql.transaction.mockReset();claimModel.mockReset();receive.mockReset();fetcher.mockReset();vi.stubGlobal('fetch',fetcher);process.env.ADHERENCE_OPENAI_API_KEY='dedicated-test';process.env.INGEST_SECRET='test';sql.mockResolvedValue([]);sql.transaction.mockResolvedValue([]);});
afterEach(()=>vi.unstubAllGlobals());
it('matches reordered receipts by identity and rejects extras or duplicates',()=>{
 expect([...receiptMap(['a','b'],[{custom_id:'b'},{custom_id:'a'}]).keys()]).toEqual(['b','a']);
 expect(receiptMap(['a','b'],[{custom_id:'a'}]).has('b')).toBe(false);
 expect(()=>receiptMap(['a'],[{custom_id:'b'}])).toThrow();
 expect(()=>receiptMap(['a'],[{custom_id:'a'},{custom_id:'a'}])).toThrow();
 expect(()=>receiptMap(['a','a'],[])).toThrow();
});
it('does not treat finalizing or cancellation-in-progress as terminal',()=>{expect(terminalBatch('finalizing')).toBe(false);expect(terminalBatch('cancelling')).toBe(false);expect(terminalBatch('expired')).toBe(true);});
it('rejects unauthenticated provider operations before any database access',async()=>{expect((await POST(new Request('https://test',{method:'POST'}))).status).toBe(401);expect(sql).not.toHaveBeenCalled();});
it('does no work when another runner owns the lease',async()=>{expect(await runProviderBatch()).toEqual({busy:true});expect(fetcher).not.toHaveBeenCalled();expect(claimModel).not.toHaveBeenCalled();});
it('does not use the coaching key as a fallback',async()=>{
 delete process.env.ADHERENCE_OPENAI_API_KEY;process.env.OPENAI_API_KEY='wrong-key';
 sql.mockResolvedValueOnce([{id:true}]).mockResolvedValueOnce([{transport:'batch',enabled:false,canary_keys:[]}]).mockResolvedValueOnce([{id:'b',state:'running',provider_id:'batch_1'}]);
 await expect(runProviderBatch()).rejects.toThrow('Dedicated');expect(fetcher).not.toHaveBeenCalled();
});
it('normal pending batches are checked without replay or settlement even when intake is paused',async()=>{
 sql.mockResolvedValueOnce([{id:true}]).mockResolvedValueOnce([{transport:'batch',enabled:false,canary_keys:[]}]).mockResolvedValueOnce([{id:'b',state:'running',provider_id:'batch_1'}]);
 fetcher.mockResolvedValue(new Response(JSON.stringify({id:'batch_1',status:'in_progress'})));
 expect(await runProviderBatch()).toEqual({checked:1});expect(fetcher).toHaveBeenCalledTimes(1);expect(fetcher.mock.calls[0][1].method).toBe('GET');expect(claimModel).not.toHaveBeenCalled();expect(receive).not.toHaveBeenCalled();
});
it('recovers an uncertain submitted batch by metadata without another paid POST',async()=>{
 sql.mockResolvedValueOnce([{id:true}]).mockResolvedValueOnce([{transport:'batch',enabled:false,canary_keys:[]}]).mockResolvedValueOnce([{id:'local',state:'submitting',provider_id:null}]);
 fetcher.mockResolvedValue(new Response(JSON.stringify({data:[{id:'batch_existing',status:'in_progress',metadata:{adherence_batch:'local'}}],has_more:false})));
 await runProviderBatch();expect(fetcher).toHaveBeenCalledTimes(1);expect(fetcher.mock.calls[0][1].method).toBe('GET');expect(sql.transaction).toHaveBeenCalledTimes(1);
});
it('does not resubmit when a bounded reconciliation cannot find the prior submission',async()=>{
 sql.mockResolvedValueOnce([{id:true}]).mockResolvedValueOnce([{transport:'batch',enabled:false,canary_keys:[]}]).mockResolvedValueOnce([{id:'local',state:'submitting',provider_id:null}]);
 fetcher.mockResolvedValue(new Response(JSON.stringify({data:[],has_more:false})));
 await runProviderBatch();expect(fetcher.mock.calls.every(c=>c[1].method==='GET')).toBe(true);expect(sql.transaction).not.toHaveBeenCalled();expect(sql.mock.calls.some(c=>c[0].join('').includes('Submission unconfirmed'))).toBe(true);
});
it('recollection skips settled requests and only settles the missing successful receipt',async()=>{
 sql.mockImplementation(async(parts:TemplateStringsArray)=>{const q=parts.join('');if(q.includes('returning id'))return [{id:true}];if(q.includes('select * from script_adherence_control'))return [{transport:'batch',enabled:false,canary_keys:[]}];if(q.includes('select * from script_adherence_provider_batches'))return [{id:'b',state:'running',provider_id:'batch_1'}];if(q.includes('select m.request_id'))return [{request_id:'settled',job_id:'j1',actual_microusd:5},{request_id:'new',job_id:'j2',actual_microusd:null}];return [];});
 fetcher.mockResolvedValueOnce(new Response(JSON.stringify({id:'batch_1',status:'completed',output_file_id:'file_1'}))).mockResolvedValueOnce(new Response([{custom_id:'new',response:{status_code:200,body:{usage:{prompt_tokens:10}}}},{custom_id:'settled',response:{status_code:200,body:{usage:{prompt_tokens:10}}}}].map(x=>JSON.stringify(x)).join('\n')));
 await runProviderBatch();expect(receive).toHaveBeenCalledTimes(1);expect(receive.mock.calls[0].slice(0,2)).toEqual(['new','j2']);
});
it('records source failures separately so a successful provider poll cannot hide them',async()=>{
 const {recordSchedulerFailure,recordSourceSuccess}=await import('@/lib/script-adherence/provider-batch');
 await recordSchedulerFailure('hb3M0O7fYx04oVEs');expect(sql.mock.calls[0][0].join('')).toContain('set source_error=');
 await recordSourceSuccess();expect(sql.mock.calls[1][0].join('')).toContain('set source_error=null');
});

it('does not reserve more requests when four provider batches are already active',async()=>{
 sql.mockImplementation(async(parts:TemplateStringsArray)=>{const q=parts.join('');if(q.includes('returning id'))return [{id:true}];if(q.includes('select * from script_adherence_control'))return [{transport:'batch',enabled:true,canary_keys:[]}];if(q.includes('select count(*)::int as count'))return [{count:4}];return [];});
 await runProviderBatch();expect(claimModel).not.toHaveBeenCalled();expect(fetcher).not.toHaveBeenCalled();
});

it('persists a partial manifest when a later claim fails, without submitting or swallowing the fault',async()=>{
 sql.mockImplementation(async(parts:TemplateStringsArray)=>{const q=parts.join('');if(q.includes('returning id'))return [{id:true}];if(q.includes('select * from script_adherence_control'))return [{transport:'batch',enabled:true,canary_keys:[]}];if(q.includes('select count(*)::int as count'))return [{count:0}];return [];});
 claimModel.mockResolvedValueOnce({id:'existing-reservation',jobId:'job',body:{model:'gpt-6.1-terra'},stage:'review'}).mockRejectedValueOnce(new Error('database unavailable'));
 await expect(runProviderBatch()).rejects.toThrow('database unavailable');
 expect(sql.transaction).toHaveBeenCalledTimes(1);expect(fetcher).not.toHaveBeenCalled();
 const member=sql.mock.calls.find(c=>c[0].join('').includes('insert into script_adherence_batch_members'))!;
 expect(member.some(v=>typeof v==='string'&&v.includes('existing-reservation'))).toBe(true);
 expect(sql.mock.calls.some(c=>c[0].join('').includes('lease_owner=null'))).toBe(true);
});
it('keeps the specific processor error when the scheduler reports a generic failure',async()=>{
 const {recordSchedulerFailure}=await import('@/lib/script-adherence/provider-batch');await recordSchedulerFailure('checker');
 expect(sql.mock.calls[0][0].join('')).toContain('error=coalesce(error,');
});

function prepared(){
 sql.mockImplementation(async(parts:TemplateStringsArray)=>{const q=parts.join('');
 if(q.includes('returning id'))return [{id:true}];
 if(q.includes('select * from script_adherence_control'))return [{transport:'batch',enabled:false,canary_keys:[]}];
 if(q.includes('select * from script_adherence_provider_batches'))return [{id:'local',state:'prepared',file_id:'file_saved',provider_id:null}];
 if(q.includes('select r.id,r.request_body'))return [{id:'r',request_body:{model:'test'}}];
 if(q.includes("kind='retryable_rejection'"))return [{count:1}];return [];
 });
}
it('reschedules a confirmed 429 rejection without uploading or reserving again',async()=>{
 prepared();fetcher.mockResolvedValue(new Response(JSON.stringify({error:{code:'rate_limit_exceeded'}}),{status:429,headers:{'x-request-id':'req-rejected'}}));
 await runProviderBatch();expect(fetcher).toHaveBeenCalledTimes(1);expect(claimModel).not.toHaveBeenCalled();
 expect(sql.mock.calls.some(c=>c[0].join('').includes("state='prepared',error='Provider rejected"))).toBe(true);
 expect(sql.mock.calls.some(c=>c.some(v=>typeof v==='string'&&v.includes('req-rejected')))).toBe(true);
});
it('holds a confirmed permanent rejection without treating it as pending analysis',async()=>{
 prepared();fetcher.mockResolvedValue(new Response(JSON.stringify({error:{code:'invalid_request'}}),{status:400}));
 await runProviderBatch();expect(sql.transaction).toHaveBeenCalledOnce();expect(fetcher).toHaveBeenCalledOnce();
 expect(sql.mock.calls.some(c=>c[0].join('').includes("j set state='held'"))).toBe(true);
});
it.each([500,408,409])('never resets an uncertain HTTP %i submission for retry',async(status)=>{
 prepared();fetcher.mockResolvedValue(new Response('{}',{status}));await runProviderBatch();
 expect(sql.mock.calls.some(c=>c[0].join('').includes("set state='prepared'"))).toBe(false);
 expect(fetcher).toHaveBeenCalledOnce();
});
it('network timeout retains the paid intent and cannot retry',async()=>{
 prepared();fetcher.mockRejectedValue(new Error('timeout'));await runProviderBatch();
 expect(fetcher).toHaveBeenCalledOnce();expect(sql.mock.calls.some(c=>c[0].join('').includes("set state='prepared'"))).toBe(false);
});
it('quarantines an hour-old unconfirmed submission without a paid replay or lost reservation',async()=>{
 sql.mockResolvedValueOnce([{id:true}]).mockResolvedValueOnce([{transport:'batch',enabled:false,canary_keys:[]}]).mockResolvedValueOnce([{id:'local',state:'submitting',provider_id:null,file_id:'file_saved',submission_at:'2026-01-01T00:00:00Z'}]);
 fetcher.mockResolvedValue(new Response(JSON.stringify({data:[],has_more:false})));
 await runProviderBatch();expect(sql.transaction).toHaveBeenCalledOnce();expect(fetcher.mock.calls.every(c=>c[1].method==='GET')).toBe(true);
 expect(sql.mock.calls.some(c=>c[0].join('').includes('script_adherence_budget'))).toBe(false);
});
it('finds a batch by exact input file on a later page and restores only its matching held jobs',async()=>{
 sql.mockResolvedValueOnce([{id:true}]).mockResolvedValueOnce([{transport:'batch',enabled:false,canary_keys:[]}]).mockResolvedValueOnce([{id:'local',state:'held',provider_id:null,file_id:'file_saved'}]);
 fetcher.mockResolvedValueOnce(new Response(JSON.stringify({data:[],has_more:true,last_id:'cursor'}))).mockResolvedValueOnce(new Response(JSON.stringify({data:[{id:'batch_existing',status:'completed',input_file_id:'file_saved'}],has_more:false})));
 await runProviderBatch();expect(fetcher).toHaveBeenCalledTimes(2);expect(fetcher.mock.calls.every(c=>c[1].method==='GET')).toBe(true);expect(sql.transaction).toHaveBeenCalledOnce();
});
it('does not attach the first of duplicate matches on different pages',async()=>{
 sql.mockResolvedValueOnce([{id:true}]).mockResolvedValueOnce([{transport:'batch',enabled:false,canary_keys:[]}]).mockResolvedValueOnce([{id:'local',state:'submitting',provider_id:null,file_id:'f'}]);
 fetcher.mockResolvedValueOnce(new Response(JSON.stringify({data:[{id:'one',metadata:{adherence_batch:'local'}}],has_more:true,last_id:'one'}))).mockResolvedValueOnce(new Response(JSON.stringify({data:[{id:'two',input_file_id:'f'}],has_more:false})));
 await expect(runProviderBatch()).rejects.toThrow('Multiple provider');expect(sql.mock.calls.some(c=>c[0].join('').includes('set provider_id='))).toBe(false);
});
it('does not re-POST an accepted batch when database attachment fails',async()=>{
 prepared();fetcher.mockResolvedValue(new Response(JSON.stringify({id:'batch_paid',status:'validating'})));sql.transaction.mockRejectedValueOnce(new Error('DB unavailable'));
 await expect(runProviderBatch()).rejects.toThrow('DB unavailable');expect(fetcher).toHaveBeenCalledOnce();
 expect(sql.mock.calls.some(c=>c[0].join('').includes("set state='prepared'"))).toBe(false);
 expect(sql.mock.calls.some(c=>c.some(v=>typeof v==='string'&&v.includes('batch_paid')))).toBe(true);
});
it('holds after three confirmed rate-limit rejections rather than retrying forever',async()=>{
 prepared();const prior=sql.getMockImplementation()!;sql.mockImplementation(async(...args)=>args[0].join('').includes("kind='retryable_rejection'")?[{count:3}]:prior(...args));
 fetcher.mockResolvedValue(new Response(JSON.stringify({error:{code:'rate_limit_exceeded'}}),{status:429}));await runProviderBatch();expect(sql.transaction).toHaveBeenCalledOnce();
 expect(sql.mock.calls.some(c=>c[0].join('').includes("set state='prepared'"))).toBe(false);
});
it('does not retry insufficient credit as a transient rate limit',async()=>{
 prepared();fetcher.mockResolvedValue(new Response(JSON.stringify({error:{code:'insufficient_quota'}}),{status:429}));await runProviderBatch();expect(sql.transaction).toHaveBeenCalledOnce();
});
it('does not attach or replay from an incomplete ten-page provider inventory',async()=>{
 sql.mockResolvedValueOnce([{id:true}]).mockResolvedValueOnce([{transport:'batch',enabled:false,canary_keys:[]}]).mockResolvedValueOnce([{id:'local',state:'submitting',provider_id:null,file_id:'f'}]);
 let page=0;fetcher.mockImplementation(async()=>new Response(JSON.stringify({data:page===0?[{id:'one',input_file_id:'f'}]:[],has_more:true,last_id:String(++page)})));
 await runProviderBatch();expect(fetcher).toHaveBeenCalledTimes(10);expect(sql.transaction).not.toHaveBeenCalled();expect(fetcher.mock.calls.every(c=>c[1].method==='GET')).toBe(true);
});
