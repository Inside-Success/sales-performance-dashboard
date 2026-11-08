import { describe, expect, it } from 'vitest';
import { getRevampKnowledge } from '../../../src/lib/ask-sales-faq/revamp/knowledge';
import { retrieveEvidence } from '../../../src/lib/ask-sales-faq/revamp/retrieval';
import type { Plan } from '../../../src/lib/ask-sales-faq/revamp/types';
const records = getRevampKnowledge();
const evidence = (question: string, scope: Plan['scopes'][number] = 'main_istv') => retrieveEvidence(records, question, { intent: 'company_question', question, scopes: [scope], queries: [] }).map(x => x.record.text).join('\n');
describe('November 8 knowledge boundaries', () => {
 it('separates early arrival and preposted handoff from auto-zap waiting', () => {
  const text=evidence('Can I enter a pre-posted double booking at the scheduled start?');
  expect(text).toContain('pre-posted');
  expect(text).toContain('scheduled start');
  expect(evidence('My 3pm auto passoff client joined early at 2:55. When can I enter?')).toContain('3:03');
 });
 it('distinguishes deployed NLCEO reminders from unreleased second-call automation', () => {
  const text=evidence('Are Next Level CEO and second-call SMS reminders automatic now?');
  expect(text).toContain('Next Level CEO reminders are now active');
  expect(text).toContain('still not automated');
 });
 it('retrieves active documentary status despite a blank directory cell', () => {
  expect(evidence('Can I sell Dropout to CEO if its sheet status is blank?')).toContain('Dropout to CEO IS ACTIVE');
 });
 it('keeps gala purchase instructions separate from unconfirmed dates', () => {
  const text=evidence('How do I buy gala tickets for a plus one? Is February 21 confirmed?');
  expect(text).toContain('One buyer may purchase multiple tickets');
  expect(text).toContain('final 2027 event date is NOT confirmed');
 });
 it('does not promote a proposed commission penalty into active policy', () => {
  const text=evidence('Is commission now five percent on a third call?', 'reality');
  expect(text).toContain('does not establish a currently effective 5% commission rate');
 });
});
