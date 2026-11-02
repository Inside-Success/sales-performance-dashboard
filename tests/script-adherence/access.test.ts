import {expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({guard:vi.fn(),read:vi.fn()}));
vi.mock('@/lib/rep-scoring/access',()=>({requireRepScoringAdmin:mocks.guard}));
vi.mock('@/lib/script-adherence/data',()=>({readAdherence:mocks.read}));
vi.mock('@/app/manager/script-adherence/view',()=>({AdherenceView:()=>null}));
import Page from '@/app/manager/script-adherence/page';
it('does not read adherence data before authorization',async()=>{mocks.guard.mockRejectedValueOnce(Error('denied'));await expect(Page()).rejects.toThrow('denied');expect(mocks.read).not.toHaveBeenCalled();});
