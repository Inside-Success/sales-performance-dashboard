import {describe,it,expect} from 'vitest';
import {historicalRequirement,miamiDate} from '../../src/lib/script-adherence/timeline';
import {actionStatus,summarize,type Analysis} from '../../src/lib/script-adherence/contract';
import {parseFilters} from '../../src/lib/script-adherence/filters';
const result:Analysis={family:'reality',stage:'call_1',attendance:'conversation',show:'Business Race',classificationReason:'Audition',transcriptComplete:true,eligibleForChecklist:true,exclusionReason:'',actions:[{id:'video_1',applicability:'yes',reason:'',components:[{state:'not_done',quote:'',timestamp:''}],playbackFraction:0}]};
describe('dated reporting rules',()=>{
 it('uses the Miami day, not the UTC date',()=>{expect(miamiDate('2026-09-29T03:59:59Z')).toBe('2026-09-28');expect(historicalRequirement('reality_call_1','video_1','2026-09-29T03:59:59Z')).toBe('outside_window');expect(historicalRequirement('reality_call_1','video_1','2026-09-29T04:00:00Z')).toBe('assess');});
 it('excludes earlier video requirements from every aggregate without rewriting evidence',()=>{expect(actionStatus(result,'video_1','2026-09-28')).toBe('Not applicable');expect(summarize([result],['2026-09-28']).assessed).toBe(0);expect(summarize([result],['2026-10-01']).notComplete).toBe(1);expect(result.actions[0].playbackFraction).toBe(0);});
 it('does not apply a reality cutoff to documentaries or the pitch',()=>{expect(historicalRequirement('documentary_call_1','video_1','2026-09-01')).toBe('assess');expect(historicalRequirement('reality_call_1','video_2','2026-09-01')).toBe('assess');});
 it('does not turn an invalid date into failure',()=>{expect(actionStatus(result,'video_1','invalid')).toBe('Not observable');});
 it('accepts only scalar bounded navigation filters',()=>{expect(parseFilters({from:['2026-10-01'],stage:'arbitrary',show:'x'.repeat(500)})).toEqual({from:'',to:'',stage:'',show:'x'.repeat(150)});});
});
