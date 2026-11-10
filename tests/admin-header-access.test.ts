import { beforeEach, expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({auth:vi.fn()}));
vi.mock('@/auth',()=>({auth:mocks.auth}));
import {AppHeader} from '@/components/dashboard/app-header';
beforeEach(()=>vi.clearAllMocks());
it.each([null,'regular.rep@insidesuccess.com'])('does not serialize admin links for %s',async email=>{
 mocks.auth.mockResolvedValue(email?{user:{email}}:null);
 const header=await AppHeader();expect(header.props.adminLinks).toEqual([]);
});
it('supplies the authorized destination projection from the server session',async()=>{
 mocks.auth.mockResolvedValue({user:{email:'syed.haider@insidesuccess.com',name:'Syed'}});
 const header=await AppHeader();expect(header.props.adminLinks).toHaveLength(11);expect(header.props.userName).toBe('Syed');
});
