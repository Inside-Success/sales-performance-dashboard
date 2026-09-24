#!/usr/bin/env node
// Reconcile an explicitly reviewed, private backfill plan with the dashboard.
// Dry-run by default. The plan contains no credentials and is not committed.
import fs from 'node:fs';
import {neon} from '@neondatabase/serverless';
const planPath=process.argv[2];
const execute=process.argv.includes('--execute');
if(!planPath)throw Error('Usage: backfill-audited-coaching.mjs PLAN.json [--execute]');
if(!process.env.DATABASE_URL)throw Error('DATABASE_URL is required');
const plan=JSON.parse(fs.readFileSync(planPath,'utf8'));
if(!Array.isArray(plan)||plan.length!==16||new Set(plan.map(x=>x.dashboard_id)).size!==16)throw Error('Expected 16 distinct reviewed reports');
const sql=neon(process.env.DATABASE_URL);
(async()=>{
 const ids=plan.map(x=>Number(x.dashboard_id));
 const current=await sql`select id,airtable_record_id,source_payload->>'source_airtable_record_id' as source_id,biggest_fix,what_to_improve from performance_calls where id=any(${ids})`;
 if(current.length!==16)throw Error(`Expected 16 dashboard rows; found ${current.length}`);
 const byId=new Map(current.map(x=>[String(x.id),x]));
 for(const row of plan){
  const now=byId.get(row.dashboard_id);
  if(!now||now.airtable_record_id!==row.airtable_scorecard_id||now.source_id!==row.source_id||now.biggest_fix!==row.old_biggest_fix||JSON.stringify(now.what_to_improve)!==JSON.stringify(row.old_what_to_improve))throw Error(`Baseline changed for report ${row.dashboard_id}`);
  if(!row.new_biggest_fix||!row.new_what_to_improve||!row.new_doc_text)throw Error(`Missing replacement for ${row.dashboard_id}`);
 }
 console.log(JSON.stringify({checked:16,ready:true,execute}));
 if(!execute)return;
 const payload=JSON.stringify(plan);
 const updated=await sql`
  with patch as (
   select * from jsonb_to_recordset(${payload}::jsonb) as x(
    dashboard_id text,source_id text,airtable_scorecard_id text,
    old_biggest_fix text,old_what_to_improve jsonb,
    new_biggest_fix text,new_what_to_improve text,new_coaching_tip text,new_rudys_note text
   )
  )
  update performance_calls p set
   biggest_fix=patch.new_biggest_fix,
   what_to_improve=jsonb_build_array(patch.new_what_to_improve),
   coaching_tip=patch.new_coaching_tip,
   rudys_note=patch.new_rudys_note,
   source_payload=p.source_payload || jsonb_build_object(
    'biggest_fix',patch.new_biggest_fix,
    'what_id_polish',patch.new_biggest_fix,
    'what_to_improve',patch.new_what_to_improve,
    'coaching_tip',patch.new_coaching_tip,
    'rudys_note',patch.new_rudys_note
   ),
   search_document=replace(p.search_document,patch.old_biggest_fix,patch.new_biggest_fix),
   updated_at=now()
  from patch
  where p.id=patch.dashboard_id::bigint
   and p.airtable_record_id=patch.airtable_scorecard_id
   and p.source_payload->>'source_airtable_record_id'=patch.source_id
   and p.biggest_fix=patch.old_biggest_fix
   and p.what_to_improve=patch.old_what_to_improve
  returning p.id
 `;
 if(updated.length!==16)throw Error(`Only ${updated.length} reports changed; inspect before retry`);
 console.log(JSON.stringify({updated:updated.length,ids:updated.map(x=>String(x.id)).sort()}));
})().catch(e=>{console.error(e.message);process.exitCode=1});
