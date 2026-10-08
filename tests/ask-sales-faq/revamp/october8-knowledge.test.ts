import { describe, expect, it } from 'vitest';
import { getRevampKnowledge } from '../../../src/lib/ask-sales-faq/revamp/knowledge';
import { retrieveEvidence } from '../../../src/lib/ask-sales-faq/revamp/retrieval';
import type { Plan } from '../../../src/lib/ask-sales-faq/revamp/types';
const records = getRevampKnowledge();
const rows = (question: string, scope: Plan['scopes'][number] = 'main_istv') => retrieveEvidence(records, question, { intent: 'company_question', question, scopes: [scope], queries: [] }).map(x => x.record);
describe('October 8 source refresh', () => {
  it('retrieves the updated allocation rather than retired spreadsheet limits', () => {
    const evidence = rows('I finished sixty dial outs, how do I get more leads?').map(r => r.text).join('\n');
    expect(evidence).toContain('post Extra');
    expect(evidence).toContain('maximum grand total 100');
    expect(evidence).toContain('does not specify a reset period');
  });
  it('answers the changed training time without retaining the previous hour', () => {
    const evidence = rows('What time is Thursday closing training with Raul?').map(r => r.text).join('\n');
    expect(evidence).toContain('Thursday 2–3 PM EST');
    expect(evidence).not.toContain('Thursday 1–2 PM EST');
  });
  it('retrieves season restrictions and initial onboarding without importing regular rules', () => {
    expect(rows('Can my Island season two VIP buyer waitlist season one?', 'reality').map(r => r.text).join('\n')).toContain('may request the Season 1 waitlist');
    expect(rows('What is the Entrepreneurs Island deposit and contract?', 'reality').map(r => r.text).join('\n')).toContain('lowest listed initial installment is $5,000');
    expect(rows('What form do we send after a reality sale?', 'reality').map(r => r.text).join('\n')).toContain('https://form.typeform.com/to/yO8sUq2m');
    expect(rows('Where is the new VIP video?', 'reality').map(r => r.id)).not.toContain('regular-vip-video-2026-10-08');
  });
  it('keeps pass-off and SMS operational guidance retrievable', () => {
    expect(rows('How do I claim a passoff in HubSpot?').map(r => r.id)).toContain('hubspot-passoff-sop-2026-10-08');
    expect(rows('Where do I see SMS replies and auto refresh?').map(r => r.id)).toContain('hubspot-sms-inbox-2026-10-08');
  });
});
