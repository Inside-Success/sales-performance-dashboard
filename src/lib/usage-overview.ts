export type UsagePeriod = 7 | 30 | null;
export function parseUsagePeriod(value?: string): UsagePeriod { return value === 'all' ? null : value === '30' ? 30 : 7; }
export type UsageReportRow = {
  rep_slug: string; rep_name: string; id: number | null; client_name: string | null;
  available_at: string | null; own_opened_at: string | null; own_engaged: boolean;
  last_opened_at: string | null; other_opened: number | string;
};
export type UsageRepOverview = {
  slug: string; name: string; available: number; opened: number; engaged: number;
  overdue: number; lastOpened: string | null; otherOpened: number;
  unopened: { id: number; client: string; availableAt: string; overdue: boolean }[];
};
export function summarizeUsage(rows: UsageReportRow[], now: number) {
  const reps = new Map<string, UsageRepOverview>();
  const seen = new Set<number>();
  for (const row of rows) {
    let rep = reps.get(row.rep_slug);
    if (!rep) {
      rep = { slug:row.rep_slug, name:row.rep_name, available:0, opened:0, engaged:0, overdue:0,
        lastOpened:row.last_opened_at, otherOpened:Number(row.other_opened || 0), unopened:[] };
      reps.set(row.rep_slug, rep);
    }
    if (row.id === null || seen.has(Number(row.id))) continue;
    seen.add(Number(row.id)); rep.available++;
    if (row.own_opened_at) rep.opened++;
    if (row.own_engaged) rep.engaged++;
    if (!row.own_opened_at && row.available_at) {
      const overdue = now - Date.parse(row.available_at) >= 48 * 3600 * 1000;
      if (overdue) rep.overdue++;
      rep.unopened.push({id:Number(row.id), client:row.client_name || 'Coaching report', availableAt:row.available_at, overdue});
    }
  }
  const result = [...reps.values()].sort((a,b)=>b.overdue-a.overdue || (b.available-b.opened)-(a.available-a.opened) || a.name.localeCompare(b.name));
  for (const rep of result) rep.unopened.sort((a,b)=>a.availableAt.localeCompare(b.availableAt));
  return { reps:result, available:result.reduce((n,r)=>n+r.available,0), opened:result.reduce((n,r)=>n+r.opened,0),
    overdue:result.reduce((n,r)=>n+r.overdue,0), repsOpening:result.filter(r=>r.opened>0).length,
    repsWithReports:result.filter(r=>r.available>0).length };
}
