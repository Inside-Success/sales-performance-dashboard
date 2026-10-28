// Isolated, resumable evaluation. Bounded repair mirrors the existing production stage.
const {spawnSync}=require('node:child_process');
const fs=require('node:fs');
const [input,variant='v7',...ids]=process.argv.slice(2);
if(!input||!ids.length)throw Error('Input, variant and explicit case IDs required');
function invoke(id,mode,model,draft){
 if(fs.existsSync('.private-upgrade/pause-evaluation'))throw Error('Evaluation paused at a safe boundary');
 const requestId=['upgrade',id,mode,model,variant].join('-'),file='.private-upgrade/'+requestId+'.json';
 const ledger=JSON.parse(fs.readFileSync('.private-upgrade/ledger.json','utf8'));
 const existing=ledger.find(r=>r.id===requestId);
 if(existing){if(existing.status==='validated'){console.log('Resume saved '+requestId);return {ok:true,file};}if(existing.actual!==null&&fs.existsSync(file))return {ok:false,file};throw Error('Inspect ambiguous attempt '+requestId);}
 const args=['scripts/coaching-upgrade/evaluate.cjs',input,id,mode,model,variant];if(draft)args.push(draft);
 const r=spawnSync(process.execPath,args,{stdio:'inherit',env:process.env});return {ok:r.status===0,file};
}
for(const id of ids){
 let draft=invoke(id,'write','claude-sonnet-5-5');
 if(!draft.ok){const result=JSON.parse(fs.readFileSync(draft.file));if(!result.ok)throw Error('Transport failed: inspect before retry');draft=invoke(id,'repair','claude-sonnet-5-5',draft.file);if(!draft.ok)throw Error('Bounded writer repair failed: '+id);}
 const audit=invoke(id,'review','claude-opus-5-5',draft.file);if(!audit.ok)throw Error('Audit requires inspection: '+id);
}
