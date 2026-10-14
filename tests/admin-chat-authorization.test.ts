import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), sales: vi.fn(), attendance: vi.fn() }));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/sales-impact-data", () => ({ getSalesImpactAnalytics: mocks.sales }));
vi.mock("@/lib/rep-no-show", () => ({ getRepNoShowAnalytics: mocks.attendance, normalizeRepNoShowWindow: () => 7 }));
import { POST as salesChat } from "@/app/api/sales-analytics-chat/route";
import { POST as attendanceChat } from "@/app/api/rep-no-show-chat/route";
beforeEach(() => { vi.clearAllMocks(); });
afterEach(() => vi.restoreAllMocks());
for (const [name, route] of [["sales", salesChat], ["attendance", attendanceChat]] as const) {
  it.each([null, {user: {email: "rep@insidesuccess.com"}}])(`${name} rejects unauthorized access before any data/provider read`, async session => {
    mocks.auth.mockResolvedValue(session);
    const fetch = vi.spyOn(globalThis, "fetch");
    const result = await route(new NextRequest(`https://example.com/api/${name}`, {method: "POST", body: "invalid json"}));
    expect(result.status).toBe(session ? 403 : 401);
    expect(mocks.sales).not.toHaveBeenCalled();
    expect(mocks.attendance).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
  it(`${name} permits approved leadership to reach normal request validation`, async () => {
    mocks.auth.mockResolvedValue({user: {email: "rudymawerllc@gmail.com"}});
    const result = await route(new NextRequest(`https://example.com/api/${name}`, {method: "POST", body: "invalid json"}));
    expect(result.status).toBe(400);
  });
}
