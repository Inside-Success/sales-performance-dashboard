import { describe, expect, it } from 'vitest';
import { completeCoachingText, completeCoachingValue } from '@/lib/coaching-placeholder.cjs';

describe('finished coaching wording', () => {
  it('keeps useful advice without asserting an amount was confirmed', () => {
    expect(completeCoachingText('Walk through the actual [confirmed initial amount] and remaining schedule.')).toBe('Walk through the actual initial payment amount and remaining schedule.');
    expect(completeCoachingText('Ask whether he wants to proceed with [deposit amount].')).toBe('Ask whether he wants to proceed with the deposit amount.');
  });
  it('covers explicit slots across money, follow-up and people without inventing values', () => {
    expect(completeCoachingText('Explain ${{payment_amount}} and ask about [follow-up time].')).toBe('Explain the payment amount and ask about the follow-up time.');
    expect(completeCoachingText('Include [prospect name] in the discussion of <insert detail>.')).toBe('Include the prospect in the discussion of the detail to confirm.');
  });
  it('preserves real numbers, timestamps, evidence IDs and ordinary bracketed text', () => {
    const text='You quoted $2,500 [00:06:57.520, 00:07:10.220] [T0204]. [inaudible] [VIP] [I need to think].';
    expect(completeCoachingText(text)).toBe(text);
  });
  it('is idempotent and leaves empty improvements and identity unchanged', () => {
    const original={source_id:'exact-call', improvements:[], action:'Discuss [initial amount].', evidence:['T0001'], score:49.3};
    const completed=completeCoachingValue(original);
    expect(completed.action).toBe('Discuss the initial payment amount.');
    expect(completed.source_id).toBe(original.source_id);
    expect(completed.improvements).toEqual([]);
    expect(completed.score).toBe(49.3);
    expect(original.action).toContain('[initial amount]');
    expect(completeCoachingValue(completed)).toEqual(completed);
  });
});
