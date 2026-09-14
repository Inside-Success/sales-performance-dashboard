import { describe,it,expect } from 'vitest';
import { usageReportLabel,parseUsagePeriod,summarizeUsage,type UsageReportRow } from '../src/lib/usage-overview';
const now=Date.parse('2026-09-12T12:00:00Z');
function row(id:number|null,extra:Partial<UsageReportRow>={}):UsageReportRow {return {rep_slug:'a',rep_name:'A',id,client_name:'Client',available_at:'2026-09-01T00:00:00Z',own_opened_at:null,own_engaged:false,last_opened_at:null,other_opened:10,...extra};}
describe('owner report overview',()=>{
 it('keeps all reps and counts beyond old 75/25 caps',()=>{const result=summarizeUsage(Array.from({length:126},(_,i)=>row(i,{rep_slug:String(i),rep_name:String(i)})),now);expect(result.reps).toHaveLength(126);expect(result.overdue).toBe(126);});
 it('does not count other report activity as an owner open',()=>{const result=summarizeUsage([row(1)],now);expect(result.opened).toBe(0);expect(result.overdue).toBe(1);expect(result.reps[0].otherOpened).toBe(10);});
 it('deduplicates report rows and counts an owner open only once',()=>{const a=row(1,{own_opened_at:'2026-09-03T00:00:00Z',own_engaged:true});const r=summarizeUsage([a,a],now);expect(r.available).toBe(1);expect(r.opened).toBe(1);expect(r.overdue).toBe(0);});
 it('keeps new unopened reports out of overdue and handles exactly 48 hours',()=>{const r=summarizeUsage([row(1,{available_at:'2026-09-12T00:00:00Z'}),row(2,{available_at:'2026-09-10T12:00:00Z'})],now);expect(r.overdue).toBe(1);expect(r.reps[0].unopened).toHaveLength(2);expect(r.reps[0].unopened[0].id).toBe(2);});
 it('does not penalize reps without reports or count them in adoption denominator',()=>{const r=summarizeUsage([row(null),row(2,{rep_slug:'b',rep_name:'B',own_opened_at:'2026-09-02'})],now);expect(r.reps).toHaveLength(2);expect(r.repsWithReports).toBe(1);expect(r.repsOpening).toBe(1);expect(r.overdue).toBe(0);});
 it('places overdue reports before newly unopened reports',()=>{const r=summarizeUsage([row(1,{rep_slug:'new',available_at:'2026-09-12T00:00:00Z'}),row(2,{rep_slug:'old'})],now);expect(r.reps[0].slug).toBe('old');});
 it('accepts supported periods and safely defaults unknown bookmarks',()=>{expect(parseUsagePeriod('all')).toBeNull();expect(parseUsagePeriod('30')).toBe(30);expect(parseUsagePeriod()).toBe(7);expect(parseUsagePeriod('bad')).toBe(7);});
});

it('does not expose obvious extracted prose as a client name',()=>{expect(usageReportLabel("who explicitly references two calls")).toBe('Coaching report');expect(usageReportLabel('Anna')).toBe('Anna');expect(usageReportLabel(null)).toBe('Coaching report');});

import { matchesUsageFilter, usagePercent } from '../src/lib/usage-overview';
const day=86400000;
const at=(days:number)=>new Date(now-days*day).toISOString();
it('keeps owner history for filters without counting older reports in the selected period',()=>{
 const r=summarizeUsage([row(1,{available_at:at(3)}),row(2,{available_at:at(50),last_own_opened_at:at(1),own_opened_at:at(40)})],now,7).reps[0];
 expect(r.available).toBe(1);expect(r.opened).toBe(0);expect(r.lastOwnOpened).toBe(at(1));expect(matchesUsageFilter(r,'never',now)).toBe(false);expect(matchesUsageFilter(r,'inactive',now)).toBe(false);
});
it('does not call new recipients inactive or never users without overdue feedback',()=>{
 const r=summarizeUsage([row(1,{available_at:at(1)})],now,7).reps[0];
 expect(matchesUsageFilter(r,'never',now)).toBe(false);expect(matchesUsageFilter(r,'inactive',now)).toBe(false);
});
it('distinguishes never opened from previously active using owner history',()=>{
 const never=summarizeUsage([row(1,{available_at:at(3),last_opened_at:at(1)})],now,7).reps[0];
 expect(matchesUsageFilter(never,'never',now)).toBe(true);
 const inactive=summarizeUsage([row(1,{available_at:at(3)}),row(2,{available_at:at(30),own_opened_at:at(20)})],now,7).reps[0];
 expect(matchesUsageFilter(inactive,'never',now)).toBe(false);expect(matchesUsageFilter(inactive,'inactive',now)).toBe(true);
});
it('compares equal 48-hour observation windows and excludes immature reports',()=>{
 const r=summarizeUsage([row(1,{available_at:at(3),own_opened_at:at(1)}),row(2,{available_at:at(8),own_opened_at:at(5)}),row(3,{available_at:at(10),own_opened_at:at(9)}),row(4,{available_at:at(1),own_opened_at:at(0)})],now,7);
 expect(r.comparison).toEqual({current:{available:2,opened:1},previous:{available:1,opened:1}});
 expect(r.available).toBe(2);
});
it('handles comparison boundaries, no reports and all-time without fabricated trends',()=>{
 const r=summarizeUsage([row(1,{available_at:at(2)}),row(2,{available_at:at(9)}),row(3,{available_at:at(16)})],now,7);
 expect(r.comparison).toEqual({current:{available:1,opened:0},previous:{available:1,opened:0}});
 expect(summarizeUsage([],now).comparison).toBeNull();expect(usagePercent(0,0)).toBeNull();expect(usagePercent(1,3)).toBe(33);
});
