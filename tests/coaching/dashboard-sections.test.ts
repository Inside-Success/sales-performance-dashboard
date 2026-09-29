import { describe, expect, it } from 'vitest';
import { dashboardCoachingSections, groupRecentImprovements, isRecentCoachingReport } from '../../src/lib/coaching-dashboard-sections';

describe('dashboard coaching sections', () => {
  it('shows a labeled optional action once in What to improve', () => {
    const action = 'Answer her direct question about structure first, then invite her to share what would work for her budget.';
    const report = {
      what_to_improve: '1. Optional polish: You delayed the answer. [00:12:34.840]\nPossible effect: She may remain confused.\nBetter action: ' + action,
      coaching_tip: 'Optional polish: ' + action,
      rudys_note: 'Optional polish: ' + action,
    };
    const before = JSON.stringify(report);
    const sections = dashboardCoachingSections(report);
    expect(sections.map(section => section.key)).toEqual(['improvements']);
    expect(sections[0].items).toHaveLength(1);
    expect(sections[0].items[0]).toContain('Better action: ' + action);
    expect(JSON.stringify(report)).toBe(before);
  });

  it('does not repeat an action from any improvement, even when tip punctuation differs', () => {
    const sections = dashboardCoachingSections({
      what_to_improve: '1. First issue.\nBetter action: Ask the budget question.\n\n2. Second issue.\nBetter action: Confirm the agreed follow-up.',
      coaching_tip: 'Confirm the agreed follow-up',
    });
    expect(sections.map(section => section.key)).toEqual(['improvements']);
    expect(sections[0].items).toHaveLength(2);
  });

  it('keeps a genuinely different tip in the existing improvement card', () => {
    const sections = dashboardCoachingSections({
      one_line_verdict: 'The buyer asked for more time.',
      what_to_improve: 'Clarify the payment schedule.\nBetter action: State the remaining installments.',
      coaching_tip: 'Confirm who will send the contract.',
      rudys_note: 'Optional polish: Confirm who will send the contract!',
    });
    expect(sections.map(section => section.key)).toEqual(['outcome', 'improvements']);
    expect(sections[1].items).toEqual([
      'Clarify the payment schedule.\nBetter action: State the remaining installments.',
      'Next time: Confirm who will send the contract.',
    ]);
  });

  it('creates the improvement card only when a distinct tip has no existing card', () => {
    const sections = dashboardCoachingSections({
      one_line_verdict: 'A follow-up was agreed.',
      coaching_tip: 'Confirm the calendar invitation.',
    });
    expect(sections.map(section => section.key)).toEqual(['outcome', 'improvements']);
    expect(sections[1].items).toEqual(['Next time: Confirm the calendar invitation.']);
  });

  it('leaves reports without tips unchanged', () => {
    const sections = dashboardCoachingSections({
      one_line_verdict: 'The buyer will review the contract.',
      what_to_improve: 'Confirm the follow-up date.',
    });
    expect(sections.map(section => section.key)).toEqual(['outcome', 'improvements']);
  });
});


describe('recent report format repair', () => {
 it('regroups saved nine-line reports into three recommendations before deduplication',()=>{
  const points=['Partner review was not explored. [00:01:00]','Why it matters: Questions may remain.','Next time: Ask what the partner needs.','Buyer had not watched the documentary. [00:02:00]','Possible effect: He may lack context.','Better action: Arrange a viewing time.','Thursday follow-up remained unconfirmed. [00:03:00]','Why it matters: Timing may remain unclear.','Next time: Confirm Thursday.'];
  const report={source_payload:{coaching_version:'magic-mike-call2-coaching-2026-09-08'},what_to_improve:points,biggest_fix:points.slice(0,3).join('\n')};
  const before=JSON.stringify(report);
  const result=dashboardCoachingSections(report).find(x=>x.key==='improvements')!.items;
  expect(result).toHaveLength(3);expect(result[0]).toContain('Ask what the partner needs');expect(result[1]).toContain('Arrange a viewing time');expect(result[2]).toContain('Confirm Thursday');expect(JSON.stringify(report)).toBe(before);
 });
 it('preserves very old full-section report grouping',()=>{
  const report={source_payload:{coaching_version:'legacy-2026-07-01'},what_to_improve:['First observation','Second observation'],what_went_well:['Strength'],why_no_close:'Existing close analysis'};
  expect(isRecentCoachingReport(report)).toBe(false);
  expect(dashboardCoachingSections(report).find(x=>x.key==='improvements')!.items).toEqual(report.what_to_improve);
 });
 it('does not invent missing observations for orphan continuation fields',()=>{
  expect(groupRecentImprovements(['Next time: Confirm the date.'])).toEqual(['Next time: Confirm the date.']);
 });
});

it('exposes existing buyer concerns and next steps once in recent fallback reports',()=>{
 const result=dashboardCoachingSections({source_payload:{coaching_version:'magic-mike-call2-coaching-2026-09-08'},one_line_verdict:'No payment was made.',objections_surfaced:['Buyer needed partner approval. [00:01:00]'],why_no_close:'No payment was made.\n\nObserved concerns:\n1. Buyer needed partner approval. [00:01:00]\n\nAgreed next steps:\n1. A Thursday call was agreed. [00:02:00]'});
 expect(result.map(x=>x.key)).toEqual(['outcome','objections','next-steps']);expect(result.find(x=>x.key==='objections')!.items).toHaveLength(1);
});
