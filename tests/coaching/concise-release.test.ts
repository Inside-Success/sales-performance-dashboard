import {it,expect} from 'vitest';
const reasoning=require('../../scripts/coaching-foundations/source-reasoning.cjs');
const contract=require('../../src/lib/foundations-contract.cjs');
const knowledge=require('../../scripts/coaching-foundations/coaching-knowledge-view.cjs');
const rules=require('../../scripts/coaching-foundations/coaching-knowledge-rules.json');
const t=require('../../scripts/coaching-foundations/transition.cjs');
const blocks=[{id:'T0001',text:'Buyer: We need delivery before June.'}];
it('preserves sound adjacent prose while correcting a supported teaching field',()=>{
 const draft={presentation:'syed-review-v1',summary:'Keep summary',objections:[{id:'O1',exchange:'Keep specific exchange',teaching:'Old teaching'}],lessons:[]};
 const audit={pass:false,findings:[{issue:'Missed deadline',evidence_ids:['T0001']}],edits:[{target:'objections:O1:teaching',before:'Old teaching',value:'Confirm whether delivery before June is possible before asking for payment.',reason:'The response must address the deadline.',source_quote:{id:'T0001',text:blocks[0].text}}],observation_dispositions:[]};
 expect(contract.providerErrors('foundations_reviewer_v3',audit)).toEqual([]);
 const out=reasoning.materializeReview(draft,audit,{observations:[]},blocks).corrected_report;
 expect(out.objections[0].exchange).toBe(draft.objections[0].exchange);expect(out.summary).toBe(draft.summary);
 expect(()=>reasoning.materializeReview(draft,{...audit,edits:[{...audit.edits[0],before:'stale'}]},{observations:[]},blocks)).toThrow('Stale');
 expect(()=>reasoning.materializeReview(draft,{...audit,edits:[{...audit.edits[0],target:'objections:O1',value:draft.objections[0]}]},{observations:[]},blocks)).toThrow('Whole-item');
});
it('accepts formatting-only source variations but holds new evaluator instructions',()=>{
 const rule=rules.find((r:any)=>r.before.startsWith('* The compliance evaluation'));
 expect(knowledge.project(rule.before).text).toBe(knowledge.project(rule.before.slice(2)).text);
 expect(()=>knowledge.project('Flag only when an invented new rule applies.')).toThrow('Unreviewed');
});
it('shortens prose without allowing removal of an objection or a changed judgment',()=>{
 const report={objections:[{id:'O1',teaching:'Long teaching',handling:'sound'},{id:'O2',teaching:'Keep this',handling:'needs_work'}]};
 const final=t.patchLength(report,['objections.0.teaching'],[{path:'objections.0.teaching',before:'Long teaching',value:'Short teaching'}]);
 expect(final.objections).toHaveLength(2);expect(final.objections[1]).toEqual(report.objections[1]);
 expect(()=>t.patchLength(report,['objections.0.teaching'],[{path:'objections.0.handling',before:'sound',value:'needs_work'}])).toThrow('Forbidden');
});
