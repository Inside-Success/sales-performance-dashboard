import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
import { getRepNoShowAnalytics, normalizeRepNoShowWindow } from "@/lib/rep-no-show";
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });
function record(id: number, day: string, absent = false) {
  return {id: `rec${id}`, fields: {"Rep Name": "Test", "Meeting ID": `meeting${id}`, "Call #": "Call 1", "Meeting Start Date": `${day}T15:00:00Z`, "Ingested At": "2026-09-10T15:00:00Z", "AI Decision Reason": `attendance_status=${absent ? 'rep_no_show' : 'present'}: evidence`}};
}
function setup() { vi.stubEnv('AIRTABLE_API_KEY', 'test'); vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-11T00:00:00Z')); }
describe('no-show history', () => {
 it('reads beyond 5000 records instead of silently omitting older weeks', async () => {
  setup(); const first = Array.from({length:5000}, (_,i)=>record(i,'2026-09-08'));
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json({records:first,offset:'next'})).mockResolvedValueOnce(Response.json({records:[record(5001,'2026-07-22',true)]}));
  vi.stubGlobal('fetch',fetcher); const data = await getRepNoShowAnalytics(90);
  expect(fetcher).toHaveBeenCalledTimes(2); expect(data.summary.recordsRead).toBe(5001); expect(data.summary.repNoShows).toBe(1);
  expect(data.weekly.find(w=>w.label.includes('Jul'))?.noShows).toBe(1);
 });
 it('omits untracked weeks but retains tracked zero weeks', async () => {
  setup(); vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({records:[record(1,'2026-07-22',true),record(2,'2026-09-08')]})));
  const data = await getRepNoShowAnalytics(90); expect(data.weekly).toHaveLength(2); expect(data.weekly.map(w=>w.noShows)).toEqual([1,0]);
 });
 it('rejects repeated cursors rather than return partial totals', async () => {
  setup(); vi.stubGlobal('fetch',vi.fn().mockImplementation(async () => Response.json({records:[record(1,'2026-09-08')],offset:'same'})));
  const data = await getRepNoShowAnalytics(); expect(data.summary.error).toContain('pagination repeated');
 });
 it('preserves saved date filters and supports the requested 14-day link', () => {
  for(const days of [7,14,30,90]) expect(normalizeRepNoShowWindow(String(days))).toBe(days);
  expect(normalizeRepNoShowWindow('garbage')).toBe(7);
 });
});
