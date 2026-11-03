import {beforeEach,expect,it,vi} from 'vitest';
const {sql}=vi.hoisted(()=>({sql:vi.fn()}));
vi.mock('server-only',()=>({}));vi.mock('@neondatabase/serverless',()=>({neon:()=>sql}));
import {readOperatorHealth} from '@/lib/script-adherence/health';
beforeEach(()=>{sql.mockReset();});
it('does not read or expose diagnostics for other managers or anonymous users',async()=>{for(const email of [null,undefined,'manager@example.com','syed.haider@insidesuccess.com.attacker.test'])expect(await readOperatorHealth(email)).toBeNull();expect(sql).not.toHaveBeenCalled();});
it('shows unavailable rather than a healthy zero when the status read fails',async()=>{sql.mockRejectedValue(new Error('connection'));expect((await readOperatorHealth('syed.haider@insidesuccess.com'))?.state.label).toBe('Status unavailable');});
