import { describe,it,expect } from 'vitest';
import {currentScoreFields} from '@/lib/rep-scoring/current-policy';
const row={'Scorer Version':'magic-mike-call2-evidence-score-v2','Meeting Start At':'2026-09-01T04:00:00Z','Call Context JSON':JSON.stringify({scoring_evidence:{review:{factual_review:{revision:'bounded-claims-2026-09-10',status:'passed'}}}})};
const v3={'Scorer Version':'magic-mike-call2-evidence-score-v3','Meeting Start At':'2026-09-19T15:00:00Z','Call Context JSON':JSON.stringify({scoring_evidence:{review:{factual_review:{revision:'raul-procedure-2026-09-18',status:'passed'}}}})};
describe('current rubric (v3) policy',()=>{
 it('shows a passed v3 review',()=>expect(currentScoreFields(v3)).toBe(true));
 it('hides a v3 row reviewed under the old revision',()=>expect(currentScoreFields({...v3,'Call Context JSON':row['Call Context JSON']})).toBe(false));
 it('hides a failed v3 review',()=>expect(currentScoreFields({...v3,'Call Context JSON':v3['Call Context JSON'].replace('passed','failed')})).toBe(false));
 it('never displays an unknown version',()=>expect(currentScoreFields({...v3,'Scorer Version':'magic-mike-call2-evidence-score-v9'})).toBe(false));
});
describe('September latest score policy (previous rubric, v2)',()=>{
 it('includes the exact Eastern Time boundary',()=>expect(currentScoreFields(row)).toBe(true));
 it('hides older calls even with latest review',()=>expect(currentScoreFields({...row,'Meeting Start At':'2026-09-01T03:59:59Z'})).toBe(false));
 it('hides earlier V2 revisions',()=>expect(currentScoreFields({...row,'Call Context JSON':'{}'})).toBe(false));
 it('hides failed reviews',()=>expect(currentScoreFields({...row,'Call Context JSON':row['Call Context JSON'].replace('passed','failed')})).toBe(false));
 it('hides the earlier rubric',()=>expect(currentScoreFields({...row,'Scorer Version':'magic-mike-call2-evidence-score-v1'})).toBe(false));
});
