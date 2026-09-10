import { describe,it,expect } from 'vitest';
import {currentScoreFields} from '@/lib/rep-scoring/current-policy';
const row={'Scorer Version':'magic-mike-call2-evidence-score-v2','Meeting Start At':'2026-09-01T04:00:00Z','Call Context JSON':JSON.stringify({scoring_evidence:{review:{factual_review:{revision:'bounded-claims-2026-09-10',status:'passed'}}}})};
describe('September latest score policy',()=>{
 it('includes the exact Eastern Time boundary',()=>expect(currentScoreFields(row)).toBe(true));
 it('hides older calls even with latest review',()=>expect(currentScoreFields({...row,'Meeting Start At':'2026-09-01T03:59:59Z'})).toBe(false));
 it('hides earlier V2 revisions',()=>expect(currentScoreFields({...row,'Call Context JSON':'{}'})).toBe(false));
 it('hides failed reviews',()=>expect(currentScoreFields({...row,'Call Context JSON':row['Call Context JSON'].replace('passed','failed')})).toBe(false));
 it('hides the earlier rubric',()=>expect(currentScoreFields({...row,'Scorer Version':'magic-mike-call2-evidence-score-v1'})).toBe(false));
});
