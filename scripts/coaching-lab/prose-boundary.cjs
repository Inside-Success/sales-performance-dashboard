// A repair can change visible language, never factual ownership or adjudication.
const {validate, render} = require('./contract.cjs');
const {hash} = require('./accounting.cjs');
function prosePaths(report) {
  const paths = ['outcome.text'];
  for (const [key, fields] of Object.entries({
    objections:['title','concern','response','assessment','teaching','example'],
    lessons:['title','observation','teaching','example'],
    next_steps:['text'],
  })) report[key].forEach((_,i)=>fields.forEach(f=>paths.push(`${key}.${i}.${f}`)));
  return paths;
}
function repair(report, blocks, patches, expectedDigest) {
  validate(report,blocks);
  if(hash(report)!==expectedDigest) throw Error('Stale repair candidate');
  if(report.status!=='completed') throw Error('Exclusion needs separate adjudication');
  const allowed=new Set(prosePaths(report)),seen=new Set();
  const result=structuredClone(report);
  for(const p of patches){
    if(!allowed.has(p.path)||seen.has(p.path)||typeof p.value!=='string') throw Error('Invalid prose repair');
    seen.add(p.path);const keys=p.path.split('.');const last=keys.pop();
    let target=result;for(const k of keys)target=target[k];target[last]=p.value;
  }
  validate(result,blocks);
  return {report:result,digest:hash(result),rendered:render(result,blocks),requiresFreshReview:patches.length>0};
}
module.exports={prosePaths,repair};
