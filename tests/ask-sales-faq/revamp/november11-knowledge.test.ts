import { describe, expect, it } from 'vitest';
import { getRevampKnowledge } from '../../../src/lib/ask-sales-faq/revamp/knowledge';
import { retrieveEvidence } from '../../../src/lib/ask-sales-faq/revamp/retrieval';
import type { Plan } from '../../../src/lib/ask-sales-faq/revamp/types';
const records = getRevampKnowledge();
const evidence = (question: string, scope: Plan['scopes'][number] = 'main_istv') => retrieveEvidence(records, question, { intent: 'company_question', question, scopes: [scope], queries: [] }).map(x => x.record.text).join('\n');
describe('November 11 source reconciliation', () => {
 it('retrieves current Island casting without guaranteeing an earlier slot', () => {
  const text=evidence('Can I put a new applicant into Island season 3 or are we on the next season?', 'reality');
  expect(text).toContain('Season 3 has just filled');
  expect(text).toContain('conditional on a real opening');
 });
 it('retrieves current Call 2 reminder rollout while preserving delivery verification', () => {
  const text=evidence('Are second call text reminders automated now?');
  expect(text).toContain('all SMS reminders are now live');
  expect(text).toContain('not proof any particular text was delivered');
 });
 it('preserves audit dispute review before calendar removal', () => {
  const text=evidence('My preparation call audit says red but I dialled everyone for tomorrow. Am I being removed?');
  expect(text).toContain('verified before anyone is removed');
  expect(text).toContain('actual appointment/call evidence');
 });
 it('retrieves preparation even after text confirmation without requalification', () => {
  const text=evidence('They already confirmed by text. Do I still make the preparation call?');
  expect(text).toContain('still needs the preparation call');
  expect(text).toContain('do not turn it into another full qualification');
 });
 it('does not reopen discontinued shows from historical concept questions', () => {
  const text=evidence('Can I sell Millionaire Match House and what are its living arrangements?', 'reality');
  expect(text).toContain('Millionaire Match House is no longer offered');
 });
 it('retrieves outbound price conflict without changing Call 1 pricing', () => {
  const text=evidence('The outbound booking script says both 8000 and 10000 minimum. Which is right?');
  expect(text).toContain('internal pricing inconsistency');
  expect(text).toContain('narrow nonnumeric financial-fit exception');
 });
 it('retrieves meeting confidentiality instead of publishing illustrative challenges', () => {
  const text=evidence('Can I send the November 10 production challenge slides to a prospect?', 'reality');
  expect(text).toContain('illustrative/fake and confidential');
 });
});

it('replaces retired approver references without deleting genuine emergency exceptions', () => {
 const text=evidence('Hospitalization or a family death caused a missed documentary cohort. Who reviews the exception?');
 expect(text).toContain('do not route current requests to Rich');
 expect(text).toContain('family death with appropriate proof');
 expect(records.some(x=>['claim_545148587c77d367','claim_396379cd8a7da9ba__a3','claim_91adcd3b411340ef__a3'].includes(x.id))).toBe(false);
});
