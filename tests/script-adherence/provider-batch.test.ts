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
