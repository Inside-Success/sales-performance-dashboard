import { describe, expect, it } from 'vitest';
import { getRevampKnowledge } from '../../../src/lib/ask-sales-faq/revamp/knowledge';
import { retrieveEvidence } from '../../../src/lib/ask-sales-faq/revamp/retrieval';
import type { Plan } from '../../../src/lib/ask-sales-faq/revamp/types';
const records = getRevampKnowledge();
const evidence = (question: string, scope: Plan['scopes'][number] = 'main_istv') => retrieveEvidence(records, question, { intent: 'company_question', question, scopes: [scope], queries: [] }).map(x => x.record.text).join('\n');
describe('November 10 source changes', () => {
 it('retrieves the current affordability exception without reinstating a fixed Call 1 quote', () => {
  const text=evidence('Should I price check a financially unqualified reality applicant on the first call?', 'reality');
  expect(text).toContain('REMOVE the previous numerical minimum');
  expect(text).toContain('not package prices or payment plans');
 });
 it('distinguishes weekend booked-call confirmation from random Sunday dialing', () => {
  const text=evidence('Can I call Monday bookings on Sunday to confirm them?');
  expect(text).toContain('either Saturday or Sunday');
  expect(text).toContain('does not authorize random Sunday prospecting');
 });
 it('retrieves volume-specific Green Light allowances', () => {
  const text=evidence('I do fifteen calls daily; am I capped at fifteen greenlights per week?');
  expect(text).toContain('twenty-five to forty');
  expect(text).toContain('not permission to approve unsuitable');
 });
 it('keeps generated contracts separate from signed contracts', () => {
  const text=evidence('Does the HubSpot payment link generator give me a contract and an emergency link?');
  expect(text).toContain('not a signed contract');
 });
 it('retrieves a new show premise without inventing reality rules', () => {
  const text=evidence('What kind of show is Champions Reborn and who is it for?');
  expect(text).toContain('former professional athletes');
  expect(text).toContain('not an Island or Mansion-style reality competition');
 });
 it('retrieves separate accounts without claiming universal provisioning', () => {
  const text=evidence('Where are my reality meetings after the new businessrealitytv email?','reality');
  expect(text).toContain('@businessrealitytv.com');
  expect(text).toContain('Do not assume every rep');
 });
});
