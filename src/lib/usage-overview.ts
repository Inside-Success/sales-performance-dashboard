export function usageReportLabel(name: string | null) {
  const text = name?.trim();
  return !text || /^(?:unknown|client unavailable|prospect|who\b|through\b)/i.test(text) ? 'Coaching report' : text;
}
export type UsagePeriod = 7 | 30 | null;
export function parseUsagePeriod(value?: string): UsagePeriod { return value === 'all' ? null : value === '30' ? 30 : 7; }
export type UsageReportRow = {
  rep_slug: string; rep_name: string; id: number | null; client_name: string | null;
  available_at: string | null; own_opened_at: string | null; own_engaged: boolean;
  last_own_opened_at?: string | null;
  last_opened_at: string | null; other_opened: number | string;
};
export type UsageRepOverview = {
  slug: string; name: string; available: number; opened: number; engaged: number;
  lastOwnOpened: string | null;
  overdue: number; lastOpened: string | null; otherOpened: number;
  unopened: { id: number; client: string; availableAt: string; overdue: boolean }[];
  reports: { id: number; client: string; availableAt: string; openedAt: string | null }[];
};
export type UsageSort = 'name' | 'available' | 'opened' | 'rate' | 'lastOwnOpened';
export function sortUsageReps(reps: UsageRepOverview[], column: UsageSort, direction: 'asc' | 'desc') {
  return [...reps].sort((a, b) => {
    const av = column === 'rate' ? (a.available ? a.opened / a.available : null) : a[column];
    const bv = column === 'rate' ? (b.available ? b.opened / b.available : null) : b[column];
    // Missing dates/rates stay last in either direction; do not invent zero usage.
    if (av === null && bv !== null) return 1;
    if (bv === null && av !== null) return -1;
    const comparison = column === 'name' ? a.name.localeCompare(b.name)
      : column === 'lastOwnOpened' ? Date.parse(String(av || 0)) - Date.parse(String(bv || 0))
      : Number(av) - Number(bv);
    return (Number.isNaN(comparison) ? 0 : comparison) * (direction === 'asc' ? 1 : -1)
      || a.name.localeCompare(b.name) || a.slug.localeCompare(b.slug);
  });
}
const DAY = 86400000;
export function usagePercent(opened: number, available: number): number | null {
  return available > 0 ? Math.round(100 * opened / available) : null;
}
export type UsageFilter = 'all' | 'unopened' | 'never' | 'inactive';
export function matchesUsageFilter(rep: UsageRepOverview, filter: UsageFilter, now: number) {
  if (filter === 'unopened') return rep.opened < rep.available;
  if (filter === 'never') return rep.overdue > 0 && !rep.lastOwnOpened;
  if (filter === 'inactive') return rep.overdue > 0 && !!rep.lastOwnOpened && Date.parse(rep.lastOwnOpened) < now - 7 * DAY;
  return true;
}
export function summarizeUsage(rows: UsageReportRow[], now: number, period: UsagePeriod = null) {
  const reps = new Map<string, UsageRepOverview>();
  const seen = new Set<number>();
  const comparison = { current: { available: 0, opened: 0 }, previous: { available: 0, opened: 0 } };
  for (const row of rows) {
    let rep = reps.get(row.rep_slug);
    if (!rep) {
      rep = { slug:row.rep_slug, name:row.rep_name, available:0, opened:0, engaged:0, overdue:0,
        lastOwnOpened:null, lastOpened:row.last_opened_at, otherOpened:Number(row.other_opened || 0), unopened:[], reports:[] };
      reps.set(row.rep_slug, rep);
    }
    if (row.id === null || seen.has(Number(row.id))) continue;
    seen.add(Number(row.id));
    const lastOwn = row.last_own_opened_at || row.own_opened_at;
    if (lastOwn && (!rep.lastOwnOpened || Date.parse(lastOwn) > Date.parse(rep.lastOwnOpened))) rep.lastOwnOpened = lastOwn;
    const availableAt = Date.parse(row.available_at || '');
    if (period !== null && availableAt <= now - 2 * DAY) {
      const age = now - 2 * DAY - availableAt;
      const cohort = age < period * DAY ? comparison.current : age < 2 * period * DAY ? comparison.previous : null;
      if (cohort) {
        cohort.available++;
        const openedAt = Date.parse(row.own_opened_at || '');
        if (openedAt >= availableAt && openedAt <= availableAt + 2 * DAY) cohort.opened++;
      }
    }
    if (period !== null && availableAt < now - period * DAY) continue;
    rep.available++;
    if (row.available_at) rep.reports.push({id:Number(row.id), client:usageReportLabel(row.client_name), availableAt:row.available_at, openedAt:row.own_opened_at});
    if (row.own_opened_at) rep.opened++;
    if (row.own_engaged) rep.engaged++;
    if (!row.own_opened_at && row.available_at) {
      const overdue = now - Date.parse(row.available_at) >= 48 * 3600 * 1000;
      if (overdue) rep.overdue++;
      rep.unopened.push({id:Number(row.id), client:usageReportLabel(row.client_name), availableAt:row.available_at, overdue});
    }
  }
  const result = [...reps.values()].sort((a,b)=>b.overdue-a.overdue || (b.available-b.opened)-(a.available-a.opened) || a.name.localeCompare(b.name));
  for (const rep of result) rep.unopened.sort((a,b)=>a.availableAt.localeCompare(b.availableAt));
  for (const rep of result) rep.reports.sort((a,b)=>b.availableAt.localeCompare(a.availableAt) || b.id-a.id);
  return { comparison: period === null ? null : comparison, reps:result, engaged:result.reduce((n,r)=>n+r.engaged,0), available:result.reduce((n,r)=>n+r.available,0), opened:result.reduce((n,r)=>n+r.opened,0),
    overdue:result.reduce((n,r)=>n+r.overdue,0), repsOpening:result.filter(r=>r.opened>0).length,
    repsWithReports:result.filter(r=>r.available>0).length };
}
