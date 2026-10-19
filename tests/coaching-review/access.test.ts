import { beforeEach, describe, it, expect, vi } from "vitest";
const mocks=vi.hoisted(()=>({guard:vi.fn(),query:vi.fn(),neon:vi.fn()}));
vi.mock("@/lib/rep-scoring/access",()=>({requireRepScoringAdmin:mocks.guard}));
vi.mock("@neondatabase/serverless",()=>({neon:mocks.neon}));
import { getReview, getReviewList } from "../../src/lib/coaching-review/data";
beforeEach(()=>{vi.clearAllMocks();mocks.guard.mockResolvedValue({});mocks.neon.mockReturnValue(mocks.query);mocks.query.mockResolvedValue([]);process.env.DATABASE_URL="postgres://test";});
describe("private review reads",()=>{
 it("checks authorization before any database call",async()=>{
  mocks.guard.mockRejectedValue(new Error("redirect"));
  await expect(getReviewList()).rejects.toThrow("redirect");
  await expect(getReview(1)).rejects.toThrow("redirect");
  expect(mocks.neon).not.toHaveBeenCalled();
 });
 it("rejects arbitrary report identifiers without querying",async()=>{
  expect(await getReview(0)).toBeNull();expect(await getReview(11)).toBeNull();expect(await getReview(1.5)).toBeNull();
  expect(mocks.query).not.toHaveBeenCalled();
 });
 it("only reads the fixed experiment and published outputs",async()=>{
  await getReviewList();
  const [template,run]=mocks.query.mock.calls[0];
  expect(template.join("")).toContain("ai_eval->>'published'='true'");
  expect(run).toBe("objection-review-2026-10-20");
  expect(template.join("").toLowerCase()).not.toMatch(/insert|update|delete|create/);
 });
});

