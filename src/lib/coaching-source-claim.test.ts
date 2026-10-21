import {beforeEach,describe,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({query:vi.fn(),read:vi.fn()}));
vi.mock('@neondatabase/serverless',()=>({neon:()=>({query:m.query})}));
vi.mock('./source-read',()=>({readAirtablePage:m.read}));
import {claimSource,reserveMissingSource,settleSource} from './coaching-source-claim';
describe('shared source ownership',()=>{
 beforeEach(()=>{vi.clearAllMocks();process.env.DATABASE_URL='test';process.env.AIRTABLE_API_KEY='test';m.query.mockResolvedValue([]);});
 it('never starts a call with an existing report',async()=>{
 m.query.mockImplementation(async(q:string)=>q.startsWith('select id')?[{id:1}]:[]);
 expect(await claimSource('recA','zoom:recording','123')).toEqual({acquired:false,status:'delivered'});
 expect(m.query.mock.calls.some(([q])=>q.startsWith('insert'))).toBe(false);
 });
 it('a different recording owner blocks another source',async()=>{
 m.query.mockImplementation(async(q:string)=>q.startsWith('select owner')?[{owner:'123',status:'running',source_id:'recA'}]:[]);
 expect(await claimSource('recB','zoom:recording','124')).toMatchObject({acquired:false,owner:'123'});
 const insert=m.query.mock.calls.find(([q])=>q.startsWith('insert'))!;
 expect(insert[0]).toContain('on conflict(identity)');expect(insert[0]).toContain('coaching_source_claims.source_id=$2');
 expect(insert[1]).toEqual(['zoom:recording','recB','124',false,null]);
 });
 it('settlement only releases the matching owner; uncertain outcomes are held',async()=>{
 await settleSource('recA','123','needs_review');const call=m.query.mock.calls.at(-1)!;
 expect(call[0]).toContain('owner=$2');expect(call[1]).toEqual(['recA','123','held']);
 await settleSource('recA','123','queued');expect(m.query.mock.calls.at(-1)![1]).toEqual(['recA','123','retryable']);
 });
 it('requires successful source and artifact reads before reserving',async()=>{
 m.read.mockResolvedValue({ok:false});await expect(reserveMissingSource('recA')).rejects.toThrow();expect(m.query).not.toHaveBeenCalled();
 });
 it('never reserves a source with a saved Airtable report',async()=>{
 m.read.mockResolvedValueOnce({ok:true,json:async()=>({id:'recA',fields:{'Processing Status':'Processed','Call #':'Call 2+','Meeting Transcript Link':'doc','Ingested At':'2026-01-01','Automation Key':'zoom:one'}})}).mockResolvedValueOnce({ok:true,json:async()=>({records:[{id:'report'}]})});
 expect(await reserveMissingSource('recA')).toMatchObject({reserved:false,reason:'existing_artifact'});expect(m.query).not.toHaveBeenCalled();
 });
});
