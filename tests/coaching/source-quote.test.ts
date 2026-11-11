import {createRequire} from 'node:module';
import {expect,it} from 'vitest';
const require=createRequire(import.meta.url),{resolve}=require('../../scripts/coaching-foundations/source-quote.cjs'),reasoning=require('../../scripts/coaching-foundations/source-reasoning.cjs');
const blocks=[{id:'T1',text:'Rep: What would make you say yes? Buyer: I can’t pay $4,500 today. 🙂 I need\n  more time.'}];
it.each([
 ['what would make you say yes?','What would make you say yes?'],
 ["I can't pay $4,500 today.",'I can’t pay $4,500 today.'],
 ['🙂 i need more time.','🙂 I need\n  more time.'],
])('restores the exact original span for formatting-only variation: %s',(text,original)=>{
 expect(resolve({id:'T1',text},blocks)).toEqual({id:'T1',text:original});
});
it.each(['I can pay $4,500 today.','I can’t pay $4500 today.','I can’t pay $4,000 today.','I cannot pay $4,500 today.','I can’t pay today.','I can’t ... today.',''])('rejects altered facts, punctuation, paraphrase and omissions: %s',text=>{
 expect(()=>resolve({id:'T1',text},blocks)).toThrow();
});
it('rejects absent/duplicate source IDs and ambiguous normalized matches',()=>{
 expect(()=>resolve({id:'other',text:'What would make you say yes?'},blocks)).toThrow();
 expect(()=>resolve({id:'T1',text:'What would make you say yes?'},[...blocks,...blocks])).toThrow();
 expect(()=>resolve({id:'T1',text:'say yes'},[{id:'T1',text:'Say yes. SAY YES.'}])).toThrow('ambiguous');
});
it('canonicalizes all review evidence without mutating raw provider receipts or source',()=>{
 const draft={summary:'Before',objections:[],lessons:[]};
 const quote={id:'T1',text:'what would make you say yes?'};
 const audit={pass:false,edits:[{target:'summary',value:'After',reason:'The rep asked.',source_quote:quote}],observation_dispositions:[{id:'A1',decision:'retained',reason:'Relevant question.',source_quote:quote}]};
 const original=JSON.stringify(audit),source=JSON.stringify(blocks);
 const out=reasoning.materializeReview(draft,audit,{observations:[{id:'A1'}]},blocks);
 expect(out.change_ledger[0].source_quote.text).toBe('What would make you say yes?');
 expect(out.observation_dispositions[0].source_quote.text).toBe('What would make you say yes?');
 expect(JSON.stringify(audit)).toBe(original);expect(JSON.stringify(blocks)).toBe(source);
});
it('retains whole short-answer protection after normalization',()=>{
 const source=[{id:'S',text:'Buyer: No thanks.'}],draft={summary:'Before'};
 const audit=(text:string)=>({pass:false,edits:[{target:'summary',value:'Declined',reason:'Refusal',source_quote:{id:'S',text}}],observation_dispositions:[]});
 expect(reasoning.materializeReview(draft,audit('no thanks.'),null,source).change_ledger[0].source_quote.text).toBe('No thanks.');
 expect(()=>reasoning.materializeReview(draft,audit('thanks'),null,source)).toThrow('fragment');
});
