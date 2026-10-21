import { describe, expect, it } from 'vitest';
import { getRevampKnowledge } from '../../../src/lib/ask-sales-faq/revamp/knowledge';
import { retrieveEvidence } from '../../../src/lib/ask-sales-faq/revamp/retrieval';
import type { Plan } from '../../../src/lib/ask-sales-faq/revamp/types';
const records = getRevampKnowledge();
const evidence = (question: string, scope: Plan['scopes'][number] = 'main_istv') => retrieveEvidence(records, question, { intent: 'company_question', question, scopes: [scope], queries: [] }).map(x => x.record.text).join('\n');
describe('October 21 source refresh', () => {
  it('retrieves current show status without losing the scheduled-call exception', () => {
    const text = evidence('Are Entrepreneurs Jungle and Built for More still being offered?', 'shared');
    expect(text).toContain('Entrepreneurs Jungle Off');
    expect(text).toContain('Built for More Off');
    expect(text).toContain('actually scheduled call');
  });
  it('keeps the current training schedule and welcome acknowledgments distinct', () => {
    expect(evidence('What is the Tuesday training with Raul about?')).toContain('Pre Call and Call 1');
    const text = evidence('After the Island welcome video does the buyer still reply WATCHED?', 'reality');
    expect(text).toContain('removes the instruction to reply WATCHED');
    expect(text).toContain('Received');
  });
  it('retrieves portal guidance for both relevant product families', () => {
    for (const scope of ['main_istv', 'reality'] as const) {
      const text = evidence('How much time should I spend showing the Cast Member HQ portal on my sales call?', scope);
      expect(text).toContain('benefit for documentary clients');
      expect(text).toContain('less relevant for reality');
    }
  });
  it('keeps the first-call-ready reality exception tied to both stages and approval', () => {
    const text = evidence('My reality buyer is ready to pay right now on our first appointment. Can we finish today?', 'reality');
    expect(text).toContain('Call 1 and Call 2 back to back');
    expect(text).toContain('actual Green Light approval');
  });
  it('retrieves the SMS exception without turning it into general Zoom texting permission', () => {
    const text = evidence('The payment URL is too long for HubSpot text, can I send it from Zoom?');
    expect(text).toContain('case-specific manager-approved workaround');
    expect(text).toContain('email by default');
  });
  it('preserves current passoff eligibility with the older timing rule', () => {
    const text = evidence('Can I take passoff calls if I am not on the live schedule anymore?');
    expect(text).toContain('only for reps currently on schedule/live calls');
    expect(text).toContain('pre-approved');
  });
  it('does not turn a proposed form change into a released feature', () => {
    const text = evidence('Reality PayMe is asking for an onboarding date, what do I put?', 'reality');
    expect(text).toContain('does not explicitly confirm');
    expect(text).toContain('Do not invent an onboarding booking/date');
  });
});
