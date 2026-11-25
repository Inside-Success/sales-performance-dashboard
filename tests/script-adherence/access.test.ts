import {afterEach,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({guard:vi.fn(),read:vi.fn(),names:vi.fn(),health:vi.fn(),visible:false}));
vi.mock('@/lib/script-adherence/visibility',()=>({get scriptAdherenceVisible(){return mocks.visible;}}));
vi.mock('@/lib/rep-scoring/access',()=>({requireRepScoringAdmin:mocks.guard}));
vi.mock('@/lib/script-adherence/data',()=>({readAdherence:mocks.read,readRepNames:mocks.names}));
vi.mock('@/lib/script-adherence/health',()=>({readOperatorHealth:mocks.health}));
vi.mock('@/app/manager/script-adherence/view',()=>({AdherenceView:()=>null}));
import Page from '@/app/manager/script-adherence/page';
import RepPage from '@/app/manager/script-adherence/rep/[rep]/page';

const repPage = () => RepPage({params:Promise.resolve({rep:'Example'}),searchParams:Promise.resolve({})});
afterEach(() => { mocks.visible = false; vi.clearAllMocks(); });

it.each([['summary', () => Page({})], ['rep detail', repPage]])(
  'hides the %s route before access checks or data reads',
  async (_name, open) => {
    await expect(open()).rejects.toMatchObject({digest:'NEXT_HTTP_ERROR_FALLBACK;404'});
    expect(mocks.guard).not.toHaveBeenCalled();
    expect(mocks.read).not.toHaveBeenCalled();
    expect(mocks.names).not.toHaveBeenCalled();
    expect(mocks.health).not.toHaveBeenCalled();
  },
);

it.each([['summary', () => Page({})], ['rep detail', repPage]])(
  'authorizes the %s route before reading data when visible',
  async (_name, open) => {
    mocks.visible = true;
    mocks.guard.mockRejectedValueOnce(Error('denied'));
    await expect(open()).rejects.toThrow('denied');
    expect(mocks.read).not.toHaveBeenCalled();
    expect(mocks.names).not.toHaveBeenCalled();
    expect(mocks.health).not.toHaveBeenCalled();
  },
);
