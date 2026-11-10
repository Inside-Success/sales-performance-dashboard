import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, expect, it, vi } from 'vitest';
import { getAdminNavigationLinks } from '@/lib/admin-access-policy';
import { activeAdminLink, ADMIN_DIRECTORY_LINKS } from '@/lib/admin-directory';
import { AdminNavbar } from '@/components/dashboard/admin-navbar';

afterEach(()=>vi.unstubAllEnvs());
it('projects only permitted destinations, including FAQ-only legacy admins',()=>{
 vi.stubEnv('REP_SCORING_ADMIN_EMAILS','legacy.manager@insidesuccess.com');
 vi.stubEnv('ASK_SALES_FAQ_ADMIN_EMAILS','legacy.faq@insidesuccess.com');
 expect(getAdminNavigationLinks(null)).toEqual([]);
 expect(getAdminNavigationLinks('regular.rep@insidesuccess.com')).toEqual([]);
 expect(getAdminNavigationLinks('legacy.faq@insidesuccess.com').map(x=>x.href)).toEqual(['/ask-sales-faq/admin/usage','/ask-sales-faq/admin']);
 expect(getAdminNavigationLinks(' SYED.HAIDER@INSIDESUCCESS.COM ')).toEqual([...ADMIN_DIRECTORY_LINKS]);
 expect(getAdminNavigationLinks('legacy.manager@insidesuccess.com')).toHaveLength(11);
});
it('matches the most specific destination without confusing sibling and nested routes',()=>{
 expect(activeAdminLink('/ask-sales-faq/admin/usage',ADMIN_DIRECTORY_LINKS)?.navLabel).toBe('Usage');
 expect(activeAdminLink('/ask-sales-faq/admin',ADMIN_DIRECTORY_LINKS)?.navLabel).toBe('Conversations');
 expect(activeAdminLink('/manager/script-adherence/rep/some-rep',ADMIN_DIRECTORY_LINKS)?.navLabel).toBe('Script Adherence');
 expect(activeAdminLink('/manager/rep-scoring/v7-validation/call/123',ADMIN_DIRECTORY_LINKS)?.navLabel).toBe('Closer Scorecard');
 expect(activeAdminLink('/manager/usage-other',ADMIN_DIRECTORY_LINKS)).toBeUndefined();
 expect(activeAdminLink('/coaching',ADMIN_DIRECTORY_LINKS)).toBeUndefined();
});
it('renders nothing for reps and no forbidden groups for FAQ-only admins',()=>{
 expect(renderToStaticMarkup(<AdminNavbar pathname="/coaching" links={[]} />)).toBe('');
 vi.stubEnv('ASK_SALES_FAQ_ADMIN_EMAILS','legacy.faq@insidesuccess.com');
 const html=renderToStaticMarkup(<AdminNavbar pathname="/ask-sales-faq/admin/usage" links={getAdminNavigationLinks('legacy.faq@insidesuccess.com')} />);
 expect(html).toContain('Admin pages');expect(html).toContain('Admin Insights');expect(html).toContain('FAQ');
 for(const text of ['Sales Operations','Mock Calls','Objection Library','Closer Scorecard'])expect(html).not.toContain(text);
});

it('exposes every authorized page as a direct link without menu triggers',()=>{
 const html=renderToStaticMarkup(<AdminNavbar pathname="/manager/usage" links={ADMIN_DIRECTORY_LINKS} />);
 expect(html.match(/<a /g)).toHaveLength(12);
 expect(html).not.toContain('<button');
 expect(html).not.toContain('role="menu');
 for(const link of ADMIN_DIRECTORY_LINKS) expect(html).toContain(`href="${link.href}"`);
 expect(html).toContain('FAQ Usage');expect(html).toContain('FAQ Conversations');
 expect(html.match(/<a[^>]*href="\/manager\/usage"[^>]*>/)?.[0]).toContain('aria-current="page"');
 expect(html.match(/aria-current="page"/g)).toHaveLength(1);
 expect(html).toContain('target="_blank" rel="noopener noreferrer"');
});

it('marks only the specific FAQ destination on nested routes',()=>{
 const html=renderToStaticMarkup(<AdminNavbar pathname="/ask-sales-faq/admin/usage" links={ADMIN_DIRECTORY_LINKS} />);
 expect(html.match(/<a[^>]*href="\/ask-sales-faq\/admin\/usage"[^>]*>/)?.[0]).toContain('aria-current="page"');
 expect(html.match(/aria-current="page"/g)).toHaveLength(1);
});
