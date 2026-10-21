import {beforeEach,describe,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({query:vi.fn(),after:vi.fn()}));
vi.mock('@neondatabase/serverless',()=>({neon:()=>({query:m.query})}));
vi.mock('next/server',()=>({after:m.after}));
import {getReadSnapshot,refreshReadSnapshot} from './dashboard-read-snapshot';
describe('dashboard snapshot freshness',()=>{
 beforeEach(()=>{vi.clearAllMocks();process.env.DATABASE_URL='test';delete process.env.MAGIC_MIKE_READ_SNAPSHOTS_ENABLED;m.query.mockResolvedValue([]);});
 it('reads the latest database snapshot on each request, without a second cache',async()=>{
 let time=new Date(Date.now()-600000).toISOString();m.query.mockImplementation(async(q:string)=>q.startsWith('select payload')?[{payload:{count:time},fetched_at:time,failed_at:null}]:[]);
 const spec={key:'test',maxAgeSeconds:300,load:vi.fn()};
 expect((await getReadSnapshot(spec)).data).toEqual({count:time});time=new Date(Date.now()-300000).toISOString();
 expect((await getReadSnapshot(spec)).data).toEqual({count:time});expect(spec.load).not.toHaveBeenCalled();
 });
 it('keeps scheduled snapshots warm after inactivity and retains one refresh owner',async()=>{
 m.query.mockImplementation(async(q:string)=>q.includes('returning key')?[{key:'test'}]:[]);
 const load=vi.fn().mockResolvedValue({count:2});expect(await refreshReadSnapshot({key:'test',maxAgeSeconds:300,load},true)).toBe('refreshed');
 const claim=m.query.mock.calls.find(([q])=>q.includes('insert into dashboard_read_snapshots'))![0];
 expect(claim).not.toContain("interval '30 minutes'");expect(claim).toContain('lease_until<now()');
 });
 it('a busy refresh does not read the external source again',async()=>{
 const load=vi.fn();expect(await refreshReadSnapshot({key:'test',maxAgeSeconds:300,load},true)).toBe('fresh_or_refreshing');expect(load).not.toHaveBeenCalled();
 });
 it('a source timeout never overwrites the last successful payload',async()=>{
 m.query.mockImplementation(async(q:string)=>q.includes('insert into dashboard_read_snapshots')?[{key:'test'}]:[]);
 await expect(refreshReadSnapshot({key:'test',maxAgeSeconds:300,load:async()=>{throw Error('timeout')}})).rejects.toThrow('timeout');
 expect(m.query.mock.calls.some(([q])=>q.includes('set payload='))).toBe(false);
 });
});
