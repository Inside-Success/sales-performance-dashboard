import { describe, expect, it } from 'vitest';
import { getRevampKnowledge } from '../../../src/lib/ask-sales-faq/revamp/knowledge';
import { retrieveEvidence } from '../../../src/lib/ask-sales-faq/revamp/retrieval';
import type { Plan } from '../../../src/lib/ask-sales-faq/revamp/types';
const records=getRevampKnowledge();
const rows=(question:string,scope:Plan['scopes'][number]='main_istv')=>retrieveEvidence(records,question,{intent:'company_question',question,scopes:[scope],queries:[]}).map(x=>x.record);
describe('October 3 source refresh',()=>{
 it('brings scoped cutover with legacy daily-stats and greenlight instructions',()=>{
  for(const q of ['Where do I submit daily stats?','Where should I send the greenlight approval?']){
   expect(rows(q,'main_istv').map(r=>r.id)).toContain('hubspot-daily-stats-cutover-2026-10-03');
  }
  const cutover=records.find(r=>r.id==='hubspot-daily-stats-cutover-2026-10-03')!;
  expect(cutover.text).toContain('EXCLUDING DJ');expect(cutover.text).toContain('daily call-review');
 });
 it('retrieves live show status without reviving full Island S1 or Match House',()=>{
  expect(rows('What reality shows are open?','reality').map(r=>r.id)).toContain('reality-catalog-status-2026-10-03');
  expect(rows('Is Island season one available?','reality').map(r=>r.id)).toContain('reality-season-schedule-2026-10-03');
  expect(records.some(r=>r.id==='reality-season-schedule-2026-10-01')).toBe(false);
 });
 it('pairs reality package benefits with current guest limits and mini-doc scope',()=>{
  const ids=rows('What does reality VIP include?','reality').map(r=>r.id);
  expect(ids).toContain('reality-guests-and-accommodation-2026-10-03');
  expect(ids).toContain('reality-mini-documentary-production-2026-10-03');
  expect(records.some(r=>r.id==='reality-documentary-early-studio-2026-09-22')).toBe(false);
 });
 it('retrieves the correction with regular Lite benefits but excludes it from reality',()=>{
  expect(rows('Does Lite include a podcast and email blast?','main_istv').map(r=>r.id)).toContain('regular-lite-video-corrections-2026-10-03');
  expect(rows('Does Lite include a podcast and email blast?','reality').map(r=>r.id)).not.toContain('regular-lite-video-corrections-2026-10-03');
 });
 it('finds updated Q&A and practical HubSpot instructions',()=>{
  expect(rows('When is Raul morning Q&A?').map(r=>r.id)).toContain('new-rep-first-two-weeks-qa-2026-10-03');
  expect(rows('How do I create an email template in HubSpot?').map(r=>r.id)).toContain('hubspot-email-templates-2026-10-03');
 });
});
