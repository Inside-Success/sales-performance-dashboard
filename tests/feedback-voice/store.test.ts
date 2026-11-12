import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
type Query = { query: string; values: unknown[]; then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => unknown };
const state = vi.hoisted(() => ({ db: null as PGlite | null }));
vi.mock("@/lib/database-connection", () => ({ databaseUrl: () => "isolated-test-only" }));
vi.mock("@neondatabase/serverless", () => ({ neon: () => {
  const query = (parts: TemplateStringsArray, ...values: unknown[]) => {
    const text = parts.reduce((sum, part, index) => sum + part + (index < values.length ? `$${index + 1}` : ""), "");
    return { query: text, values, then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => state.db!.query(text, values).then(result => result.rows).then(resolve, reject) };
  };
  return Object.assign(query, { transaction: (queries: Query[]) => state.db!.transaction(async tx => {
    const results = [];
    for (const q of queries) results.push((await tx.query(q.query, q.values)).rows);
    return results;
  }) });
} }));
import { ensureFeedbackStorage, finishVoiceRequest, reserveVoiceRequest, saveCoachingFeedback, saveFaqDislikeOnce } from "@/lib/feedback-store";
beforeAll(async () => { state.db = await PGlite.create(); await ensureFeedbackStorage(); }, 30_000);
afterAll(async () => { await state.db?.close(); });
describe("isolated feedback receipt storage", () => {
  it("reserves once, holds replays, then reuses completed words with exact identity", async () => {
    expect(await reserveVoiceRequest("one", "a@inside.test", "hash", {})).toEqual({ state: "new" });
    expect(await reserveVoiceRequest("one", "a@inside.test", "hash", {})).toEqual({ state: "held" });
    expect(await reserveVoiceRequest("one", "a@inside.test", "changed", {})).toEqual({ state: "conflict" });
    await finishVoiceRequest("one", "complete", "Exact words.", "receipt", { seconds: 4 }, 400);
    expect(await reserveVoiceRequest("one", "a@inside.test", "hash", {})).toEqual({ state: "complete", text: "Exact words." });
    expect(await reserveVoiceRequest("one", "other@inside.test", "hash", {})).toEqual({ state: "conflict" });
  });
  it("limits simultaneous work and moves crashed stale work to an uncertain hold without replay", async () => {
    expect(await reserveVoiceRequest("active", "b@inside.test", "hash", {})).toEqual({ state: "new" });
    expect(await reserveVoiceRequest("second", "b@inside.test", "hash", {})).toEqual({ state: "limited" });
    await state.db!.query("update feedback_transcriptions set created_at=now()-interval '6 minutes' where id='active'");
    expect(await reserveVoiceRequest("second", "b@inside.test", "hash", {})).toEqual({ state: "new" });
    expect(await reserveVoiceRequest("active", "b@inside.test", "hash", {})).toEqual({ state: "held" });
    expect((await state.db!.query("select status from feedback_transcriptions where id='active'")).rows).toEqual([{ status: "uncertain" }]);
  });
  it("keeps at most twenty reservations per account per hour", async () => {
    for (let index = 0; index < 20; index++) {
      expect(await reserveVoiceRequest(`limit-${index}`, "limit@inside.test", "hash", {})).toEqual({ state: "new" });
      await finishVoiceRequest(`limit-${index}`, "failed", null, null, null, 1);
    }
    expect(await reserveVoiceRequest("limit-21", "limit@inside.test", "hash", {})).toEqual({ state: "limited" });
  });
  it("saves a coaching dislike exactly once and refuses edited or cross-user replays", async () => {
    expect(await saveCoachingFeedback("feedback", "rep@inside.test", "hash", { comment: "Keep this text." })).toEqual({ conflict: false, fresh: true });
    expect(await saveCoachingFeedback("feedback", "rep@inside.test", "hash", {})).toEqual({ conflict: false, fresh: false });
    expect((await saveCoachingFeedback("feedback", "rep@inside.test", "changed", {})).conflict).toBe(true);
    expect((await saveCoachingFeedback("feedback", "other@inside.test", "hash", {})).conflict).toBe(true);
    expect((await state.db!.query("select payload->>'comment' as comment from coaching_report_feedback where id='feedback'")).rows).toEqual([{ comment: "Keep this text." }]);
  });
  it("keeps FAQ dislikes owned by their exact assistant answer and avoids duplicate rows", async () => {
    await state.db!.exec("create table ask_sales_faq_messages(id text primary key,conversation_id text,viewer_email text,role text); create table ask_sales_faq_feedback(id text primary key,message_id text,conversation_id text,viewer_email text,rating text,comment text)");
    await state.db!.query("insert into ask_sales_faq_messages values('answer','chat','rep@inside.test','assistant'),('user-message','chat','rep@inside.test','user')");
    expect(await saveFaqDislikeOnce("faq1","rep@inside.test","chat","answer","Original")).toEqual({found:true,fresh:true});
    expect(await saveFaqDislikeOnce("faq1","rep@inside.test","chat","answer","Original")).toEqual({found:true,fresh:false});
    expect((await saveFaqDislikeOnce("faq1","rep@inside.test","chat","answer","Changed")).found).toBe(false);
    expect((await saveFaqDislikeOnce("faq2","another@inside.test","chat","answer","Original")).found).toBe(false);
    expect((await saveFaqDislikeOnce("faq3","rep@inside.test","chat","user-message","Original")).found).toBe(false);
    expect((await state.db!.query("select count(*)::int as count from ask_sales_faq_feedback")).rows).toEqual([{count:1}]);
  });
});
