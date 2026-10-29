import { describe, expect, it } from 'vitest';
import { getRevampKnowledge } from '../../../src/lib/ask-sales-faq/revamp/knowledge';
import { retrieveEvidence } from '../../../src/lib/ask-sales-faq/revamp/retrieval';
import type { Plan } from '../../../src/lib/ask-sales-faq/revamp/types';

const records = getRevampKnowledge();
const evidence = (question: string, scope: Plan['scopes'][number] = 'reality') => retrieveEvidence(records, question, { intent: 'company_question', question, scopes: [scope], queries: [] }).map(x => x.record.text).join('\n');

describe('October 12 evening source refresh', () => {
  it('retrieves the newer scoped financing confirmation alongside contractual limits', () => {
    const text = evidence('Is Entrepreneurs Island Season 1 fully financed with filming location and production arrangements secured?');
    expect(text).toContain("Rudy replied '(2) yes'");
    expect(text).toContain('not reopen a full season');
    const disclosure = evidence('Do reality participants need to disclose paying?');
    expect(disclosure).toContain('No they don’t');
    expect(disclosure).toContain('establish that a revised agreement has been issued');
    expect(disclosure).toContain('disclosing that they are part of the production');
    expect(disclosure).toContain('#ad or #promotion');
  });
  it('keeps the reality urgency and reapplication exceptions bounded', () => {
    const deadline = evidence('Does a reality prospect lose acceptance if they decide Monday?');
    expect(deadline).toContain('NOT a hard cutoff');
    const reapply = evidence('Can someone who declined a documentary two months ago apply for a reality show now?');
    expect(reapply).toContain('not automatic permission');
  });
  it('retrieves the current schedule without the superseded Monday session', () => {
    const text = evidence('When does the training for new reps happen?', 'main_istv');
    expect(text).toContain('Monday 11 AM–noon EST Compliance with Mike');
    expect(text).toContain('Wednesday 3–4 PM EST Call 2 and HubSpot/OnceHub');
    expect(text).not.toContain('Monday 1–2 PM EST Compliance with Raul');
  });
  it('keeps housing distinctions and duplicate-meeting caution available', () => {
    expect(evidence('Will Mansion of Money cast have private rooms?')).toContain('shared rooms of two to four');
    expect(evidence('Will merging duplicate contacts remove both meeting records?', 'main_istv')).toContain('Merging contacts may leave both meeting records');
    expect(evidence('HubSpot says reminder sent but the prospect did not receive it. What does that mean?', 'main_istv')).toContain('does not prove arrival');
  });
});
