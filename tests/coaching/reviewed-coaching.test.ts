import { describe,expect,it } from 'vitest';
import { readReviewedCoaching } from '@/lib/reviewed-coaching';
const record={version:'coaching-review-v1',source_id:'same-call',outcome:{payment:'not_confirmed',summary:'No payment confirmed.',evidence:['00:03:10']},improvements:[],strengths:[],blockers:[],next_steps:[]};
describe('optional reviewed coaching enrichment',()=>{
 it('requires matching call identity',()=>{expect(readReviewedCoaching({reviewed_coaching_v1:record},'another-call')).toBeNull();expect(readReviewedCoaching({reviewed_coaching_v1:record},'same-call')).toEqual(record);});
 it('fails back to legacy content for malformed enrichment',()=>{expect(readReviewedCoaching({reviewed_coaching_v1:{...record,improvements:[{observation:'incomplete'}]}},'same-call')).toBeNull();expect(readReviewedCoaching({one_line_verdict:'Legacy report'},'same-call')).toBeNull();});
 it('preserves an explicitly empty improvement list',()=>{expect(readReviewedCoaching({reviewed_coaching_v1:record},'same-call')?.improvements).toEqual([]);});
});
