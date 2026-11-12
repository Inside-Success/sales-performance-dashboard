import { describe, expect, it } from 'vitest';
import { getRevampKnowledge } from '../../../src/lib/ask-sales-faq/revamp/knowledge';
import { retrieveEvidence } from '../../../src/lib/ask-sales-faq/revamp/retrieval';
const records=getRevampKnowledge();
const evidence=(question:string)=>retrieveEvidence(records,question,{intent:'company_question',question,scopes:['main_istv','reality'],queries:[]}).map(x=>x.record.text).join('\n');
describe('November 12 source conditions survive retrieval',()=>{
 it('keeps two-card payment permission together with the unchanged initial minimum',()=>{
  const t=evidence('Can a buyer use two cards for their initial reality payment?');
  expect(t).toContain('split one person’s approved $5,000');
  expect(t).toContain('does not create a $2,500 minimum');
  expect(t).toContain('not automatically approved');
 });
 it('retrieves the leadership legal-review exception without authorizing pay-first pressure',()=>{
  const t=evidence('Does no Call 3 mean rejecting a prospect who came back after checking with their lawyer?');
  expect(t).toContain('Mike explicitly approved a follow-up');
  expect(t).toContain('do not charge first and check legality later');
 });
 it('keeps client quiet hours separate from appointment display timezone',()=>{
  const t=evidence('What time zone do automated SMS reminders use and can they send overnight?');
  expect(t).toContain('8 AM and 8 PM');
  expect(t).toContain('booking-timezone appointment display');
  expect(t).toContain('do not claim all delivery failures are solved');
 });
 it('retrieves audit exclusions with contact-hour and verification protections',()=>{
  const t=evidence('What about late evening bookings and self booked outbound in the preparation audit?');
  expect(t).toContain('after 6 PM EST');
  expect(t).toContain('self-booked');
  expect(t).toContain('actual appointment/call evidence');
 });
 it('does not turn an internal marketing tax comment into a client deduction promise',()=>{
  const t=evidence('Can I tell a prospect the license fee is a tax write-off because Rudy called it marketing?');
  expect(t).toContain('reps are not allowed to tell clients');
  expect(t).toContain('own accountant');
 });
});

it('removes obsolete default timing while preserving the Friday exception',()=>{
 expect(records.some(x=>['claim_e48b234c260720af','operational_77537b341aeac5ce','operational_c2e41aa9e17fc9b6'].includes(x.id))).toBe(false);
 expect(records.some(x=>x.id==='curated_8a9c0c6ea1953a5a')).toBe(true);
});
