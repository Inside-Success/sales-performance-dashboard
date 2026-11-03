import {expect,it} from 'vitest';
import {healthState,type HealthInput} from '@/lib/script-adherence/health-state';
const now=Date.parse('2026-11-03T12:00:00Z'),recent='2026-11-03T11:55:00Z';
const base:HealthInput={enabled:true,canary:0,active:0,held:0,errors:0,oldest:null,lastCheck:recent,coverage:recent,committed:10,ceiling:40,runnerError:false};
it('distinguishes intentionally paused processing from healthy active coverage',()=>{expect(healthState({...base,enabled:false,lastCheck:null},now).tone).toBe('neutral');expect(healthState(base,now).tone).toBe('good');});
it('shows normal pending batches without implying failure',()=>expect(healthState({...base,active:1,oldest:recent},now).tone).toBe('waiting'));
it('never displays healthy when runner, receipt, source or budget needs attention',()=>{for(const patch of [{lastCheck:null},{coverage:null},{held:1},{errors:1},{runnerError:true},{committed:40},{active:1,oldest:'2026-11-01T00:00:00Z'}])expect(healthState({...base,...patch},now).tone).toBe('attention');});
it('does not demand company-wide coverage from a scoped canary',()=>expect(healthState({...base,enabled:false,canary:4,coverage:null},now).label).toBe('Limited test'));
