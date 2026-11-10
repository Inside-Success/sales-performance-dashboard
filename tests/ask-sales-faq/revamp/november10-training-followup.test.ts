import { describe, expect, it } from 'vitest';
import { getRevampKnowledge } from '../../../src/lib/ask-sales-faq/revamp/knowledge';
import { retrieveEvidence } from '../../../src/lib/ask-sales-faq/revamp/retrieval';
const records = getRevampKnowledge();
const evidence = (question: string) => retrieveEvidence(records, question, { intent: 'company_question', question, scopes: ['main_istv'], queries: [] }).map(x => x.record.text).join('\n');
describe('November 10 training reconciliation', () => {
 it('retrieves useful guidance for a naturally phrased reputation concern', () => {
  const text=evidence('A lead got cold feet after reading a scam thread on Reddit. What can I tell them?');
  expect(text).toContain('acknowledge the concern');
  expect(text).toContain('not verified identity evidence');
 });
 it('retires categorical legacy Reddit claims while preserving do-not-introduce guidance', () => {
  expect(records.some(r=>['operational_edb70f8a0644cbfe','operational_f65a5463a5492076'].includes(r.id))).toBe(false);
  expect(records.some(r=>r.id==='operational_916fb049a6d77dd3')).toBe(true);
 });
 it('retrieves both cadence sources without inventing a blanket two-call exemption', () => {
  const text=evidence('Do I ring tomorrow’s applicants twice or four times before their audition?');
  expect(text).toContain('two attempts meet the video');
  expect(text).toContain('not proof the full SOP is complete');
 });
 it('retrieves the prospect-local contact window', () => {
  const text=evidence('What time zone do I use for pre-audition preparation calls?');
  expect(text).toContain('9 AM–7 PM');
  expect(text).toContain('PROSPECT’S local time');
 });
 it('keeps preparation completion and opt-out stop conditions', () => {
  const text=evidence('They answered my first preparation call; do I still make all four attempts?');
  expect(text).toContain('STOP the unanswered-call sequence');
  expect(text).toContain('Opt-outs/no-further-contact requests stop');
 });
});
