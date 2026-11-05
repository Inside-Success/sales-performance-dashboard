import{readFileSync}from'node:fs';import{runInNewContext}from'node:vm';import{expect,it}from'vitest';
const code=readFileSync('scripts/script-adherence/archive-document-receipts.js','utf8');
const para=(s:string)=>({paragraph:{elements:[{textRun:{content:s}}]}});
function run(docs:unknown[]){return runInNewContext('(function(){'+code+'})()',{$input:{all:()=>docs.map(json=>({json}))},$execution:{id:'owner'},$:()=>({itemMatching:(i:number)=>({json:{id:'job'+i,record:{docId:'doc'+i}}})})});}
it('reads nested tabs and tables without mixing paired source identities',()=>{
 const out=run([{documentId:'doc0',tabs:[{documentTab:{body:{content:[para('start\n')]}},childTabs:[{documentTab:{body:{content:[{table:{tableRows:[{tableCells:[{content:[para('end')]}]}]}}]}}}]}]},{documentId:'doc1',body:{content:[para('other')]}}]);
 expect(out.map((r:any)=>r.json.id)).toEqual(['job0','job1']);expect(out[0].json.text).toContain('start\nend');expect(out[1].json.text).toBe('other');
});
it('retains failed and mismatched documents without interpreting error text as speech',()=>{
 for(const doc of [{error:'403'},{documentId:'wrong',body:{content:[para('wrong source')]}}]){const r=run([doc])[0].json;expect(r.error).toBeTruthy();expect(r.text).toBe('');}
});
