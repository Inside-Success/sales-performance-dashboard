import 'server-only';
import {neon} from '@neondatabase/serverless';
import {resultSchema,type Analysis} from './contract';
import type {parseFilters} from './filters';
export type AdherenceCall={sourceKey:string;rep:string;title:string;startedAt:string;sourceUrl:string;reviewStatus:string;result:Analysis};
export type AdherenceTotals={complete:number;notComplete:number;unknown:number;notApplicable:number;assessedCalls:number;assessed:number;completion:number|null;coverage:number|null};
export type AdherenceGroup={id:string;actions:Array<{id:string;complete:number;notComplete:number;unknown:number;notApplicable:number}>};
export type AdherenceData={processing:{waiting:number;queued:number;held:number;enabled:boolean;lastScan:string|null;coverageStart:string|null};calls:AdherenceCall[];updatedAt:string|null;pilot:boolean;total:number;page:number;shows:string[];overall:AdherenceTotals;reps:Array<{name:string;total:number;stats:AdherenceTotals}>;groups:AdherenceGroup[]};
function totals(r:Record<string,unknown>):AdherenceTotals{const complete=Number(r.complete||0),notComplete=Number(r.not_complete||0),unknown=Number(r.unknown||0),assessed=complete+notComplete;return {complete,notComplete,unknown,notApplicable:Number(r.not_applicable||0),assessedCalls:Number(r.assessed_calls||0),assessed,completion:assessed?complete/assessed:null,coverage:assessed+unknown?assessed/(assessed+unknown):null};}
export async function readRepNames(){const rows=await neon(process.env.DATABASE_URL!)`select distinct rep from script_adherence_metrics order by rep`;return rows.map(r=>String(r.rep));}
export async function readAdherence(filters:ReturnType<typeof parseFilters>,rep='',page=1):Promise<AdherenceData>{
 if(!process.env.DATABASE_URL)throw Error('Adherence unavailable');const sql=neon(process.env.DATABASE_URL);
 // SQL-side filters and aggregates cover all matching records. Only one page includes evidence.
 const params=[rep,filters.show,filters.stage,filters.from,filters.to];
 const where="($1='' or m.rep=$1) and ($2='' or m.show=$2) and ($3='' or m.stage=$3) and ($4='' or (m.started_at at time zone 'America/New_York')::date>=nullif($4,'')::date) and ($5='' or (m.started_at at time zone 'America/New_York')::date<=nullif($5,'')::date)";
 const query=(text:string,extra:unknown[]=[])=>sql.query(text,[...params,...extra]);
 const [summary,reps,actions,shows,processing,control,scans]=await Promise.all([
  query(`select count(*)::int as total,count(*) filter(where script is not null)::int as assessed_calls,coalesce(sum(complete),0) as complete,coalesce(sum(not_complete),0) as not_complete,coalesce(sum(unknown),0) as unknown,coalesce(sum(not_applicable),0) as not_applicable,max(updated_at)::text as updated_at from script_adherence_metrics m where ${where}`),
  query(`select rep,count(*)::int as total,count(*) filter(where script is not null)::int as assessed_calls,sum(complete) as complete,sum(not_complete) as not_complete,sum(unknown) as unknown,sum(not_applicable) as not_applicable from script_adherence_metrics m where ${where} group by rep order by rep`),
  query(`select script,a->>'id' as id,count(*) filter(where a->>'status'='Complete')::int as complete,count(*) filter(where a->>'status'='Not complete')::int as not_complete,count(*) filter(where a->>'status'='Not observable')::int as unknown,count(*) filter(where a->>'status'='Not applicable')::int as not_applicable from script_adherence_metrics m cross join lateral jsonb_array_elements(actions) a where ${where} and script is not null group by script,a->>'id'`),
  sql`select distinct show from script_adherence_metrics where show<>'' order by show`,
  sql`select count(*) filter(where state='awaiting_transcript')::int as waiting,count(*) filter(where state in ('ready','draft_pending','review_ready','review_pending'))::int as queued,count(*) filter(where state='held')::int as held from script_adherence_jobs`,
  sql`select enabled,start_at::text from script_adherence_control where id=true`,
  sql`select case when count(distinct account_id)=2 then min(through_at)::text else null end as through_at from script_adherence_coverage`,
 ]);
 const total=Number(summary[0].total),current=Math.min(Math.max(1,page),Math.max(1,Math.ceil(total/20)));
 const rows=await query(`select c.source_key,c.rep,c.title,c.started_at::text,c.source_url,c.review_status,c.result from script_adherence_calls c join script_adherence_metrics m using(source_key) where ${where} order by m.started_at desc,m.source_key limit 20 offset $6`,[(current-1)*20]);
 const flags=await query(`select exists(select 1 from script_adherence_calls c join script_adherence_metrics m using(source_key) where ${where} and c.review_status='pilot') as pilot`);
 const groups=[...new Set(actions.map(r=>String(r.script)))].map(id=>({id,actions:actions.filter(r=>r.script===id).map(r=>({id:String(r.id),complete:Number(r.complete),notComplete:Number(r.not_complete),unknown:Number(r.unknown),notApplicable:Number(r.not_applicable)}))}));
 return {processing:{waiting:processing[0].waiting,queued:processing[0].queued,held:processing[0].held,enabled:control[0]?.enabled??false,lastScan:scans[0]?.through_at??null,coverageStart:control[0]?.start_at??null},calls:rows.map(r=>({sourceKey:r.source_key,rep:r.rep,title:r.title,startedAt:r.started_at,sourceUrl:r.source_url,reviewStatus:r.review_status,result:resultSchema.parse(r.result)})),updatedAt:summary[0].updated_at,pilot:flags[0].pilot,total,page:current,shows:shows.map(r=>String(r.show)),overall:totals(summary[0]),reps:reps.map(r=>({name:String(r.rep),total:Number(r.total),stats:totals(r)})),groups};
}
