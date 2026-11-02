import {beforeEach,expect,it,vi} from 'vitest';
import {createHash} from 'node:crypto';
const {sql}=vi.hoisted(()=>({sql:vi.fn()}));
vi.mock('@neondatabase/serverless',()=>({neon:()=>sql}));
import {POST} from '@/app/api/internal/script-adherence/dispatch/route';
const body={model:'claude-haiku-5-5',max_tokens:16000,messages:[]};
const id='a'.repeat(64);
const request=(token='test')=>new Request('https://example.test',{method:'POST',headers:{authorization:`Bearer ${token}`},body:JSON.stringify({requests:[{id,body}]})});
beforeEach(()=>{process.env.INGEST_SECRET='test';sql.mockReset();});
it('authenticates before database access',async()=>{expect((await POST(request('wrong'))).status).toBe(401);expect(sql).not.toHaveBeenCalled();});
it('only dispatches the database winner and does not replay a duplicate',async()=>{
 sql.mockResolvedValueOnce([{id}]).mockResolvedValueOnce([]);
 expect((await (await POST(request())).json()).requests).toHaveLength(1);
 expect((await (await POST(request())).json()).requests).toHaveLength(0);
 expect(sql.mock.calls[0]).toContain(createHash('sha256').update(JSON.stringify(body)).digest('hex'));
 expect(sql.mock.calls[0][0].join('')).toContain("r.status='reserved'");
});
it('holds a database failure without provider dispatch',async()=>{sql.mockRejectedValueOnce(Error('private details'));const r=await POST(request());expect(r.status).toBe(503);expect(await r.text()).not.toContain('private details');});
it('validates all requests before claiming any, preventing partial abandoned claims',async()=>{
 const r=new Request('https://example.test',{method:'POST',headers:{authorization:'Bearer test'},body:JSON.stringify({requests:[{id,body},{id:'b'.repeat(64),body:{model:'unknown',max_tokens:16000}}]})});
 expect((await POST(r)).status).toBe(503);expect(sql).not.toHaveBeenCalled();
});
it('dispatches Terra only with standard billing and its separate reservation floor',async()=>{
 sql.mockResolvedValueOnce([{id}]);
 const payload={model:'gpt-6.1-terra',max_completion_tokens:16000,service_tier:'default',messages:[]};
 const r=new Request('https://example.test',{method:'POST',headers:{authorization:'Bearer test'},body:JSON.stringify({requests:[{id,body:payload}]})});
 expect((await (await POST(r)).json()).requests).toHaveLength(1);expect(sql.mock.calls[0]).toContain(500000);expect(sql.mock.calls[0]).toContain('gpt-6.1-terra');
});
