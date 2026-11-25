import { beforeEach, expect, it, vi } from "vitest";
const { auth, sql } = vi.hoisted(() => ({ auth: vi.fn(), sql: vi.fn() }));
vi.mock("@/auth", () => ({ auth }));
vi.mock("@neondatabase/serverless", () => ({ neon: () => sql }));
import { GET } from "@/app/api/training-clips/[id]/route";
const params = Promise.resolve({ id: "9372749d-1722-4570-a25f-fb3ce066f666" });
function get(range?: string) {
  return GET(new Request("https://example.org/api/training-clips/test", { headers: range ? { Range: range } : {} }), { params });
}
beforeEach(() => { vi.resetAllMocks(); auth.mockResolvedValue({ user: { email: "rudymawerllc@gmail.com" } }); });
it("checks management access before looking up recordings", async () => {
  auth.mockResolvedValue({ user: { email: "rep@example.org" } });
  expect((await get()).status).toBe(403);
  expect(sql).not.toHaveBeenCalled();
});
it("returns a browser seek across chunk boundaries", async () => {
  sql.mockResolvedValueOnce([{ size_bytes: 262147 }])
    .mockResolvedValueOnce([{ data: Buffer.alloc(262144, 1).toString("base64") }])
    .mockResolvedValueOnce([{ data: Buffer.from([2,3,4]).toString("base64") }]);
  const r = await get("bytes=262143-262145");
  expect(r.status).toBe(206);
  expect(r.headers.get("Content-Range")).toBe("bytes 262143-262145/262147");
  expect(Array.from(new Uint8Array(await r.arrayBuffer()))).toEqual([1,2,3]);
});
it("rejects out of bounds and empty ranges", async () => {
  sql.mockResolvedValue([{ size_bytes: 8 }]);
  for (const range of ["bytes=10-", "bytes=-", "bytes=-0", "bytes=5-3"])
    expect((await get(range)).status).toBe(416);
});
