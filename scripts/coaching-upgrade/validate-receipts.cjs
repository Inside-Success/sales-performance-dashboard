/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS is embedded in n8n Code nodes and run directly by Node. */
const fs=require('node:fs');
const {transcriptBlocks}=require('../coaching-release/structured-coaching.cjs');
const {normalizeObjectionReport,objectionSections,OBJECTION_VERSION}=require('../../src/lib/objection-coaching.cjs');
const {acceptEnhancedAudit}=require('./stages.cjs');
const {policyPack}=require('./policy.cjs');
const {POLICY_REVISION}=require('./prompts.cjs');
const [input,variant='v7']=process.argv.slice(2);const calls=JSON.parse(fs.readFileSync(input));const ledger=JSON.parse(fs.readFileSync('.private-upgrade/ledger.json'));const summary=[];
for(const c of calls){
 const auditId=['upgrade',c.id,'review','claude-opus-5-5',variant].join('-'),entry=ledger.find(r=>r.id===auditId);
 if(!entry||!['validated','recovered_pending_validation'].includes(entry.status))continue;
 const base='.private-upgrade/';const audit=JSON.parse(fs.readFileSync(base+auditId+'.json'));
 const repairId=['upgrade',c.id,'repair','claude-sonnet-5-5',variant].join('-');
 const writerId=ledger.some(r=>r.id===repairId&&r.status==='validated')?repairId:['upgrade',c.id,'write','claude-sonnet-5-5',variant].join('-');
 const generated=JSON.parse(fs.readFileSync(base+writerId+'.json'));const blocks=transcriptBlocks(c.transcript);
 const result=acceptEnhancedAudit({state:{coaching_policy_revision:POLICY_REVISION,coaching_policy_text:policyPack()},blocks,analysis:normalizeObjectionReport(generated.parsed_json),generated},audit,auditId);
 result.reviewed_coaching_v2.source_id='evaluation-'+c.id;result.coaching_version=OBJECTION_VERSION;
 fs.writeFileSync(base+'final-'+c.id+'-'+variant+'.json',JSON.stringify(result,null,2));
 entry.status='validated';const report=result.reviewed_coaching_v2;
 summary.push({id:c.id,family:report.offer_family,writer_repair:writerId===repairId,audit_corrections:audit.parsed_json.findings.length,objections:report.objections.map(o=>({category:o.category,handling:o.handling,resolution:o.resolution})),payment:report.outcome.payment,words:objectionSections(report).flatMap(s=>s.items).join(' ').split(/\s+/).length});
}
const lock='.private-upgrade/ledger.json.lock',fd=fs.openSync(lock,'wx');
try{const fresh=JSON.parse(fs.readFileSync('.private-upgrade/ledger.json'));for(const row of fresh)if(ledger.some(old=>old.id===row.id&&old.status==='validated'))row.status='validated';fs.writeFileSync('.private-upgrade/ledger.json',JSON.stringify(fresh,null,2));}finally{fs.closeSync(fd);fs.unlinkSync(lock);}fs.writeFileSync('.private-upgrade/evaluation-summary.json',JSON.stringify(summary,null,2));console.log(JSON.stringify(summary,null,2));
