import { describe, expect, it } from 'vitest';
import { retrieveEvidence } from '../../../src/lib/ask-sales-faq/revamp/retrieval';
import { getRevampKnowledge } from '../../../src/lib/ask-sales-faq/revamp/knowledge';
import type { Evidence, Plan } from '../../../src/lib/ask-sales-faq/revamp/types';

const fact = (id: string, text: string): Evidence => ({id, decisionKey:id, title:id, text, questions:[], scopes:['shared'], sourceIds:[id], reviewedAt:'2026-10-15', authority:10, kind:'policy', risk:'medium', routeKey:null, conditions:[], supersedes:[]});
const plan = (question: string): Plan => ({intent:'company_question', question, queries:[], scopes:[]});

describe('question evidence survives growth in general context', () => {
  it('preserves a relevant rule and its correction despite unrelated context dependency chains', () => {
    const unrelated = Array.from({length:45}, (_,i) => ({...fact(`background-${i}`, 'Office furniture catalog'), conditions:i < 44 ? [`governing_evidence:background-${i+1}`] : []}));
    unrelated[0] = {...unrelated[0], domains:['company_context']} as typeof unrelated[number];
    const old = {...fact('historical', 'Equipment reimbursement travel'), conditions:['governing_evidence:current']};
    const current = fact('current', 'Submit the receipt to the designated reviewer.');
    const records = [...unrelated, old, current];
    for (const corpus of [records, [...records].reverse()]) {
      const result = retrieveEvidence(corpus, 'Equipment reimbursement travel', plan('Equipment reimbursement travel'), 8).map(r=>r.record.id);
      expect(result).toContain('historical');
      expect(result).toContain('current');
      expect(result.indexOf('current')).toBeLessThan(result.indexOf('historical'));
      expect(result.length).toBeLessThanOrEqual(8);
    }
  });
  it.each([
    'are dummy calls and pass off calls 20% commission?',
    'How much do I earn when I set the appointment and another rep closes it?',
    'Is the dummy passoff payout the same as when I set and close myself?',
  ])('finds existing commission evidence without an exact question gate: %s', question => {
    const ids=retrieveEvidence(getRevampKnowledge(),question,plan(question)).map(r=>r.record.id);
    expect(ids.some(id=>['claim_ace52a842f5a59a1','operational_8b32ea275d9b05e9'].includes(id))).toBe(true);
    expect(ids.length).toBeLessThanOrEqual(36);
  });
});
