import { describe, expect, it } from 'vitest';
import { getRevampKnowledge } from '../../../src/lib/ask-sales-faq/revamp/knowledge';
import { retrieveEvidence } from '../../../src/lib/ask-sales-faq/revamp/retrieval';
import type { Plan } from '../../../src/lib/ask-sales-faq/revamp/types';

const records = getRevampKnowledge();
const evidence = (question: string, scope: Plan['scopes'][number] = 'main_istv') => retrieveEvidence(records, question, { intent: 'company_question', question, scopes: [scope], queries: [] }).map(x => x.record.text).join('\n');

describe('October 19 source refresh', () => {
  it('finds documentary-versus-reality corrections from either family', () => {
    for (const scope of ['main_istv', 'reality'] as const) {
      const mom = evidence('Which video should I use for Mompreneurs?', scope);
      expect(mom).toContain('not a reality competition');
      const documentary = evidence('Does a reality purchase also cover a standalone Legacy Makers documentary shoot?', scope);
      expect(documentary).toContain('separate $8k offer');
    }
  });
  it('retrieves booked-audition preparation with stop and approval conditions', () => {
    const text = evidence('Tomorrow I have casting appointments. What calls and texts do I need to make today?');
    expect(text).toContain('four calls with three texts');
    expect(text).toContain('STOP');
    expect(text).toContain('sales-leadership authorization');
  });
  it('does not turn nonresponse into cancellation or fabricate contact history', () => {
    const text = evidence('My applicant ignored all reminders. Can I cancel the audition before it starts?');
    expect(text).toContain('Do not automatically cancel solely for nonresponse');
    expect(text).toContain('Only say you previously called/texted if those attempts actually occurred');
  });
  it('keeps Sunday booked appointments separate from cold dial-outs', () => {
    const text = evidence('Is Sunday forbidden even when a reality applicant wants their first appointment then?', 'reality');
    expect(text).toContain('a reality Call 1 can be scheduled on Sunday');
    expect(text).toContain('does not authorize Sunday cold/outbound list dialing');
  });
  it('finds current VIP support without promising an agency service', () => {
    const text = evidence('What are buyers actually getting with the anniversary VIP six months of marketing help?');
    expect(text).toContain('six months of Money Monday trainings');
    expect(text).toContain('not a promise of done-for-you advertising');
  });
  it('makes rejection timing and manual sending discoverable', () => {
    const text = evidence('Will the system send a rejection letter or should I do it, and when?');
    expect(text).toContain('themselves the next day after the audition');
    expect(text).toContain('not a replacement for the new no-show rebooking');
  });
  it('finds incomplete meeting records without inventing no-show rejection notes', () => {
    const text = evidence('Where can I find all my missing meeting fields in HubSpot?');
    expect(text).toContain('Missing Meeting Fields');
    expect(text).toContain('blank or N/A');
  });
});
