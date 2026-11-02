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
