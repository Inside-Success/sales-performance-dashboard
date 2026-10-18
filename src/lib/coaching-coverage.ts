import "server-only";
import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { readAirtablePage } from "./source-read";

type ScanState = {offset?:string; end?:string; reported?:string[]; pending?:{token:string; source_ids:string[]; checked:number; nextOffset?:string; end:string; reported:string[]}};
// Dashboard-owned cursor only. Source calls are read through Airtable GETs.
export async function coachingCoverage(action:"scan"|"ack", token?:string, missingIds:string[]=[]) {
  if (!process.env.DATABASE_URL) throw Error("Coverage storage unavailable");
  const sql=neon(process.env.DATABASE_URL);
  await sql`create table if not exists coaching_coverage_cursor (id integer primary key, payload jsonb not null default '{}', owner uuid, lease_until timestamptz, updated_at timestamptz not null default now())`;
  await sql`insert into coaching_coverage_cursor(id) values (1) on conflict do nothing`;
  const rows=await sql`select payload from coaching_coverage_cursor where id=1`;
  const state:ScanState=rows[0].payload;
  if(action==='ack') {
    if(!token || state.pending?.token!==token) return {status:'superseded'};
    if(missingIds.some(id=>!state.pending!.source_ids.includes(id))) throw Error('Coverage acknowledgement mismatch');
    const reported=[...new Set([...(state.reported||[]),...missingIds])].slice(-5000);
    const next:ScanState=state.pending.nextOffset?{offset:state.pending.nextOffset,end:state.pending.end,reported}:{reported};
    const saved=await sql`update coaching_coverage_cursor set payload=${JSON.stringify(next)}::jsonb,updated_at=now()
      where id=1 and payload->'pending'->>'token'=${token} returning id`;
    return {status:saved.length?'acknowledged':'superseded'};
  }
  if(state.pending) return {status:'ready',...state.pending};
  const owner=randomUUID();
  const acquired=await sql`update coaching_coverage_cursor set owner=${owner},lease_until=now()+interval '90 seconds'
    where id=1 and (lease_until is null or lease_until<now()) returning payload`;
  if(!acquired.length) return {status:'busy',source_ids:[]};
  try {
    const claimed:ScanState=acquired[0].payload;
    if(claimed.pending) return {status:'ready',...claimed.pending};
    const access=process.env.AIRTABLE_API_KEY||process.env.AIRTABLE_ACCESS_TOKEN||process.env.AIRTABLE_TOKEN;
    if(!access) throw Error('Coverage source unavailable');
    const base=process.env.AIRTABLE_BASE_ID||'appNIvRt5uouRrcZ6';
    const table=process.env.AIRTABLE_ZOOM_CALLS_TABLE_ID||'tblD1VHKC49agh9QZ';
    const end=claimed.end||new Date(Date.now()-20*60000).toISOString();
    const start=new Date(Date.parse(end)-14*86400000).toISOString();
    let offset=claimed.offset;
    const ids:string[]=[];
    let checked=0;
    const deadline=Date.now()+45000;
    for(let page=0;page<5;page++) {
      const params=new URLSearchParams({pageSize:'100',filterByFormula:`AND({Processing Status}='Processed',{Call #}='Call 2+',{Meeting Transcript Link}!='',NOT(IS_BEFORE(CREATED_TIME(),DATETIME_PARSE('${start}'))),IS_BEFORE(CREATED_TIME(),DATETIME_PARSE('${end}')))`});
      params.append('fields[]','Call #');
      if(offset) params.set('offset',offset);
      const response=await readAirtablePage(`https://api.airtable.com/v0/${base}/${table}?${params}`,access,deadline);
      if(!response.ok) {
        if(response.status===422 && claimed.offset) await sql`update coaching_coverage_cursor set payload=${JSON.stringify({reported:claimed.reported||[]})}::jsonb where id=1 and owner=${owner}`;
        throw Error(`Coverage source HTTP ${response.status}`);
      }
      const data=await response.json();
      if(!Array.isArray(data.records)||data.records.some((r:{id?:string})=>!/^rec[A-Za-z0-9]+$/.test(r.id||''))) throw Error('Invalid coverage page');
      checked+=data.records.length;ids.push(...data.records.map((r:{id:string})=>r.id));
      offset=data.offset;
      if(!offset) break;
    }
    const reports=await sql`select coalesce(source_payload->>'source_airtable_record_id',source_payload->>'airtable_record_id') as source_id from performance_calls
      where coalesce(source_payload->>'source_airtable_record_id',source_payload->>'airtable_record_id')=any(${ids}::text[])`;
    const delivered=new Set(reports.map(r=>r.source_id));
    const pending={token:randomUUID(),source_ids:[...new Set(ids)].filter(id=>!delivered.has(id)),checked,nextOffset:offset,end,reported:claimed.reported||[]};
    const saved=await sql`update coaching_coverage_cursor set payload=${JSON.stringify({...claimed,pending})}::jsonb,updated_at=now()
      where id=1 and owner=${owner} returning id`;
    if(!saved.length) throw Error('Coverage ownership changed');
    return {status:'ready',...pending};
  } finally {
    await sql`update coaching_coverage_cursor set owner=null,lease_until=null where id=1 and owner=${owner}`;
  }
}
