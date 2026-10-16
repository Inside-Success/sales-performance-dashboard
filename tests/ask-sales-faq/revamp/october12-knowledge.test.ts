import { describe, expect, it } from 'vitest';
import { getRevampKnowledge } from '../../../src/lib/ask-sales-faq/revamp/knowledge';
import { retrieveEvidence } from '../../../src/lib/ask-sales-faq/revamp/retrieval';
import type { Plan } from '../../../src/lib/ask-sales-faq/revamp/types';
const records = getRevampKnowledge();
const evidence = (question: string, scope: Plan['scopes'][number] = 'main_istv') => retrieveEvidence(records, question, { intent: 'company_question', question, scopes: [scope], queries: [] }).map(x => x.record.text).join('\n');
describe('October 12 knowledge refresh', () => {
  it('keeps unclaimed-lead guidance while superseding the old Mountain video workaround', () => {
    expect(evidence('Another rep contacted this outbound lead but never claimed ownership. Can I claim it?')).toContain('next rep may claim the unowned lead');
    const mountain = evidence('Entrepreneurs Mountain has no dedicated Call 1 video. What should I do?', 'reality');
    expect(mountain).toContain('pauses Entrepreneurs Mountain');
    expect(mountain).toContain('never waived the mandatory Call 2 license presentation');
  });
  it('retrieves STOP handling and the calendar classification boundary', () => {
    expect(evidence('They texted STOP before Call 1. Should I still contact them?')).toContain('cannot contact them');
    expect(evidence('Can I put a third call on my public calendar?')).toContain('distorts outbound statistics');
  });
  it('retrieves current payment creation and keeps emergency links conditional', () => {
    const text = evidence('Where do I create the payment link and check the signed contract?');
    expect(text).toContain('HubSpot first');
    expect(text).toContain('signature, not cleared payment');
  });
  it('preserves provisional future dates and prefilming delivery limits', () => {
    expect(evidence('When are future reality seasons filming?', 'reality')).toContain('All future seasons April–June');
    expect(evidence('Does a reality buyer wait until filming to receive anything?', 'reality')).toContain('not a fixed delivery deadline');
  });
  it('retrieves current UK SMS scope and the scoped platform announcement', () => {
    expect(evidence('Can I text a UK number from HubSpot?')).toContain('UK SMS is now enabled');
    expect(evidence('Can I text a UK number from HubSpot?')).toContain('does not establish support for every other country');
    expect(evidence('Can I say we have content on Disney or Hulu now?', 'reality')).toContain('not proof it is already streaming');
  });
  it('keeps contract and background review boundaries available', () => {
    expect(evidence('Do reality participants need to disclose paying?', 'reality')).toContain('not establish that a revised agreement has been issued');
    expect(evidence('A prospect disclosed a felony; can I take payment?', 'reality')).toContain('approve it before payment');
  });
});
