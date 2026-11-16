import {expect,it} from 'vitest';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{scopedLength}=require('../../scripts/coaching-foundations/transition.cjs');
it('keeps unrequested judgment and teaching intact when formatting proposes extra edits',()=>{
 const report={summary:'A long summary.',objections:[{handling:'sound',teaching:'Keep this useful teaching.',evidence_ids:['T0001']}]};
 const result=scopedLength(report,['summary'],[{path:'summary',before:report.summary,value:'Short summary.'},{path:'objections.0.handling',before:'sound',value:'needs_work'},{path:'objections.0.teaching',before:report.objections[0].teaching,value:'Different advice.'}]);
 expect(result.report).toEqual({...report,summary:'Short summary.'});expect(report.summary).toBe('A long summary.');expect(result.ignoredPaths).toEqual(['objections.0.handling','objections.0.teaching']);
});
it('still holds stale, duplicate, empty, or wholly unauthorized formatting proposals',()=>{
 const report={summary:'Original.'},valid={path:'summary',before:'Original.',value:'Short.'};
 for(const patches of [[{...valid,before:'Wrong.'}],[valid,valid],[{...valid,value:''}],[{path:'other',before:'x',value:'y'}]])expect(()=>scopedLength(report,['summary'],patches)).toThrow();
});
