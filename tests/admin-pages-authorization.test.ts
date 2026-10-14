import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), usage: vi.fn(), sales: vi.fn(), compliance: vi.fn(), attendance: vi.fn() }));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
vi.mock("@/lib/usage-overview-data", () => ({ getUsageOverview: mocks.usage }));
vi.mock("@/lib/sales-impact-data", () => ({ getSalesImpactAnalytics: mocks.sales }));
vi.mock("@/lib/compliance-dashboard", () => ({ getComplianceDashboardData: mocks.compliance }));
vi.mock("@/lib/rep-no-show", () => ({ getRepNoShowAnalytics: mocks.attendance, normalizeRepNoShowWindow: () => 7, REP_NO_SHOW_WINDOWS: [7,14,30,90] }));
import UsagePage from "@/app/manager/usage/page";
import SalesPage from "@/app/manager/sales-correlation/page";
import CompliancePage from "@/app/manager/compliance/page";
import AttendancePage from "@/app/manager/rep-no-show/page";
beforeEach(() => { vi.clearAllMocks(); mocks.auth.mockResolvedValue({user: {email: "regular.rep@insidesuccess.com"}}); });
for (const [name, page] of [["usage", UsagePage], ["sales", SalesPage], ["compliance", CompliancePage], ["attendance", AttendancePage]] as const) {
  it(`${name} blocks direct page requests before reading manager data`, async () => {
    await expect(page({searchParams: Promise.resolve({})})).rejects.toThrow("redirect:/coaching");
    expect(mocks.usage).not.toHaveBeenCalled();
    expect(mocks.sales).not.toHaveBeenCalled();
    expect(mocks.compliance).not.toHaveBeenCalled();
    expect(mocks.attendance).not.toHaveBeenCalled();
  });
}
