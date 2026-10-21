import { randomBytes } from "node:crypto";
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock("next/server", () => ({ after: vi.fn() }));
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const query = vi.hoisted(() => vi.fn());
vi.mock("@neondatabase/serverless", () => ({ neon: () => ({ query }) }));
import {
  getReadSnapshot,
  refreshReadSnapshot,
  snapshotWarning,
} from "@/lib/dashboard-read-snapshot";
const old = {
  payload: { count: 12 },
  fetched_at: new Date(Date.now() - 3600000).toISOString(),
  failed_at: null,
};
beforeEach(() => {
  query.mockReset();
  vi.stubEnv("DATABASE_URL", "test");
  vi.stubEnv("MAGIC_MIKE_READ_SNAPSHOTS_ENABLED", "true");
});
afterEach(() => vi.unstubAllEnvs());
describe("last successful dashboard reads", () => {
  it("returns stale successful data immediately without origin requests", async () => {
    query.mockImplementation(async (sql: string) =>
      sql.startsWith("select") ? [old] : [],
    );
    const load = vi.fn();
    const data = await getReadSnapshot({
      key: "test",
      maxAgeSeconds: 300,
      load,
    });
    expect(data.data).toEqual({ count: 12 });
    expect(data.stale).toBe(true);
    expect(load).not.toHaveBeenCalled();
    expect(data.fetchedAt).toBe(old.fetched_at);
    expect(snapshotWarning(data)).toContain("last successful source read");
  });
  it("keeps a large successful dataset usable when it exceeds the shared cache budget", async () => {
    const row = {
      ...old,
      payload: { text: randomBytes(1300000).toString("base64") },
    };
    query.mockImplementation(async (sql: string) =>
      sql.startsWith("select") ? [row] : [],
    );
    const load = vi.fn();
    const value = await getReadSnapshot({
      key: "large",
      maxAgeSeconds: 300,
      load,
    });
    expect(value.data).toEqual(row.payload);
    expect(load).not.toHaveBeenCalled();
  });
  it("does not replace payload or success time when a refresh fails", async () => {
    query.mockImplementation(async (sql: string) =>
      sql.startsWith("insert") ? [{ key: "test" }] : [],
    );
    await expect(
      refreshReadSnapshot({
        key: "test",
        maxAgeSeconds: 300,
        load: async () => {
          throw new Error("timeout");
        },
      }),
    ).rejects.toThrow("timeout");
    const failure = query.mock.calls.find(([sql]) =>
      sql.includes("failed_at=now()"),
    );
    expect(failure?.[0]).not.toContain("payload=");
    expect(failure?.[0]).not.toContain("fetched_at=");
    expect(query.mock.calls.some(([sql]) => sql.includes("payload=$3"))).toBe(
      false,
    );
  });
  it("keeps scheduled refreshes eligible after inactivity", async () => {
    query.mockResolvedValue([]);
    const load = vi.fn();
    await refreshReadSnapshot({ key: "test", maxAgeSeconds: 300, load }, true);
    const claim = query.mock.calls.find(([sql]) => sql.startsWith("insert"));
    expect(claim?.[0]).not.toContain("interval '30 minutes'");
    expect(claim?.[1][3]).toBe(true);
    expect(load).not.toHaveBeenCalled();
  });
  it("does not start a second source refresh when another worker owns the lease", async () => {
    query.mockResolvedValue([]);
    const load = vi.fn();
    expect(
      await refreshReadSnapshot({ key: "test", maxAgeSeconds: 300, load }),
    ).toBe("fresh_or_refreshing");
    expect(load).not.toHaveBeenCalled();
  });
  it("publishes only a complete successful read with lease ownership", async () => {
    query.mockImplementation(async (sql: string) =>
      sql.startsWith("insert") || sql.includes("payload=$3")
        ? [{ key: "test" }]
        : [],
    );
    expect(
      await refreshReadSnapshot({
        key: "test",
        maxAgeSeconds: 300,
        load: async () => ({ rows: [1, 2, 3] }),
      }),
    ).toBe("refreshed");
    const save = query.mock.calls.find(([sql]) => sql.includes("payload=$3"));
    expect(save?.[0]).toContain("lease_token=$2");
    expect(JSON.parse(save?.[1][2])).toEqual({ rows: [1, 2, 3] });
  });
  it("does not return empty statistics when initial refresh is owned by another worker", async () => {
    query.mockResolvedValue([]);
    const load = vi.fn();
    await expect(
      getReadSnapshot({ key: "test", maxAgeSeconds: 300, load }),
    ).rejects.toThrow("being refreshed");
    expect(load).not.toHaveBeenCalled();
  });
});

it("joins a concurrent cold daily refresh instead of returning unavailable", async () => {
  vi.useFakeTimers();
  let reads = 0;
  query.mockImplementation(async (sql: string) =>
    sql.startsWith("select") ? (++reads >= 3 ? [old] : []) : [],
  );
  const load = vi.fn();
  const pending = getReadSnapshot({
    key: "daily",
    maxAgeSeconds: 300,
    initializeWaitMs: 2000,
    load,
  });
  await vi.advanceTimersByTimeAsync(1000);
  const result = await pending;
  expect(result.data).toEqual(old.payload);
  expect(load).not.toHaveBeenCalled();
  vi.useRealTimers();
});
