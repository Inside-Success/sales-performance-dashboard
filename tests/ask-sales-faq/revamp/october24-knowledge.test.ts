import { describe, expect, it } from 'vitest';
import { getRevampKnowledge } from '../../../src/lib/ask-sales-faq/revamp/knowledge';
import { retrieveEvidence } from '../../../src/lib/ask-sales-faq/revamp/retrieval';
import type { Plan } from '../../../src/lib/ask-sales-faq/revamp/types';
const records = getRevampKnowledge();
const evidence = (question: string, scope: Plan['scopes'][number] = 'main_istv') => retrieveEvidence(records, question, { intent: 'company_question', question, scopes: [scope], queries: [] }).map(x => x.record.text).join('\n');
describe('October 24 source refresh', () => {
  it('does not retrieve the superseded send-afterwards Call 1 permission', () => {
    const text = evidence('We are running late on our reality first call. Can I send the show video later?', 'reality');
    expect(text).toContain('Both videos are required during the call');
    expect(text).toContain('Show required videos in the approved live call sequence');
    expect(text).not.toContain('otherwise send that show-specific video afterwards');
  });
  it('retains two licenses while allowing couples on the same team', () => {
    const text = evidence('Can husband and wife compete together on the same reality team?', 'reality');
    expect(text).toContain('two separate $20,000 licenses');
    expect(text).toContain('can be put on the same team');
    expect(text).toContain('not create a single joint license');
  });
  it('separates rep webinar confirmation from buyer welcome requirements', () => {
    const text = evidence('What must an approved reality rep watch and confirm to stay on calendar?', 'reality');
    expect(text).toContain('WATCHED & CONFIRMED');
    expect(text).toContain('REP training acknowledgment');
    expect(text).toContain('BUYER welcome template');
  });
  it('retrieves current casting without treating the sheet as exhaustive', () => {
    const text = evidence('Are we casting Business Race, Jungle or Operation Profit now?', 'reality');
    expect(text).toContain('Business Race, Entrepreneurs Island and Mansion of Money');
    expect(text).toContain('does not list it as On');
  });
  it('retrieves operational mobile and rescheduling boundaries', () => {
    expect(evidence('Can I send HubSpot SMS on my mobile phone?')).toContain('desktop-only');
    expect(evidence('How do I reschedule an existing meeting without duplicating it?')).toContain('original meeting’s reschedule link');
  });
  it('does not turn cast capacity into live availability', () => {
    const text = evidence('What season are cast members number 41 to 60 in?', 'reality');
    expect(text).toContain('41–60 Season 3');
    expect(text).toContain('not live inventory');
  });
  it('does not turn conditional approval into an automatic seven-day rule', () => {
    const text = evidence('Is a reality buyer automatically fully approved after seven days?', 'reality');
    expect(text).toContain('not automatic approval after seven days');
  });
});
