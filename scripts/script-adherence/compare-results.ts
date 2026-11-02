import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {actionStatus,scriptFor,type Analysis} from '../../src/lib/script-adherence/contract';
const dir='.private-adherence/',reference=JSON.parse(readFileSync(dir+'benchmark-reference.json','utf8'));
const calls=JSON.parse(readFileSync(dir+'expanded-calls.json','utf8'));
const summaries=[],disagreements=[];
for(const file of readdirSync(dir).filter(n=>n.startsWith('compare-')&&n.endsWith('-parsed.json'))){
 const rows=JSON.parse(readFileSync(dir+file,'utf8'));let classifications=0,actionMatch=0,actionTotal=0,videoMatch=0,videoTotal=0,falseMissing=0,falseCredit=0;
 for(const r of rows){const gold=reference.find((g:{index:number})=>g.index===r.index).result as Analysis;
 const expected={...gold,actions:gold.actions||[]},actual=r.result?.analysis,raw=r.raw,date=calls[r.index].source['Meeting Start Date'];
 const fields=['family','stage','attendance','eligibleForChecklist'] as const;
 const classMatch=fields.every(k=>(raw?.[k]??(k==='eligibleForChecklist'?true:undefined))===(expected[k]??(k==='eligibleForChecklist'?true:undefined)));
 if(classMatch)classifications++;else disagreements.push({run:file,index:r.index,type:'classification',expected:Object.fromEntries(fields.map(k=>[k,expected[k]])),actual:Object.fromEntries(fields.map(k=>[k,raw?.[k]]))});
 for(const a of expected.actions){actionTotal++;const e=actionStatus(expected,a.id,date),v=actual&&scriptFor(actual)===scriptFor(expected)?actionStatus(actual,a.id,date):'Invalid / different script';if(e===v)actionMatch++;
  if(a.id==='video_1'||a.id==='video_2'){videoTotal++;if(e===v)videoMatch++;if(e==='Complete'&&v==='Not complete')falseMissing++;if(e==='Not complete'&&v==='Complete')falseCredit++;}
  if(e!==v)disagreements.push({run:file,index:r.index,type:'action',action:a.id,expected:e,actual:v});
 }
 }
 summaries.push({run:file.replace('-parsed.json',''),calls:rows.length,valid:rows.filter((r:{error:string})=>!r.error).length,classifications,actionMatch,actionTotal,videoMatch,videoTotal,falseMissing,falseCredit,cost:rows.reduce((n:number,r:{cost:number})=>n+(r.cost||0),0)/1e6});
}
writeFileSync(dir+'comparison-summary.json',JSON.stringify(summaries,null,2),{mode:0o600});writeFileSync(dir+'comparison-disagreements.json',JSON.stringify(disagreements,null,2),{mode:0o600});console.log(summaries);
