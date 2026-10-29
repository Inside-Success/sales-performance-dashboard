import "server-only";
import { neon } from "@neondatabase/serverless";
import { readAirtablePage } from "./source-read";

const sql = () => neon(process.env.DATABASE_URL!);
let schema: Promise<void> | undefined;
export async function ensureSourceClaims() {
  if (!schema) schema = sql().query(`create table if not exists coaching_source_claims (
    identity text primary key, source_id text not null, owner text not null,
    status text not null, updated_at timestamptz not null default now())`).then(() => undefined).catch(error => { schema = undefined; throw error; });
  await schema;
}
export async function claimSource(sourceId:string, identity:string, owner:string, recovery=false, previousOwner?:string) {
  await ensureSourceClaims();
  const existing = await sql().query(`select id from performance_calls where scorecard_key=$1
    or source_payload->>'source_airtable_record_id'=$2 limit 1`,[identity,sourceId]);
  if(existing.length) return {acquired:false,status:"delivered"};
  const rows=await sql().query(`insert into coaching_source_claims(identity,source_id,owner,status)
    values($1,$2,$3,'running') on conflict(identity) do update set owner=$3,status='running',updated_at=now()
    where coaching_source_claims.source_id=$2 and (
      (coaching_source_claims.owner=$3 and coaching_source_claims.status='running')
      or ($4::boolean and coaching_source_claims.status in ('queued','retryable'))
      or ($4::boolean and $5::text is not null and coaching_source_claims.owner=$5 and coaching_source_claims.status='running'))
    returning identity`,[identity,sourceId,owner,recovery,previousOwner??null]);
  if(rows.length) return {acquired:true,status:"running"};
  const held=await sql().query(`select owner,status,source_id from coaching_source_claims where identity=$1`,[identity]);
  return {acquired:false,status:held[0]?.status||"held",owner:held[0]?.owner,source_id:held[0]?.source_id};
}
export async function settleSource(sourceId:string, owner:string, status:string) {
  const next=status==='queued'?'retryable':['delivered','excluded','existing_report'].includes(status)?'done':'held';
  await ensureSourceClaims();
  const rows=await sql().query(`update coaching_source_claims set status=$3,updated_at=now()
    where source_id=$1 and owner=$2 and status='running' returning identity`,[sourceId,owner,next]);
  return {settled:rows.length>0};
}
/** Reserve only never-started calls. GET source/artifacts before any owned-state mutation. */
export async function reserveMissingSource(sourceId:string) {
  const access=process.env.AIRTABLE_API_KEY||process.env.AIRTABLE_ACCESS_TOKEN||process.env.AIRTABLE_TOKEN;
  if(!access) throw Error('Source unavailable');
  const base=process.env.AIRTABLE_BASE_ID||'appNIvRt5uouRrcZ6';
  const table=process.env.AIRTABLE_ZOOM_CALLS_TABLE_ID||'tblD1VHKC49agh9QZ';
  const response=await readAirtablePage(`https://api.airtable.com/v0/${base}/${table}/${sourceId}`,access,Date.now()+20000);
  if(!response.ok) throw Error('Source read failed');
  const raw=await response.json(), f=raw.fields||{};
  if(raw.id!==sourceId||f['Processing Status']!=='Processed'||f['Call #']!=='Call 2+'||!f['Meeting Transcript Link']) return {reserved:false,reason:'ineligible'};
  const ready=Date.parse(f['Ingested At']||raw.createdTime);
  if(!Number.isFinite(ready)||Date.now()-ready<20*60000)return {reserved:false,reason:'grace_period'};
  const identity=String(f['Automation Key']||f['Scorecard Key']||`airtable:${sourceId}`).trim();
  const escapedIdentity=identity.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
  const params=new URLSearchParams({filterByFormula:`OR({source_airtable_record_id}='${sourceId}',{scorecard_key}='${escapedIdentity}')`,maxRecords:'1'});
  const artifact=await readAirtablePage(`https://api.airtable.com/v0/${base}/tblxMPJTnMFvrlY2d?${params}`,access,Date.now()+20000);
  if(!artifact.ok)throw Error('Artifact read failed');
  const reports=await artifact.json();
  if(!Array.isArray(reports.records))throw Error('Invalid artifact response');
  const delivered=await sql().query(`select id from performance_calls where scorecard_key=$1 or source_payload->>'source_airtable_record_id'=$2 limit 1`,[identity,sourceId]);
  if(delivered.length)return {reserved:false,resolved:true,source_id:sourceId,reason:'verified_dashboard_report'};
  if(reports.records.length)return {reserved:false,reason:'existing_artifact'};
  await ensureSourceClaims();
  // The normal path claims before observing/processing; this INSERT races safely with it.
  const rows=await sql().query(`insert into coaching_source_claims(identity,source_id,owner,status)
    select $1,$2,'coverage','queued' where not exists(select 1 from coaching_source_attempts where source_id=$2)
      and not exists(select 1 from coaching_provider_checkpoints where source_id=$2)
      and not exists(select 1 from performance_calls where scorecard_key=$1 or source_payload->>'source_airtable_record_id'=$2)
    on conflict(identity) do update set updated_at=now()
    where coaching_source_claims.source_id=$2 and coaching_source_claims.owner='coverage' and coaching_source_claims.status='queued'
    returning source_id`,[identity,sourceId]);
  if(rows.length)return {reserved:true,source_id:sourceId};
  const held=await sql().query(`select source_id,owner,status from coaching_source_claims where identity=$1`,[identity]);
  return {reserved:false,source_id:sourceId,reason:held.length?'recording_claim_exists':'source_already_started',canonical_source_id:held[0]?.source_id,claim_status:held[0]?.status};
}
