import {expect,it,vi} from 'vitest';
const base=require('../../scripts/coaching-foundations/prompts.cjs');
const candidate=require('../../scripts/coaching-foundations/layered-candidate.cjs');
const knowledge=require('../../scripts/coaching-foundations/knowledge.cjs');
const {digest}=require('../../src/lib/coaching-canonical.cjs');
const facts=(id:string,text:string)=>({id,text,digest:digest(text),revision:'test-v1',source:'test/'+id});
it('separates reasoning-module identity from replaceable offer knowledge without changing the default composer',()=>{
 const original=base.compose;
 const spy=vi.spyOn(base,'compose').mockImplementation((_source:any,layers:any)=>({system:layers.map((x:any)=>x.text).join('\n')+'\n'+base.PRESENTATION+'\n{"presentation":"tyler-review-v1"}',manifest:{source_sha256:'test-source'}}));
 try{
  const a=[facts('governed-offer-policy','First approved facts'),facts('november-source-updates','New approved facts')];
  const b=[a[0],facts('november-source-updates','Replacement approved facts')];
  const first=candidate.compose('fixture',a),second=candidate.compose('fixture',b);
  expect(first.manifest.modules.map((m:any)=>m.id)).toEqual(['foundations','interpretation','strategy','execution']);
  expect(first.manifest.modules).toEqual(second.manifest.modules);
  expect(first.knowledgeTemplate.foundation).toEqual(second.knowledgeTemplate.foundation);
  expect(first.system).not.toContain(base.PRESENTATION);
  expect(first.system).toContain('"presentation":"tyler-review-v2"');
  const runtime={doc_id:knowledge.CONTEXT_DOC,source:'cache',fetched_at:'2026-11-11T00:00:00Z',text:'Approved runtime fact. '.repeat(10)};
  const bound=knowledge.bind(second.knowledgeTemplate,runtime);
  expect(bound.system).toContain('Replacement approved facts');expect(bound.system).not.toContain('New approved facts');
  expect(first.manifest.system).not.toEqual(second.manifest.system);
 }finally{spy.mockRestore();}
 expect(base.compose).toBe(original);
});
it('rejects an unrecognized presentation boundary instead of silently stacking conflicting instructions',()=>{
 const spy=vi.spyOn(base,'compose').mockReturnValue({system:'changed upstream presentation',manifest:{}});
 try{expect(()=>candidate.compose('fixture',[])).toThrow('Unrecognized production presentation');}finally{spy.mockRestore();}
});
