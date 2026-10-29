import { describe, expect, it } from 'vitest';
import { getRevampKnowledge } from '../../../src/lib/ask-sales-faq/revamp/knowledge';
import { retrieveEvidence } from '../../../src/lib/ask-sales-faq/revamp/retrieval';
import type { Plan } from '../../../src/lib/ask-sales-faq/revamp/types';
const records = getRevampKnowledge();
const evidence = (question: string, scope: Plan['scopes'][number] = 'main_istv') => retrieveEvidence(records, question, { intent: 'company_question', question, scopes: [scope], queries: [] }).map(x => x.record.text).join('\n');
describe('October 29 source refresh', () => {
 it('retrieves changed Call 1 order without preserving the old imperative', () => {
  const text=evidence('Which reality video do I play first?', 'reality');
  expect(text).toContain('Video 2, the short show-specific');
  expect(text).toContain('Video 1, the longer');
  expect(text).not.toContain('Play the show-specific video at the end of the call');
 });
 it('keeps a real outbound Call distinct from the two Contact fields and protects opt-outs', () => {
  const text=evidence('Outreach says incomplete even though I filled note and outcome');
  expect(text).toContain('Contact fields alone are insufficient');
  expect(text).toContain('activity time and record creation both after assignment');
  expect(text).toContain('never redial an opt-out');
 });
 it('retrieves automatic SMS timing without authorizing duplicate messages', () => {
  const text=evidence('What time does the automated meeting day text go out?');
  expect(text).toContain('8 AM in the customer timezone');
  expect(text).toContain('Do not manually change these fields');
  expect(text).toContain('not blanket removal of rep confirmation calls');
 });
 it('does not manufacture a time for the added objection session', () => {
  const text=evidence('When is Thursday objection handling training?');
  expect(text).toContain('WITHOUT a time');
  expect(text).toContain('Thursday 2–3 PM EST Closing');
 });
 it('does not turn show money or provisional lodging into a benefit guarantee', () => {
  expect(evidence('Do I win a million dollars on Mansion of Money?', 'reality')).toContain('show money');
  const venue=evidence('Is the Island venue signed and is that house for cast?', 'reality');
  expect(venue).toContain('contract is not signed yet');
  expect(venue).toContain('participants are camping');
 });
});
