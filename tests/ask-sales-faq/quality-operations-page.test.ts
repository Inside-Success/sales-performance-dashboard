import {renderToStaticMarkup} from 'react-dom/server';
import {describe,it,expect,vi,beforeEach} from 'vitest';
const mocks=vi.hoisted(()=>({access:vi.fn(),admin:vi.fn(),overview:vi.fn()}));
vi.mock('@/auth',()=>({auth:async()=>({})}));
vi.mock('@/lib/ask-sales-faq/access',()=>({getAskSalesFaqAccess:mocks.access,isAskSalesFaqAdmin:mocks.admin}));
vi.mock('@/lib/ask-sales-faq/admin/store',()=>({getConversationOverview:mocks.overview}));
vi.mock('@/lib/ask-sales-faq/revamp/knowledge',()=>({REVAMP_KNOWLEDGE_VERSION:'b093bfd070017710ec873413'}));
vi.mock('next/navigation',()=>({notFound:()=>{throw Error('Not found');}}));
import Page from '../../src/app/ask-sales-faq/admin/page';
beforeEach(()=>{mocks.access.mockReturnValue({ok:true,viewerEmail:'admin@example.com'});mocks.admin.mockReturnValue(true);mocks.overview.mockResolvedValue({metrics:{questions:1,people:1,up:0,down:1,failures:0},rows:[{id:'c1',name:'Rep',email:'rep@example.com',title:'Follow-up question',last_at:'2026-09-16T12:00:00Z',questions:1,messages:2,down:true,reviewed:false,total:1}],reps:[]});});
describe('manager conversation page',()=>{
 it('renders two navigation destinations, full conversation links and honest feedback labels',async()=>{const html=renderToStaticMarkup(await Page({searchParams:Promise.resolve({})}));expect(html).toContain('Conversations');expect(html).toContain('Usage');expect(html).not.toContain('Source updates');expect(html).toContain('/admin/conversations/c1?');expect(html).toContain('Marked unhelpful');expect(html).toContain('they do not prove an answer is wrong');});
 it('separates unavailable data from no activity',async()=>{mocks.overview.mockRejectedValue(Error('db'));const html=renderToStaticMarkup(await Page({searchParams:Promise.resolve({})}));expect(html).toContain('couldn’t load the data');expect(html).toContain('not a report of zero activity');expect(html).not.toContain('No conversations match');});
 it('rejects non-admins before querying conversations',async()=>{mocks.admin.mockReturnValue(false);await expect(Page({searchParams:Promise.resolve({})})).rejects.toThrow('Not found');expect(mocks.overview).not.toHaveBeenCalled();});
});
