// Explicit in-place replacement only. Native document must be read back first.
import fs from 'node:fs';
import {neon} from '@neondatabase/serverless';
import {normalizeIngestPayload} from '../../src/lib/ingest';
const planPath=process.argv[2],execute=process.argv.includes('--execute');
if(!planPath||!process.env.DATABASE_URL)throw Error('Plan and database required');
const plan=JSON.parse(fs.readFileSync(planPath,'utf8'));
const {before,payload,documentVerified}=plan;
if(!before?.id||!before.google_doc_id||documentVerified?.documentId!==before.google_doc_id||documentVerified?.textDigest!==plan.documentTextDigest)throw Error('Matching document verification required');
const n=normalizeIngestPayload(payload),sid=before.source_payload.source_airtable_record_id;
if(n.airtable_record_id!==before.airtable_record_id||n.scorecard_key!==before.scorecard_key||n.google_doc_id!==before.google_doc_id||n.source_payload.source_airtable_record_id!==sid)throw Error('Replacement identity mismatch');
const sql=neon(process.env.DATABASE_URL);
const current=await sql`select id,source_payload,updated_at from performance_calls where id=${before.id} and source_payload->>'source_airtable_record_id'=${sid}`;
if(current.length!==1||JSON.stringify(current[0].source_payload)!==JSON.stringify(before.source_payload)){
 // JSONB key ordering need not match a locally constructed object.
 const canonical=(x:any):any=>Array.isArray(x)?x.map(canonical):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x;
 if(current.length!==1||JSON.stringify(canonical(current[0].source_payload))!==JSON.stringify(canonical(before.source_payload)))throw Error('Concurrent report change; reconcile before retry');
}
if(!execute){console.log(JSON.stringify({id:before.id,ready:true}));process.exit(0);}
const changed=await sql`update performance_calls set
 one_line_verdict=${n.one_line_verdict},biggest_strength=${n.biggest_strength},biggest_fix=${n.biggest_fix},coaching_tip=${n.coaching_tip},rudys_note=${n.rudys_note},
 what_went_well=${JSON.stringify(n.what_went_well)}::jsonb,what_to_improve=${JSON.stringify(n.what_to_improve)}::jsonb,
 why_no_close=${JSON.stringify(n.why_no_close)}::jsonb,what_made_this_close_work=${JSON.stringify(n.what_made_this_close_work)}::jsonb,objections_surfaced=${JSON.stringify(n.objections_surfaced)}::jsonb,
 close_section_type=${n.close_section_type},close_section=${JSON.stringify(n.close_section)}::jsonb,
 source_payload=${JSON.stringify(n.source_payload)}::jsonb,search_document=${n.search_document},updated_at=now()
 where id=${before.id} and airtable_record_id=${before.airtable_record_id} and source_payload=${JSON.stringify(before.source_payload)}::jsonb
 returning id,airtable_record_id,google_doc_id,source_payload`;
if(changed.length!==1)throw Error('Replacement lost compare-and-swap; reconcile');
const duplicates=await sql`select id from performance_calls where source_payload->>'source_airtable_record_id'=${sid}`;
if(duplicates.length!==1||String(duplicates[0].id)!==String(before.id))throw Error('Unexpected source multiplicity after replacement');
fs.writeFileSync(planPath+'.db-receipt.json',JSON.stringify({at:new Date().toISOString(),id:changed[0].id,source_id:sid,google_doc_id:changed[0].google_doc_id,digest:(changed[0].source_payload as any).reviewed_coaching_v3.digest,duplicates:duplicates.length}),{mode:0o600});
console.log(JSON.stringify({replaced:changed[0].id,sourceCount:duplicates.length}));
