import { describe, expect, it } from 'vitest';
import { getRevampKnowledge } from '../../../src/lib/ask-sales-faq/revamp/knowledge';
import { retrieveEvidence } from '../../../src/lib/ask-sales-faq/revamp/retrieval';
import type { Plan } from '../../../src/lib/ask-sales-faq/revamp/types';
const records=getRevampKnowledge();
const rows=(question:string,scope:Plan['scopes'][number]='main_istv')=>retrieveEvidence(records,question,{intent:'company_question',question,scopes:[scope],queries:[]}).map(x=>x.record);
describe('October 7 knowledge refresh',()=>{
 it('retrieves the HubSpot lead cutover and excludes retired spreadsheet instructions',()=>{
  expect(rows('Where do I get my 20% outbound leads now?').map(r=>r.id)).toContain('outbound-hubspot-assignment-2026-10-07');
  expect(records.some(r=>['outbound-sheet-edit-columns','outbound-75-leads-2026-09-18'].includes(r.id))).toBe(false);
 });
 it('keeps current training and the cancellation exception retrievable',()=>{
  const training=rows('Who teaches Call 1 and closing training?').map(r=>r.text).join('\n');
  expect(training).toContain('Call 1 Sales Training with Raul');
  expect(training).toContain('Contracts & Onboarding with Raul');
  expect(rows('The client texted to cancel but OnceHub will not let me after the start time').map(r=>r.id)).toContain('client-requested-cancellation-2026-10-07');
 });
 it('preserves product scope for the media pack and email-close exception',()=>{
  expect(rows('What is in the new reality social media pack?','reality').map(r=>r.id)).toContain('reality-media-pack-2026-10-07');
  expect(rows('Can I close a documentary client over email if Zoom does not work?','main_istv').map(r=>r.id)).toContain('documentary-email-close-zoom-exception-2026-10-07');
  expect(rows('Can I close a reality client over email if Zoom does not work?','reality').map(r=>r.id)).not.toContain('documentary-email-close-zoom-exception-2026-10-07');
 });
 it('finds current review and payment guidance using natural questions',()=>{
  expect(rows('I had no Call 1 or Call 2 today, what do I post for call review?').map(r=>r.id)).toContain('daily-call-review-2026-09-23');
  expect(rows('Must I retry the failed payment three times before using emergency link?').map(r=>r.id)).toContain('payment-failed-attempts-2026-10-01');
 });
});
