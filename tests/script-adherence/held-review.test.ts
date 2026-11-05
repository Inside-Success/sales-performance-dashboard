import{beforeEach,expect,it,vi}from'vitest';
const{sql}=vi.hoisted(()=>({sql:vi.fn()}));
vi.mock('@neondatabase/serverless',()=>({neon:()=>sql}));
import{reserveHeldReview}from'@/lib/script-adherence/held-review';
beforeEach(()=>sql.mockReset());
it('does not recover accepted, unsettled, mismatched or already recovered requests',async()=>{
 sql.mockResolvedValue([]);expect(await reserveHeldReview('job','prior')).toBeNull();
 const query=sql.mock.calls[0][0].join('');expect(query).toContain("j.state='held'");expect(query).toContain('r.actual_microusd is not null');expect(query).toContain('not exists');expect(sql).toHaveBeenCalledTimes(1);
});
it('reserves one distinct factual review while retaining the original paid request',async()=>{
 sql.mockResolvedValueOnce([{source_key:'source',transcript:'[00:01] Rep: Hello',title:'Title',rep:'Rep',payload:{choices:[{finish_reason:'stop',message:{content:'{}'}}]}}]).mockResolvedValueOnce([{id:'new'}]);
 const r=await reserveHeldReview('job','prior');expect(r?.originalRequestId).toBe('prior');expect(r?.body.model).toBe('gpt-6.1-terra');expect(JSON.stringify(r?.body)).toContain('FULL TRANSCRIPT');
 const query=sql.mock.calls[1][0].join('');expect(query).toContain("state='held'");expect(query).toContain('ceiling_microusd is null');expect(query).not.toContain('delete');expect(query).toContain('insert into script_adherence_requests');
});
it('refuses an incomplete original provider response',async()=>{
 sql.mockResolvedValueOnce([{payload:{choices:[{finish_reason:'length'}]}}]);await expect(reserveHeldReview('job','prior')).rejects.toThrow('Incomplete');expect(sql).toHaveBeenCalledTimes(1);
});
it('zero-charge revalidation refuses unmatched or already accepted requests',async()=>{
 const {revalidateHeldReview}=await import('@/lib/script-adherence/held-review');sql.mockResolvedValue([]);expect(await revalidateHeldReview('job','prior')).toEqual({published:false});expect(sql).toHaveBeenCalledTimes(1);expect(sql.mock.calls[0][0].join('')).toContain('r.actual_microusd is not null');
});
