import { describe, expect, it } from 'vitest';
import { getRevampKnowledge } from '../../../src/lib/ask-sales-faq/revamp/knowledge';
import { retrieveEvidence } from '../../../src/lib/ask-sales-faq/revamp/retrieval';
import type { Plan } from '../../../src/lib/ask-sales-faq/revamp/types';

const records = getRevampKnowledge();
const evidence = (question: string, scope: Plan['scopes'][number] = 'reality') => retrieveEvidence(records, question, { intent: 'company_question', question, scopes: [scope], queries: [] }).map(x => x.record.text).join('\n');

describe('October 14 source refresh', () => {
  it('retrieves the latest availability pauses instead of old launch permissions', () => {
    const mountain = evidence('Can I still sell Entrepreneurs Mountain or where should its leads go?');
    expect(mountain).toContain('pauses Entrepreneurs Mountain');
    expect(mountain).toContain('Entrepreneurs Jungle');
    const uk = evidence('Can my UK prospect film Business Race in the UK?');
    expect(uk).toContain('paused and is no longer available');
    expect(uk).toContain('travel to the US');
    expect(uk).not.toContain('This is now an announced UK edition');
  });
  it('retrieves provisional venue details with their limits and keeps financing scoped', () => {
    const venue = evidence('Where will Mansion of Money be filmed?');
    expect(venue).toContain('park-place-mansion');
    expect(venue).toContain('Not 100% but mostly confirmed');
    const funding = evidence('Is Entrepreneurs Island Season 1 fully financed with filming location and production arrangements secured?');
    expect(funding).toContain("Rudy replied '(2) yes'");
    expect(funding).toContain('Not 100% but mostly confirmed');
  });
  it('retrieves next-day booking without promising Green Light or invented slots', () => {
    const booking = evidence('Do I book Call 2 tomorrow before Green Light comes back?', 'main_istv');
    expect(booking).toContain('compulsory except exceptional circumstances');
    expect(booking).toContain('Booking does not itself grant approval');
    expect(booking).toContain('actual availability');
  });
  it('retains prize and SMS limitations alongside the new guidance', () => {
    expect(evidence('Can I guarantee a $10,000 cash prize on Island?')).toContain('No $10,000–$20,000 cash prize was approved');
    const sms = evidence('How do I see the newest conversations first in Rep Home?', 'main_istv');
    expect(sms).toContain('contacts with the latest messages first');
    expect(sms).toContain('only US numbers are supported');
  });
  it('keeps sponsorship, housing and payment claims within the actual clarifications', () => {
    expect(evidence('Can we hold a reality spot while a prospect finds a presenting sponsor?')).toContain("Rudy replied 'No'");
    expect(evidence('Do Mansion cast pay for a hotel or stay at the mansion?')).toContain('everyone stays at the mansion');
    const payment = evidence('The payment page says select a TV show but there is no dropdown. What should I do?', 'main_istv');
    expect(payment).toContain('regular payment link generated from the HubSpot contact first');
    expect(payment).toContain('do not promise every client/link is now fixed');
  });
});
