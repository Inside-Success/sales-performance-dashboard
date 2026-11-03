import { describe, expect, it } from 'vitest';
import { getRevampKnowledge } from '../../../src/lib/ask-sales-faq/revamp/knowledge';
import { retrieveEvidence } from '../../../src/lib/ask-sales-faq/revamp/retrieval';
import type { Plan } from '../../../src/lib/ask-sales-faq/revamp/types';
const corpus=getRevampKnowledge();
const plan=(question:string):Plan=>({intent:'company_question',question,queries:[],scopes:[]});
describe('current operating rules remain attached to historical evidence',()=>{
 it.each([
  'Explain the twenty percent dial out procedure',
  'Do I write my name beside 75 people on the spreadsheet?',
  'Where should I record the outcome after contacting my outreach batch?',
 ])('retrieves the HubSpot cutover across paraphrases: %s',q=>{
  const ids=retrieveEvidence(corpus,q,plan(q)).map(r=>r.record.id);
  expect(ids).toContain('outbound-hubspot-assignment-2026-10-07');expect(ids.length).toBeLessThanOrEqual(36);
 });
 it.each(['What time must I stop calling leads?','How late can I dial outbound?','Can I make extra calls after eight tonight?'])('retrieves current calling hours: %s',q=>{
  expect(retrieveEvidence(corpus,q,plan(q)).map(r=>r.record.id)).toContain('outbound-calling-hours-2026-10-14');
 });
 it('removes the superseded outbound cutoff while retaining separate email timing and scheduled-call exceptions',()=>{
  expect(corpus.some(r=>r.id==='operational_1871230cd437435b')).toBe(false);
  expect(corpus.find(r=>r.id==='main-pre-call1-confirmation-email-scope')?.text).toContain('9 PM');
  expect(corpus.find(r=>r.id==='outbound-calling-hours-2026-10-14')?.text).toContain('Sunday reality Call 1');
 });
 it('keeps current policy before any retrieved historical record that depends on it',()=>{
  const dependent=corpus.filter(r=>r.conditions.includes('governing_evidence:outbound-hubspot-assignment-2026-10-07'));
  expect(dependent.length).toBeGreaterThan(10);
  for(const record of dependent){
   const q=record.title;const ids=retrieveEvidence(corpus,q,plan(q),36).map(r=>r.record.id);
   if(ids.includes(record.id)) expect(ids.indexOf('outbound-hubspot-assignment-2026-10-07')).toBeGreaterThanOrEqual(0);
  }
 });
 it('retains distinct Slack coordination and real ownership checks',()=>{
  const r=corpus.find(r=>r.id==='didnt-book-lead-slack-coordination-2026-11-03');
  expect(r?.text).toContain('separate HubSpot Outreach Assign');
  expect(corpus.some(r=>r.id==='v3src_previously_claimed_twenty_percent_lead')).toBe(true);
 });
 it('does not invent a KPI denominator or automated notification schedule',()=>{
  expect(corpus.find(r=>r.id==='sales-kpi-expectations-and-definition-boundary-2026-11-03')?.text).toContain('does not explicitly define');
  expect(corpus.find(r=>r.id==='manual-booking-calendar-sops-2026-10-07')?.text).toContain('Do not invent a universal');
 });
});
