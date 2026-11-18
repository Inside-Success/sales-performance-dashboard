import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The green light page is for every signed-in rep, not only admins. These checks open the page and
// call its routes as an ordinary rep who is on no admin list.
const mocks = vi.hoisted(() => ({ auth: vi.fn() }));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("not-found");
  },
}));
vi.mock("@/lib/green-light/trace-store", () => ({ recordGreenLightTrace: vi.fn() }));

import { NextRequest } from "next/server";
import { POST as generate } from "@/app/api/green-light/generate/route";
import { POST as refine } from "@/app/api/green-light/refine/route";
import { POST as save } from "@/app/api/green-light/save/route";
import { GET as status } from "@/app/api/green-light/status/route";
import { POST as transcript } from "@/app/api/green-light/transcript/route";
import GreenLightPage from "@/app/green-light/page";
import { GreenLightGenerator } from "@/components/green-light/green-light-generator";
import { canAccessAdminDirectory, isMagicMikeAdmin, isSalesFaqAdmin } from "@/lib/admin-access-policy";
import { isAllowedAuthEmail } from "@/lib/auth-utils";
import { canUseGreenLight } from "@/lib/green-light/server";

const REP = "regular.rep@insidesuccess.com";
type Element = { type: unknown; props: { children?: unknown } };
const contains = (node: unknown, component: unknown): boolean => {
  if (Array.isArray(node)) return node.some((child) => contains(child, component));
  if (!node || typeof node !== "object") return false;
  const element = node as Element;
  return element.type === component || contains(element.props?.children, component);
};
const request = (path: string, body?: unknown) =>
  new NextRequest(`https://example.com/api/green-light/${path}`, body === undefined ? undefined : { method: "POST", body: JSON.stringify(body) });

beforeEach(() => {
  mocks.auth.mockResolvedValue({ user: { email: REP, name: "Regular Rep" } });
  vi.stubEnv("GREEN_LIGHT_LETTERS_DISABLED", "");
  vi.stubEnv("GREEN_LIGHT_LETTERS_PILOT_EMAILS", "");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("green light page for a rep who is not an admin", () => {
  it("uses an account that can sign in but is on no admin list", () => {
    expect(isAllowedAuthEmail(REP)).toBe(true);
    expect(isMagicMikeAdmin(REP)).toBe(false);
    expect(isSalesFaqAdmin(REP)).toBe(false);
    expect(canAccessAdminDirectory(REP)).toBe(false);
    expect(canUseGreenLight(REP)).toBe(true);
  });

  it("opens the page with the generator on it", async () => {
    const page = await GreenLightPage();
    expect(contains(page, GreenLightGenerator)).toBe(true);
  });

  it("is not found for a signed-out visitor, or when the feature is switched off", async () => {
    mocks.auth.mockResolvedValue(null);
    await expect(GreenLightPage()).rejects.toThrow("not-found");
    mocks.auth.mockResolvedValue({ user: { email: REP } });
    vi.stubEnv("GREEN_LIGHT_LETTERS_DISABLED", "true");
    await expect(GreenLightPage()).rejects.toThrow("not-found");
  });

  it("lets the rep through every route to the normal checks of what they sent", async () => {
    const fetch = vi.spyOn(globalThis, "fetch");
    // An empty request is refused for what it contains (400), never for who is asking (401/403).
    for (const route of [generate, refine, save, transcript]) {
      const response = await route(request("x", {}));
      expect(response.status).toBe(400);
      expect((await response.json()).code).toBe("invalid");
    }
    expect((await status(request("status?job_id=nope"))).status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("turns away a signed-out visitor on every route before anything else happens", async () => {
    mocks.auth.mockResolvedValue(null);
    const fetch = vi.spyOn(globalThis, "fetch");
    for (const route of [generate, refine, save, transcript]) expect((await route(request("x", {}))).status).toBe(401);
    expect((await status(request("status?job_id=v2_1763500000000_abc123"))).status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });
});
