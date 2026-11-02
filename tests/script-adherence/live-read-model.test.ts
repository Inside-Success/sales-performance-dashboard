import {expect,it,vi} from 'vitest';
vi.mock('server-only',()=>({}));
import {readAdherence} from '@/lib/script-adherence/data';
// Explicit opt-in read-only integration check. CI never depends on production data.
it.skipIf(process.env.ADHERENCE_LIVE_CHECK!=='1')('matches saved aggregate totals across server pages',async()=>{
 const filters={from:'',to:'',show:'',stage:''},a=await readAdherence(filters,'',1),b=await readAdherence(filters,'',2);
 expect(a.total).toBeGreaterThanOrEqual(42);expect(a.calls).toHaveLength(20);expect(b.overall).toEqual(a.overall);expect(b.total).toBe(a.total);
 expect(a.calls.some(c=>b.calls.some(d=>d.sourceKey===c.sourceKey))).toBe(false);
 expect(a.reps.reduce((n,r)=>n+r.total,0)).toBe(a.total);
 expect(a.reps.reduce((n,r)=>n+r.stats.complete,0)).toBe(a.overall.complete);
 console.log({total:a.total,assessed:a.overall.assessedCalls,complete:a.overall.complete,notComplete:a.overall.notComplete,pages:Math.ceil(a.total/20)});
});
