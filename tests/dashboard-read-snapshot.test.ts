import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const query = vi.hoisted(() => vi.fn());
vi.mock("@neondatabase/serverless", () => ({ neon: () => ({ query }) }));
import { getReadSnapshot, refreshReadSnapshot, snapshotWarning } from "@/lib/dashboard-read-snapshot";
const old = { payload: { count: 12 }, fetched_at: "2026-10-01T00:00:00Z", failed_at: null };
beforeEach(() => { query.mockReset(); vi.stubEnv("DATABASE_URL", "test"); vi.stubEnv("MAGIC_MIKE_READ_SNAPSHOTS_ENABLED", "true"); });
afterEach(() => vi.unstubAllEnvs());
describe("last successful dashboard reads", () => {
  it("returns stale successful data immediately without origin requests", async () => {
    query.mockImplementation(async (sql: string) => sql.startsWith('select') ? [old] : []);
    const load = vi.fn(); const data = await getReadSnapshot({ key:'test',maxAgeSeconds:300,load });
    expect(data.data).toEqual({count:12}); expect(data.stale).toBe(true); expect(load).not.toHaveBeenCalled();
    expect(data.fetchedAt).toBe(old.fetched_at); expect(snapshotWarning(data)).toContain("last successful source read");
  });
  it("does not replace payload or success time when a refresh fails", async () => {
    query.mockImplementation(async (sql: string) => sql.startsWith('insert') ? [{key:'test'}] : []);
    await expect(refreshReadSnapshot({key:'test',maxAgeSeconds:300,load:async()=>{throw new Error('timeout');}})).rejects.toThrow('timeout');
    const failure = query.mock.calls.find(([sql]) => sql.includes('failed_at=now()'));
    expect(failure?.[0]).not.toContain('payload='); expect(failure?.[0]).not.toContain('fetched_at=');
    expect(query.mock.calls.some(([sql]) => sql.includes('payload=$3'))).toBe(false);
  });
  it("does not start a second source refresh when another worker owns the lease", async () => {
    query.mockResolvedValue([]); const load=vi.fn();
    expect(await refreshReadSnapshot({key:'test',maxAgeSeconds:300,load})).toBe('fresh_or_refreshing');
    expect(load).not.toHaveBeenCalled();
  });
  it("publishes only a complete successful read with lease ownership", async () => {
    query.mockImplementation(async (sql: string) => sql.startsWith('insert') || sql.includes('payload=$3') ? [{key:'test'}] : []);
    expect(await refreshReadSnapshot({key:'test',maxAgeSeconds:300,load:async()=>({rows:[1,2,3]})})).toBe('refreshed');
    const save=query.mock.calls.find(([sql])=>sql.includes('payload=$3'));
    expect(save?.[0]).toContain('lease_token=$2'); expect(JSON.parse(save?.[1][2])).toEqual({rows:[1,2,3]});
  });
  it("does not return empty statistics when initial refresh is owned by another worker", async () => {
    query.mockResolvedValue([]); const load=vi.fn();
    await expect(getReadSnapshot({key:'test',maxAgeSeconds:300,load})).rejects.toThrow('being refreshed');
    expect(load).not.toHaveBeenCalled();
  });
});
