import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
const route = vi.hoisted(()=>({pathname:'/admin'}));
vi.mock('next/navigation',()=>({usePathname:()=>route.pathname}));
vi.mock('@/components/dashboard/profile-menu',()=>({ProfileMenu:()=>null}));
import {HeaderVisibility} from '@/components/dashboard/header-visibility';
import {ADMIN_DIRECTORY_LINKS} from '@/lib/admin-directory';

it.each(['/admin','/manager/usage','/ask-sales-faq/admin/usage'])('keeps everyday tools reachable from %s without marking a tool active',pathname=>{
 route.pathname=pathname;
 const html=renderToStaticMarkup(<HeaderVisibility userName="Admin" userEmail="admin@example.com" adminLinks={ADMIN_DIRECTORY_LINKS} />);
 const tools=html.match(/<nav aria-label="Switch tools"[\s\S]*?<\/nav>/)?.[0];
 expect(tools).toContain('href="/coaching"');
 expect(tools).toContain('href="/ask-sales-faq"');
 expect(tools).not.toContain('aria-current');
});
it('keeps the sign-in page free of navigation',()=>{
 route.pathname='/sign-in';
 expect(renderToStaticMarkup(<HeaderVisibility userName="Admin" userEmail="admin@example.com" adminLinks={ADMIN_DIRECTORY_LINKS} />)).toBe('');
});
