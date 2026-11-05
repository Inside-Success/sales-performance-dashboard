import { describe, expect, it } from 'vitest';
import { getRevampKnowledge } from '../../../src/lib/ask-sales-faq/revamp/knowledge';
import { retrieveEvidence } from '../../../src/lib/ask-sales-faq/revamp/retrieval';
import type { Plan } from '../../../src/lib/ask-sales-faq/revamp/types';
const records = getRevampKnowledge();
const evidence = (question: string, scope: Plan['scopes'][number] = 'main_istv') => retrieveEvidence(records, question, { intent: 'company_question', question, scopes: [scope], queries: [] }).map(x => x.record.text).join('\n');
describe('November 5 source refresh', () => {
 it('retrieves current reality availability and preserves documentary distinction', () => {
  const text=evidence('Can I still offer Operation Profit or Business Race UK?', 'reality');
  expect(text).toContain('only three reality shows currently being filled');
  expect(text).toContain('Business Race UK is not being filled');
  expect(text).toContain('MOST older documentary offers');
 });
 it('provides the current script without inventing launch completion', () => {
  expect(evidence('Where is the new reality Call 2 script?', 'reality')).toContain('114byDd_3imo1jGBrtobmOmPl1ZO_qBJ_dlI5SQLYQFI');
  expect(evidence('Are the new reality greenlight production documents live?', 'reality')).toContain('not that the automated rollout has happened');
 });
 it('retrieves the restriction on sending the contract overview', () => {
  const text=evidence('Can I send the short reality contract video to a prospect?', 'reality');
  expect(text).toContain('NOT to be sent to clients');
  expect(text).toContain('4c19c2c6b3164d07903a5108eceeb8f0');
 });
 it('preserves review rights alongside the source conflict', () => {
  const text=evidence('Must I keep a reality prospect on the call until they pay?', 'reality');
  expect(text).toContain('internal conflict');
  expect(text).toContain('do not pressure applicants');
 });
 it('retrieves the changed training time and narrow skipped-video exception', () => {
  expect(evidence('When is Thursday closing and contracts training?')).toContain('Thursday 11 AM–noon EST Closing');
  expect(evidence('The Part 2 double audition example video does not work; can I skip it?')).toContain('does not cancel all double-audition procedures');
 });
});
