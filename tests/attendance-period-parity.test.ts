import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock('@/lib/source-read',()=>({readAirtablePage:(url:string)=>fetch(url)}));
vi.mock('next/cache',()=>({unstable_cache:(fn:unknown)=>fn}));
vi.mock('@/lib/dashboard-read-snapshot',()=>({getReadSnapshot:async(spec:{load:()=>Promise<unknown>})=>({data:await spec.load(),fetchedAt:new Date().toISOString(),stale:false,refreshFailed:false}),snapshotWarning:()=>undefined}));
import {buildAttendanceSnapshot, getRepNoShowAnalytics} from '@/lib/rep-no-show';
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();vi.unstubAllEnvs();});
describe('attendance date windows and retained history',()=>{
 it('keeps distinct counts, deduplication and old history for all four ranges',async()=>{
  vi.stubEnv('AIRTABLE_API_KEY','test');vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-15T00:00:00Z'));
  const record=(id:string,date:string,absent=true)=>({id,fields:{'Rep Name':'Example Rep','Client Name':'Example Client','Meeting ID':id,'Meeting Start Date':date,'Ingested At':date,'Call #':'Call 2+','AI Decision Reason':`attendance_status=${absent?'rep_no_show':'present'}: evidence`}});
  const rows=[record('new','2026-10-14T12:00:00Z'),record('present','2026-10-08T12:00:00Z',false),record('fortnight','2026-10-03T12:00:00Z'),record('month','2026-09-20T12:00:00Z'),record('old','2026-08-20T12:00:00Z')];
  rows.push({...rows[0],id:'duplicate'});
  vi.stubGlobal('fetch',vi.fn().mockImplementation(async()=>Response.json({records:rows})));
  const compact = buildAttendanceSnapshot(rows);
  expect(compact.history).toHaveLength(4);
  expect(compact.periods[7].noShowLog).toHaveLength(1);
  for(const [days,eligible,noShows] of [[7,2,1],[14,3,2],[30,4,3],[90,5,4]] as const){
   const result=await getRepNoShowAnalytics(days);expect(result.summary.eligibleCalls).toBe(eligible);expect(result.summary.repNoShows).toBe(noShows);expect(result.noShowLog).toHaveLength(4);expect(result.noShowLog.at(-1)?.id).toBe('old');
  }
 });
});
