import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
const require = createRequire(import.meta.url);
const { preserveReviewedHandoff } = require('../../scripts/coaching-insights/patches.cjs');

describe('reviewed coaching handoff', () => {
  it('preserves enrichment outside the legacy fields used by safety prompts', () => {
    const source = 'state.coaching_raw = normalizeCoaching(providerParsed(coachingResult, "coaching"));';
    const code = preserveReviewedHandoff(source);
    const run = new Function('state', 'coachingResult', 'normalizeCoaching', 'providerParsed', code);
    const record = { version: 'coaching-review-v1', source_id: 'same-call', improvements: [] };
    const state: Record<string, unknown> = {};
    run(state, { one_line_verdict: 'No payment confirmed.', reviewed_coaching_v1: record }, (raw: {one_line_verdict: string}) => ({one_line_verdict: raw.one_line_verdict}), (raw: unknown) => raw);
    expect(state.coaching_raw).toEqual({one_line_verdict: 'No payment confirmed.'});
    expect(state.reviewed_coaching_v1).toEqual(record);
  });
});
