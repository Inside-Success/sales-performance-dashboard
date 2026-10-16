import { describe, expect, it } from 'vitest';
import { getRevampKnowledge } from '../../../src/lib/ask-sales-faq/revamp/knowledge';
import { retrieveEvidence } from '../../../src/lib/ask-sales-faq/revamp/retrieval';
import type { Plan } from '../../../src/lib/ask-sales-faq/revamp/types';

const records = getRevampKnowledge();
const evidence = (question: string, scope: Plan['scopes'][number] = 'shared') => retrieveEvidence(records, question, { intent: 'company_question', question, scopes: [scope], queries: [] }).map(x => x.record.text).join('\n');

describe('October 16 source refresh', () => {
  it('retrieves current UK support without generalizing to international voice', () => {
    const sms = evidence('Is texting a British prospect supported now, and can we also ring them internationally?');
    expect(sms).toContain('UK SMS is now enabled');
    expect(sms).toContain('Do not infer voice capability from UK SMS activation');
  });
  it('preserves the new Standard interview clarification without inventing a full documentary entitlement', () => {
    const interview = evidence('Does a twenty thousand reality buyer get an interview telling their own story?', 'reality');
    expect(interview).toContain('$20,000');
    expect(interview).toContain('sit-down interview');
    expect(interview).toContain('does not specify its duration');
  });
  it('retains disclosure examples together with contract limits', () => {
    const disclosure = evidence('What should I tell a cast member to put on a promotional post about the show?', 'reality');
    expect(disclosure).toContain('#paidcastmember #ad');
    expect(disclosure).toContain('clause cannot be removed');
    expect(disclosure).toContain('not a guarantee');
  });
  it('separates weekly allowance from automatic qualification', () => {
    const greenlight = evidence('I have six good first calls today. Is three Green Lights a hard daily maximum?');
    expect(greenlight).toContain('15 per week');
    expect(greenlight).toContain('not authorization to exceed 15 weekly');
  });
  it('distinguishes reality between-call material from post-sale onboarding', () => {
    const email = evidence('Which email should a reality applicant get between their first and second appointment?', 'reality');
    expect(email).toContain('between-call preparation template');
    expect(email).toContain('different stage');
  });
  it('distinguishes trainee progress reports from discontinued non-DJ sales stats', () => {
    const training = evidence('I am still onboarding. Do I need to post progress every day or did Slack stats stop?');
    expect(training).toContain('Monday through Friday');
    expect(training).toContain('10 days');
    expect(training).toContain('not automatic approval');
    expect(training).toContain('does not exempt trainees');
  });
  it('makes HubSpot access timing distinct from permission to go live', () => {
    const access = evidence('When can a new trainee get HubSpot access: before or after the final mock?');
    expect(access).toContain('AFTER the final mock call is booked');
    expect(access).toContain('neither a passing result nor go-live authorization');
  });
  it('keeps the no-show exception with the new rejection-note requirement', () => {
    const notes = evidence('Do I fill Reject Call Notes when my first appointment never shows up?');
    expect(notes).toContain('Call 1');
    expect(notes).toContain('no-show');
    expect(notes).toContain('blank or N/A');
    expect(notes).toContain('Closing Call Notes');
  });
  it('keeps mini-documentary distribution and timing scoped to that component', () => {
    const documentary = evidence('Can Island VIP do the mini documentary early and will it be on other streaming platforms?', 'reality');
    expect(documentary).toContain('only on ISTV');
    expect(documentary).toContain('on site while filming reality');
    expect(documentary).toContain('separately scoped distribution terms for the reality series');
    expect(documentary).toContain('individually documented commitment');
  });
  it('preserves tentative season timing and the scope of teaser permission', () => {
    const season = evidence('Do we have definite dates for Mansion season 2?', 'reality');
    expect(season).toContain('spring/early summer');
    expect(season).toContain('not exact dates');
    const teaser = evidence('Can I send prospects that new unofficial Island teaser?', 'reality');
    expect(teaser).toContain('screen-sharing');
    expect(teaser).toContain('not distributing');
  });
  it('keeps the current assignment process despite stale spreadsheet wording', () => {
    const outbound = evidence('Do I still claim outbound leads on the sheet and log them in Keap?');
    expect(outbound).toContain('dedicated HubSpot assignment SOP');
    expect(outbound).toContain('do not restart spreadsheet claiming');
    expect(outbound).toContain('100 leads');
  });
});
