import {beforeEach,describe,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({state:{} as Record<string,unknown>,busy:false,sql:vi.fn(),read:vi.fn(),delivered:[] as {source_id:string}[]}));
vi.mock('@neondatabase/serverless',()=>({neon:()=>mocks.sql}));
vi.mock('./source-read',()=>({readAirtablePage:mocks.read}));
import {coachingCoverage} from './coaching-coverage';
beforeEach(()=>{
  vi.stubEnv('DATABASE_URL','isolated-test');vi.stubEnv('AIRTABLE_API_KEY','isolated-test');
  mocks.state={};mocks.busy=false;mocks.delivered=[];mocks.sql.mockReset();mocks.read.mockReset();
  mocks.sql.mockImplementation(async(strings:TemplateStringsArray,...args:unknown[])=>{
    const query=strings.join('?');
    if(query.includes('select payload'))return [{payload:mocks.state}];
    if(query.includes('set owner=?'))return mocks.busy?[]:[{payload:mocks.state}];
    if(query.includes('from performance_calls'))return mocks.delivered;
    if(query.includes('set payload=')){mocks.state=JSON.parse(args[0] as string);return [{id:1}];}
    return [];
  });
});
describe('bounded source-to-report coverage',()=>{
  it('retains a page until acknowledged so a stopped n8n consumer cannot lose missing sources',async()=>{
    mocks.read.mockResolvedValue(new Response(JSON.stringify({records:[{id:'recMissing'},{id:'recDelivered'}]})));
    mocks.delivered=[{source_id:'recDelivered'}];
    const first=await coachingCoverage('scan');if(!('token' in first))throw Error('Expected ready scan');
    expect(first).toMatchObject({status:'ready',checked:2,source_ids:['recMissing']});
    expect(await coachingCoverage('scan')).toEqual(first);expect(mocks.read).toHaveBeenCalledTimes(1);
    await expect(coachingCoverage('ack',first.token,['recOther'])).rejects.toThrow('mismatch');
    expect(await coachingCoverage('ack','stale')).toEqual({status:'superseded'});
    expect(await coachingCoverage('ack',first.token,['recMissing'])).toEqual({status:'acknowledged'});
    expect(mocks.state).toMatchObject({reported:['recMissing'],unresolved:['recMissing'],revision:'source-accounting-2026-10-19'});
  });
  it('paginates at most five pages and resumes the frozen window only after acknowledgement',async()=>{
    for(let i=0;i<5;i++)mocks.read.mockResolvedValueOnce(new Response(JSON.stringify({records:[{id:'recPage'+i}],offset:'offset'+i})));
    const first=await coachingCoverage('scan');if(!('token' in first))throw Error('Expected ready scan');expect(first.checked).toBe(5);expect(mocks.read).toHaveBeenCalledTimes(5);
    const windowEnd=first.end;await coachingCoverage('ack',first.token,[]);
    expect(mocks.state).toMatchObject({offset:'offset4',end:windowEnd});
    mocks.read.mockResolvedValueOnce(new Response(JSON.stringify({records:[]})));
    const next=await coachingCoverage('scan');if(!('end' in next))throw Error('Expected ready scan');expect(next.end).toBe(windowEnd);
    expect(String(mocks.read.mock.calls[5][0])).toContain('offset=offset4');
  });
  it('accounts for explicit intake exclusions without false missing-report alerts',async()=>{
    mocks.read.mockResolvedValue(new Response(JSON.stringify({records:[{id:'recNoShow',fields:{'AI Decision Reason':'sales_no_show: Waiting alone'}},{id:'recReal',fields:{'AI Decision Reason':'valid_sales_call: A close attempt'}}]})));
    expect(await coachingCoverage('scan')).toMatchObject({status:'ready',checked:2,source_ids:['recReal']});
  });
  it('does not advance cursor or publish empty success when source fails',async()=>{
    mocks.state={offset:'saved',end:'2026-10-18T00:00:00.000Z'};
    mocks.read.mockResolvedValue(new Response('unavailable',{status:503}));
    await expect(coachingCoverage('scan')).rejects.toThrow('HTTP 503');
    expect(mocks.state).toEqual({offset:'saved',end:'2026-10-18T00:00:00.000Z'});
  });
  it('restarts an expired source cursor safely and retains notification deduplication',async()=>{
    mocks.state={revision:'source-accounting-2026-10-19',offset:'expired',end:'2026-10-18T00:00:00.000Z',reported:['recKnown'],unresolved:['recKnown']};
    mocks.read.mockResolvedValue(new Response('expired',{status:422}));
    await expect(coachingCoverage('scan')).rejects.toThrow('HTTP 422');expect(mocks.state).toMatchObject({reported:['recKnown'],unresolved:['recKnown']});expect(mocks.state.offset).toBeUndefined();
  });
  it('refuses malformed source pages and respects a competing scan lease',async()=>{
    mocks.read.mockResolvedValue(new Response(JSON.stringify({records:[{id:'not-a-source'}]})));
    await expect(coachingCoverage('scan')).rejects.toThrow('Invalid coverage page');
    mocks.busy=true;expect(await coachingCoverage('scan')).toEqual({status:'busy',source_ids:[]});
  });
  it('discovers by readiness time, migrates the old query cursor and retains older unresolved calls',async()=>{
    mocks.state={offset:'old-query-token',reported:['recOld']};
    mocks.read.mockResolvedValue(new Response(JSON.stringify({records:[]})));
    const scan=await coachingCoverage('scan');
    expect(scan).toMatchObject({source_ids:['recOld']});
    const url=new URL(mocks.read.mock.calls[0][0]);
    expect(url.searchParams.get('filterByFormula')).toContain('IF({Ingested At},{Ingested At},CREATED_TIME())');
    expect(url.searchParams.has('offset')).toBe(false);
  });
  it('closes retained calls only after a confirmed report or an accounted exclusion',async()=>{
    mocks.state={revision:'source-accounting-2026-10-19',unresolved:['recOld','recExcluded']};
    mocks.delivered=[{source_id:'recOld'}];
    mocks.read.mockResolvedValue(new Response(JSON.stringify({records:[]})));
    const scan=await coachingCoverage('scan');if(!('token'in scan))throw Error('Expected ready');
    expect(scan).toMatchObject({source_ids:['recOld','recExcluded'],delivered_ids:['recOld']});
    await coachingCoverage('ack',scan.token,[]);expect(mocks.state.unresolved).toEqual([]);
  });
  it('renotifies unresolved cases after a day without dropping them outside the discovery window',async()=>{
    mocks.state={revision:'source-accounting-2026-10-19',unresolved:['recOld'],reported:['recOld'],reminder_at:'2020-01-01'};
    mocks.read.mockResolvedValue(new Response(JSON.stringify({records:[]})));
    expect(await coachingCoverage('scan')).toMatchObject({source_ids:['recOld'],reported:[]});
  });
});
