import {expect,it,vi} from 'vitest';
const {query}=vi.hoisted(()=>({query:vi.fn()}));
vi.mock('server-only',()=>({}));
vi.mock('@neondatabase/serverless',()=>({neon:()=>query}));
import {getCoachingInsightCalls} from '@/lib/coaching-insights-data';
it('reads manual reports without assuming an official-only database column',async()=>{
 vi.stubEnv('DATABASE_URL','test-only');query.mockResolvedValue([{id:'manual-id',rep_name:'Sample Rep'}]);
 const rows=await getCoachingInsightCalls(30,'manual');
 expect(query.mock.calls[0][0].join('')).not.toContain('rep_slug');expect(rows[0].rep_slug).toBe('sample-rep');
 vi.unstubAllEnvs();
});
