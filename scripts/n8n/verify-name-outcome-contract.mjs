// Offline replay only. Private source text is supplied through stdin, not saved.
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
import {dashboardCoachingSections} from '../../src/lib/coaching-dashboard-sections.js';
import {coachingEvidence} from '../../src/lib/coaching-presentation.js';

const [baselinePath,patchPath]=process.argv.slice(2);
const read=p=>JSON.parse(gunzipSync(fs.readFileSync(p)));
const baseline=read(baselinePath),patches=read(patchPath);
const input=JSON.parse(fs.readFileSync(0,'utf8'));
const official='L8Nn7xncA9ZPDdWA',manual='BMRrGxHyXMcgO6j3';
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
const clean=patches[official]['Clean Response'].jsCode;
const expression=patches[official]['Edit Fields'].assignments.assignments.find(x=>x.name==='Client Name').value.slice(3,-2);
let mappings=0;
for(const fixture of input.fixtures||[]){
 const original=fixture.text.split(/\r?\n/).find(x=>x.startsWith('Client Name:'))?.slice(12).trim();
 assert.ok(original,'real fixture has an original client label');
 const json={body:{content:[{paragraph:{elements:[{textRun:{content:fixture.text}}]}}]}};
 const run=code=>new AsyncFunction('$input','$json',code)({all:()=>[{json}],first:()=>({json})},json);
 const before=(await run(baseline[official].nodes.find(n=>n.name==='Clean Response').parameters.jsCode))[0].json;
 const after=(await run(clean))[0].json;
 assert.equal(after.cleaned_transcript,before.cleaned_transcript);
 assert.deepEqual(after.client_speaker_aliases,before.client_speaker_aliases);
 assert.equal(after.resolved_show_name,before.resolved_show_name);
 assert.ok(after.resolved_client_name.trim());
 for(const stored of [undefined,'',' ',after.resolved_client_name]){
  const row={'Client Name':stored,'Client Name Source':'Zoom Display Name'};
  const mapped=new Function('$json','$','return '+expression)(after,()=>({item:{json:row}}));
  assert.equal(mapped,after.resolved_client_name);mappings++;
 }
 const row={'Client Name':'Explicit Verified Name','Client Name Source':'Manual'};
 assert.equal(new Function('$json','$','return '+expression)(after,()=>({item:{json:row}})),'Explicit Verified Name');mappings++;
}
const key=v=>coachingEvidence(v).text.replace(/\s+/g,' ').trim().toLowerCase();
let reports=0,documents=0;
for(const report of input.reports||[]){
 const original=JSON.stringify(report),sections=dashboardCoachingSections(report);
 const outcome=sections.find(s=>s.key==='outcome')?.items[0];
 assert.ok(!outcome||!sections.filter(s=>s.key!=='outcome').some(s=>s.items.some(x=>key(x)===key(outcome))),'outcome is shown once');
 const old=baseline[official].nodes.find(n=>n.name==='Code in JavaScript').parameters.jsCode;
 const oldSections=new Function(old.slice(0,old.indexOf('if($input.all().length'))+'\nreturn coachingSections;')()(report);
 // Every old sentence remains somewhere in the fixed presentation (duplicates may move).
 const afterText=key(sections.flatMap(x=>x.items).join('\n'));
 for(const section of oldSections)for(const item of section.items){
  for(const line of String(item).split(/\r?\n/)){
   const sentence=key(line).replace(/^\d+[.)]\s*/,'');
   if(sentence&&!/^(Observed concerns:|Agreed next steps:)$/i.test(sentence))assert.ok(afterText.includes(sentence),`retained report ${report.id} content`);
  }
 }
 assert.equal(JSON.stringify(report),original);reports++;
 for(const [wid,name] of [[official,'Build PDF HTML'],[manual,'Build Google Doc']]){
  const code=patches[wid][name].jsCode;
  const fn=new Function(code.slice(0,code.indexOf('function coachingDocRequests('))+'\nreturn coachingSections;')();
  const rendered=fn(report);
  const first=rendered.find(s=>s.key==='outcome')?.items[0];
  assert.ok(!first||!rendered.filter(s=>s.key!=='outcome').some(s=>s.items.some(x=>key(x)===key(first))));documents++;
  if(report.source_payload?.reviewed_coaching_v1){
   const enriched={...report,reviewed_coaching_v1:report.source_payload.reviewed_coaching_v1};
   const oldCode=baseline[wid].nodes.find(n=>n.name===name).parameters.jsCode;
   const oldFn=new Function(oldCode.slice(0,oldCode.indexOf('function coachingDocRequests('))+'\nreturn coachingSections;')();
   assert.deepEqual(fn(enriched),oldFn(enriched),'structured document sections remain identical');documents++;
  }
 }
}
console.log(JSON.stringify({nameFixtures:input.fixtures?.length||0,nameMappings:mappings,reports,documentRenders:documents,modelCalls:0}));
