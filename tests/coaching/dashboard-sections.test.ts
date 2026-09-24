import { describe, expect, it } from 'vitest';
import { dashboardCoachingSections } from '../../src/lib/coaching-dashboard-sections';

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
