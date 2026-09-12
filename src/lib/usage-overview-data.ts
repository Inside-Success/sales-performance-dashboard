import 'server-only';
import { neon } from '@neondatabase/serverless';
import { summarizeUsage, type UsagePeriod, type UsageReportRow } from './usage-overview';

// Read-only and intentionally independent of sales correlation / legacy analytics.
export const USAGE_OVERVIEW_QUERY = `
with roster as (
  select rep_slug, max(rep_name) as rep_name from performance_calls
  where rep_slug is not null
    and coalesce(call_date,created_at) >= $1::timestamptz - interval '30 days'
  group by rep_slug
), reports as (
  select c.id, c.rep_slug, c.client_name, c.created_at as available_at
  from performance_calls c join roster r on r.rep_slug=c.rep_slug
  where c.created_at <= $1::timestamptz
    and ($2::int is null or c.created_at >= $1::timestamptz - make_interval(days => $2::int))
), owner_activity as (
  select e.report_id,
    min(e.created_at) filter(where e.event_name='report_detail_viewed') as opened_at,
    bool_or(e.event_name='report_engaged') as engaged
  from dashboard_usage_events e join reports c on c.id=e.report_id
  where e.viewer_is_mapped and e.viewer_rep_slug=c.rep_slug
    and e.created_at <= $1::timestamptz
    and e.event_name in ('report_detail_viewed','report_engaged')
  group by e.report_id
), viewer_activity as (
  select e.viewer_rep_slug,
    max(e.created_at) as last_opened_at,
    count(distinct e.report_id) filter(where c.rep_slug<>e.viewer_rep_slug
      and ($2::int is null or e.created_at >= $1::timestamptz-make_interval(days => $2::int))) as other_opened
  from dashboard_usage_events e join performance_calls c on c.id=e.report_id
  where e.viewer_is_mapped and e.event_name='report_detail_viewed'
    and e.created_at <= $1::timestamptz
  group by e.viewer_rep_slug
)
select r.rep_slug,r.rep_name,c.id,c.client_name,c.available_at::text,
  a.opened_at::text as own_opened_at,coalesce(a.engaged,false) as own_engaged,
  v.last_opened_at::text,coalesce(v.other_opened,0) as other_opened
from roster r left join reports c on c.rep_slug=r.rep_slug
left join owner_activity a on a.report_id=c.id
left join viewer_activity v on v.viewer_rep_slug=r.rep_slug
order by r.rep_slug,c.id`;

export async function getUsageOverview(period: UsagePeriod) {
  const now = new Date();
  if (!process.env.DATABASE_URL) return { error:'Usage data is unavailable.', generatedAt:now.toISOString(), ...summarizeUsage([],now.getTime()) };
  try {
    const sql=neon(process.env.DATABASE_URL);
    const rows=await sql.query(USAGE_OVERVIEW_QUERY,[now.toISOString(),period]) as UsageReportRow[];
    return { error:null, generatedAt:now.toISOString(), ...summarizeUsage(rows,now.getTime()) };
  } catch (error) {
    console.error('Usage overview read failed',error);
    return { error:'Usage data could not be loaded. Please try again.',generatedAt:now.toISOString(),...summarizeUsage([],now.getTime()) };
  }
}
