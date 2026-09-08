// Offline only: execute request builders with captured inputs; no network globals.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const P = process.argv[2];
const candidateDir=process.argv[3]||'candidate';
if (!P) throw Error('Provide private baseline/candidate directory');
const read = f => JSON.parse(fs.readFileSync(path.join(P,f),'utf8'));
const code = (w,name) => w.nodes.find(n=>n.name===name).parameters.jsCode;
const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
async function run(w,name,input,refs={}) {
 return new AsyncFunction('$json','$',code(w,name))(structuredClone(input), key=>({first:()=>({json:refs[key]}),item:{json:refs[key]}}));
}
(async()=>{
 const id='L8Nn7xncA9ZPDdWA'; const base=read(`baseline/${id}.json`), candidate=read(`${candidateDir}/${id}.json`);
 const fixture=read('baseline/MM-Build-Coaching-Request.fixture.json');
 for(const name of ['MM Build Compliance Request','MM Build Safety Screen Request','MM Prepare Repair','MM Prepare VNext Score Persistence']) {
  assert.equal(code(candidate,name),code(base,name),`${name} changed`);
 }
 const oldBuild=await run(base,'MM Build Coaching Request',fixture);
 const newBuild=await run(candidate,'MM Build Coaching Request',fixture);
 assert.notEqual(oldBuild.json.provider_request.system,newBuild.json.provider_request.system);
 assert.deepEqual(oldBuild.json.state.context_pack_runtime,newBuild.json.state.context_pack_runtime);
 const fields='one_line_verdict biggest_strength what_id_polish coaching_tip rudys_note what_went_well what_to_improve why_no_close what_made_this_close_work objections_surfaced'.split(' ');
 const prior={ok:true,parsed_json:Object.fromEntries(fields.map(f=>[f,'Original report.']))};
 const improved={ok:true,parsed_json:Object.fromEntries(fields.map(f=>[f,'Different coaching report.']))};
 const before=await run(base,'MM Build Compliance Request',prior,{'MM Build Coaching Request':oldBuild.json});
 const after=await run(candidate,'MM Build Compliance Request',improved,{'MM Build Coaching Request':newBuild.json});
 assert.deepEqual(before.json.provider_request,after.json.provider_request,'Coaching changes affected compliance request');
 for(const node of candidate.nodes.filter(n=>n.type==='n8n-nodes-base.code')) new AsyncFunction('$json','$',node.parameters.jsCode);
 console.log('PASS: identical compliance request and context; score persistence untouched; candidate code compiles. This does not prove model quality or live execution.');
})().catch(e=>{console.error(e.message);process.exitCode=1});
