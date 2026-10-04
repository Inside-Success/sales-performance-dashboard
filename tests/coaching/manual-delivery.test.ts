import { describe, expect, it } from "vitest";
import { manualDeliveryUrls, MANUAL_PRODUCTION_ORIGIN } from "@/lib/manual-delivery";
const id = "716dd1bd1e2944e6acf8660cf70c853e";
describe("manual production delivery boundary", () => {
  it("pins callbacks and report links to the verified live origin", () => {
    expect(manualDeliveryUrls(MANUAL_PRODUCTION_ORIGIN, id, "production")).toEqual({
      callbackUrl: `${MANUAL_PRODUCTION_ORIGIN}/api/manual-reports/callback`,
      reportUrl: `${MANUAL_PRODUCTION_ORIGIN}/self-report/${id}`,
    });
  });
  it.each(["http://localhost:3000", "http://127.0.0.1", "http://[::1]", "https://preview.vercel.app", "https://sales-performance-dashboard-rose.vercel.app.attacker.com", "https://user@sales-performance-dashboard-rose.vercel.app", `${MANUAL_PRODUCTION_ORIGIN}/wrong`, `${MANUAL_PRODUCTION_ORIGIN}?x=1`])("rejects unsafe origins before paid dispatch: %s", (origin) => {
    expect(() => manualDeliveryUrls(origin, id, "production")).toThrow();
  });
  it.each([undefined, "development", "preview"])("blocks production dispatch from %s", (env) => {
    expect(() => manualDeliveryUrls(MANUAL_PRODUCTION_ORIGIN, id, env)).toThrow();
  });
});
