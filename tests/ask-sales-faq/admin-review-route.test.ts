import { beforeEach, describe, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  access: vi.fn(),
  admin: vi.fn(),
  save: vi.fn(),
}));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/ask-sales-faq/access", () => ({
  getAskSalesFaqAccess: mocks.access,
  isAskSalesFaqAdmin: mocks.admin,
}));
vi.mock("@/lib/ask-sales-faq/admin/store", () => ({ saveReview: mocks.save }));
import { POST } from "../../src/app/api/ask-sales-faq/admin/conversations/[conversationId]/review/route";
const request = (
  origin = "https://example.com",
  body: unknown = {
    reviewed: true,
    note: "Internal note",
    version: 0,
    through: "2026-09-17T00:00:00.123456Z",
  },
) =>
  new Request(
    "https://example.com/api/ask-sales-faq/admin/conversations/test/review",
    {
      method: "POST",
      headers: { origin, "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
const params = { params: Promise.resolve({ conversationId: "test" }) };
beforeEach(() => {
  mocks.access.mockReturnValue({ ok: true, viewerEmail: "admin@example.com" });
  mocks.admin.mockReturnValue(true);
  mocks.save.mockResolvedValue(true);
});
describe("admin review write boundary", () => {
  it("blocks non-admins without touching storage", async () => {
    mocks.admin.mockReturnValue(false);
    expect((await POST(request(), params)).status).toBe(404);
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("blocks cross-origin writes", async () => {
    expect((await POST(request("https://evil.example"), params)).status).toBe(
      403,
    );
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("rejects invalid notes", async () => {
    expect(
      (
        await POST(
          request("https://example.com", {
            reviewed: true,
            note: "x".repeat(2001),
            version: 0,
            through: "bad",
          }),
          params,
        )
      ).status,
    ).toBe(400);
  });
  it("retains microsecond watermark and server actor", async () => {
    expect((await POST(request(), params)).status).toBe(200);
    expect(mocks.save).toHaveBeenCalledWith(
      "test",
      "admin@example.com",
      expect.objectContaining({ through: "2026-09-17T00:00:00.123456Z" }),
    );
  });
  it("does not report conflicting writes as saved", async () => {
    mocks.save.mockResolvedValue(false);
    expect((await POST(request(), params)).status).toBe(409);
  });
  it("does not report storage errors as saved", async () => {
    mocks.save.mockRejectedValue(Error("db"));
    expect((await POST(request(), params)).status).toBe(503);
  });
});
