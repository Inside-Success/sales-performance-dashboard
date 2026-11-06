import {beforeEach,expect,it,vi} from 'vitest';
const {sql}=vi.hoisted(()=>({sql:vi.fn()}));
vi.mock('@neondatabase/serverless',()=>({neon:()=>sql}));
import {transcriptFromVtt,safeZoomUrl,sourceIdentity,saveSource,claimSource,receive} from '@/lib/script-adherence/queue';
import {POST} from '@/app/api/internal/script-adherence/batch/route';
beforeEach(()=>{sql.mockReset();process.env.INGEST_SECRET='test';});
it('preserves all VTT segments and timestamps while excluding headers',()=>{
 const t=transcriptFromVtt('WEBVTT\n\n1\n00:00:01.200 --> 00:00:02.000\nRep: Hello\ncontinued\n\n2\n00:00:02.100 --> 00:00:04.000\nBuyer: Yes');
 expect(t).toBe('[00:00:01.200] Rep: Hello continued\n[00:00:02.100] Buyer: Yes');expect(()=>transcriptFromVtt('WEBVTT')).toThrow();expect(()=>transcriptFromVtt('<html>Login</html>')).toThrow();
});
it('rejects credential forwarding to non-Zoom or insecure URLs',()=>{
 expect(safeZoomUrl('https://us02web.zoom.us/rec/download/a')).toContain('zoom.us');
 for(const u of ['http://zoom.us/a','https://zoom.us.evil.test/a','https://evil.test/zoom.us','https://user:pass@zoom.us/a'])expect(()=>safeZoomUrl(u)).toThrow();
});
it('keeps the same UUID in different workspaces separate',()=>expect(sourceIdentity('a','uuid')).not.toBe(sourceIdentity('b','uuid')));
it('never accepts a transcript with a missing or duplicate segment',async()=>{
 sql.mockResolvedValue([{files:[{id:'a',start:'1'},{id:'b',start:'2'}]}]);
 await expect(saveSource('id','owner',[{id:'a',vtt:''}])).rejects.toThrow('Incomplete');
 await expect(saveSource('id','owner',[{id:'a',vtt:''},{id:'a',vtt:''}])).rejects.toThrow('Incomplete');
});
it('claims source downloads with an atomic lease and skips locked owners',async()=>{
 sql.mockResolvedValue([]);expect(await claimSource('owner')).toBeNull();
 const query=sql.mock.calls[0][0].join('');expect(query).toContain('skip locked');expect(query).toContain('lease_until<now()');expect(query).toContain("state='awaiting_transcript'");
});
it('rejects receipts that do not match the exact job request',async()=>{
 sql.mockResolvedValue([]);await expect(receive('id','job',{})).rejects.toThrow('Unmatched');expect(sql).toHaveBeenCalledTimes(1);
});
it('authenticates batch operations before reading source or budget',async()=>{
 const response=await POST(new Request('https://test',{method:'POST',body:JSON.stringify({operation:'status'})}));expect(response.status).toBe(401);expect(sql).not.toHaveBeenCalled();
});
it('does not advance coverage when any closer has no durable terminal page',async()=>{
 sql.mockResolvedValue([{member_id:'first'}]);const response=await POST(new Request('https://test',{method:'POST',headers:{authorization:'Bearer test'},body:JSON.stringify({operation:'finish_scan',accountId:'nTC8wAG7SsijjSRAP3IOng',runId:'run',from:'2026-11-01T00:00:00Z',to:'2026-11-02T00:00:00Z',members:['first','missing']})}));expect(response.status).toBe(503);expect(sql).toHaveBeenCalledTimes(1);
});
it('holds oversized sources without truncation or repeated download retries',async()=>{
 sql.mockResolvedValueOnce([{files:[{id:'a',start:'1'}],rep:'Rep'}]).mockResolvedValueOnce([]);
 const result=await saveSource('id','owner',[{id:'a',vtt:'WEBVTT\n\n1\n00:00:01.000 --> 00:00:02.000\n'+ 'speech '.repeat(30000)}]);
 expect(result).toEqual({saved:false,held:true});expect(sql.mock.calls[1][0].join('')).toContain("state='held'");expect(sql.mock.calls[1][0].join('')).toContain('transcript_hash=');expect(sql.mock.calls[1].some(v=>typeof v==='string'&&v.endsWith('speech '.repeat(30000).trim()))).toBe(true);expect(sql).toHaveBeenCalledTimes(2);
});
it('accepts a semantically identical saved receipt without settling twice',async()=>{
 sql.mockResolvedValueOnce([{status:'completed',actual_microusd:100,job_state:'complete'}]).mockResolvedValueOnce([]).mockResolvedValueOnce([{matches:true}]);
 expect(await receive('id','job',{usage:{input_tokens:10},id:'response'})).toEqual({duplicate:true,published:true});
 expect(sql).toHaveBeenCalledTimes(3);expect(sql.mock.calls[2][0].join('')).toContain('::jsonb as matches');
});
it('rejects changed receipt content even after the first receipt was settled',async()=>{
 sql.mockResolvedValueOnce([{status:'completed',actual_microusd:100,job_state:'complete'}]).mockResolvedValueOnce([]).mockResolvedValueOnce([{matches:false}]);
 await expect(receive('id','job',{id:'different'})).rejects.toThrow('Conflicting');expect(sql).toHaveBeenCalledTimes(3);
});

it('accounts for previously accepted recordings without putting them back in the source queue',async()=>{
 const {discover}=await import('@/lib/script-adherence/queue');sql.mockResolvedValue([]);
 await discover([{accountId:'nTC8wAG7SsijjSRAP3IOng',uuid:'known',rep:'Rep',title:'Call',startedAt:'2026-11-01T00:00:00Z',sourceUrl:'',files:[]}]);
 const q=sql.mock.calls[0][0].join('');expect(q).toContain("then 'complete' else 'awaiting_transcript'");expect(q).toContain('c.source_key=r.id');expect(q).toContain("where script_adherence_jobs.state='awaiting_transcript'");
});

it('isolates an oversized first call and reserves the next usable call',async()=>{
 const {claimModel}=await import('@/lib/script-adherence/queue');let isolated=false;
 sql.mockImplementation(async(parts:TemplateStringsArray,...values:unknown[])=>{const q=parts.join('');
 if(q.includes('select * from script_adherence_control'))return [{enabled:true,canary_keys:[],transport:'batch',review_model:'gpt-6.1-terra',draft_model:'gpt-6.1-terra'}];
 if(q.includes('select r.id,r.request_body'))return [];
 if(q.includes("where state in ('ready','review_ready')"))return [isolated?{id:'valid',source_key:'valid',state:'ready',transcript:'[00:01] Rep: Hello',title:'Call',rep:'Rep'}:{id:'oversized',source_key:'oversized',state:'review_ready',transcript:'[00:01] Rep: '+ 'speech '.repeat(40000),title:'Call',rep:'Rep',draft:{}}];
 if(q.includes("set state='held'")){expect(values).toContain('oversized');isolated=true;return [];}
 if(q.includes('with budget as'))return [{id:'reserved'}];return [];
 });
 expect((await claimModel([],'openai','batch'))?.jobId).toBe('valid');expect(isolated).toBe(true);
});
it('reuses an unattached reservation without reserving or charging it again',async()=>{
 const {claimModel}=await import('@/lib/script-adherence/queue');sql.mockResolvedValueOnce([{enabled:true,transport:'batch',canary_keys:[]}]).mockResolvedValueOnce([{id:'existing',job_id:'j',stage:'unattended-review',request_body:{model:'gpt-6.1-terra'}}]);
 expect((await claimModel([],'openai','batch'))?.id).toBe('existing');expect(sql).toHaveBeenCalledTimes(2);
});
it('does not turn an infrastructure error into an individual call hold',async()=>{
 const {claimModel}=await import('@/lib/script-adherence/queue');sql.mockResolvedValueOnce([{enabled:true,transport:'batch',canary_keys:[]}]).mockRejectedValueOnce(new Error('connection failed'));
 await expect(claimModel([],'openai','batch')).rejects.toThrow('connection failed');expect(sql).toHaveBeenCalledTimes(2);
});
