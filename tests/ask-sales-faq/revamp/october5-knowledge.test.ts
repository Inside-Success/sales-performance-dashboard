import { describe, expect, it } from 'vitest';
import { getRevampKnowledge } from '../../../src/lib/ask-sales-faq/revamp/knowledge';
import { retrieveEvidence } from '../../../src/lib/ask-sales-faq/revamp/retrieval';
import type { Plan } from '../../../src/lib/ask-sales-faq/revamp/types';
const records=getRevampKnowledge();
const rows=(question:string,scope:Plan['scopes'][number]='main_istv')=>retrieveEvidence(records,question,{intent:'company_question',question,scopes:[scope],queries:[]}).map(x=>x.record);
describe('October 5 knowledge refresh',()=>{
 it('retrieves revised training hours without the old Monday instructor',()=>{
  const evidence=rows('When does Raul teach compliance and when is closing training?').map(r=>r.text).join('\n');
  expect(evidence).toContain('Monday 1–2 PM EST Compliance with Raul');
  expect(evidence).toContain('Thursday 2–3 PM EST Closing');
  expect(evidence).not.toContain('Monday 11 AM–noon EST Compliance with Mike');
 });
 it('finds couple participation clarification in reality scope',()=>{
  expect(rows('Can a couple compete together in Business Race?','reality').map(r=>r.id)).toContain('reality-couples-separate-entrants-2026-10-05');
  expect(rows('Can I offer reality cheaper because he knows celebrities?','reality').map(r=>r.id)).toContain('reality-celebrity-connections-discount-2026-10-05');
 });
 it('finds passoff troubleshooting and preserves reality price boundaries',()=>{
  expect(rows('My passoff is assigned but Call 2 is missing from HubSpot Meetings').map(r=>r.id)).toContain('hubspot-missing-passoff-meeting-2026-10-05');
  expect(rows('Can I pay $750 to hold my place?','reality').map(r=>r.id)).not.toContain('no-small-hold-or-payment-reset-2026-10-05');
 });
});
