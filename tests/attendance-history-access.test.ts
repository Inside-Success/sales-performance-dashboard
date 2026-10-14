import {beforeEach,describe,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({auth:vi.fn(),analytics:vi.fn()}));
vi.mock('@/auth',()=>({auth:mocks.auth}));vi.mock('@/lib/rep-no-show',()=>({getRepNoShowAnalytics:mocks.analytics}));
import {GET} from '@/app/api/admin/rep-no-show/history/route';
beforeEach(()=>vi.clearAllMocks());
describe('attendance history authorization',()=>{
 it('does not fetch history for unsigned or ordinary rep accounts',async()=>{
  for(const session of [null,{user:{email:'ordinary@insidesuccess.com'}}]){mocks.auth.mockResolvedValue(session);expect([401,403]).toContain((await GET()).status);}
  expect(mocks.analytics).not.toHaveBeenCalled();
 });
 it('returns unavailable rather than a successful empty history after a read failure',async()=>{
  mocks.auth.mockResolvedValue({user:{email:'syed.haider@insidesuccess.com'}});mocks.analytics.mockResolvedValue({summary:{error:'timeout'}});expect((await GET()).status).toBe(503);
 });
});
