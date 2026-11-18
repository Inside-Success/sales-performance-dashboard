import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, expect, it, vi } from "vitest";

// The table is created by the first write. If that first attempt fails (database down, or two
// servers creating it at the same moment), the next write must set it up again and succeed.
const state = vi.hoisted(() => ({ db: null as PGlite | null, failures: 0, statements: [] as string[] }));
vi.mock("next/server", () => ({ after: vi.fn() }));
vi.mock("@/lib/database-connection", () => ({ databaseUrl: () => "isolated-test-only" }));
vi.mock("@neondatabase/serverless", () => ({
  neon: () => (parts: TemplateStringsArray, ...values: unknown[]) => {
    const text = parts.reduce((sum, part, index) => sum + part + (index < values.length ? `$${index + 1}` : ""), "");
    state.statements.push(text.trim().split(/\s+/).slice(0, 3).join(" "));
    if (state.failures > 0) {
      state.failures -= 1;
      return Promise.reject(new Error("duplicate key value violates unique constraint"));
    }
    return state.db!.query(text, values).then((result) => result.rows);
  },
}));

import { listGreenLightTrace, recordGreenLightTrace } from "@/lib/green-light/trace-store";

beforeAll(async () => {
  state.db = await PGlite.create();
}, 30_000);
afterAll(async () => {
  await state.db?.close();
});

it("sets the table up again after a failed first attempt, then only once", async () => {
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  state.failures = 1;
  await expect(recordGreenLightTrace({ event: "generate", rep_email: "rep@insidesuccess.com", job_id: "v2_1763500000000_first1" })).resolves.toBeUndefined();
  expect(errors).toHaveBeenCalledWith("Green light trace not saved", "generate", "Error");
  await expect(state.db!.query("select 1 from green_light_letter_trace")).rejects.toThrow();

  await recordGreenLightTrace({ event: "generate", rep_email: "rep@insidesuccess.com", job_id: "v2_1763500000000_second" });
  expect((await listGreenLightTrace({})).map((row) => row.job_id)).toEqual(["v2_1763500000000_second"]);

  const before = state.statements.filter((statement) => statement.startsWith("create")).length;
  await recordGreenLightTrace({ event: "save", rep_email: "rep@insidesuccess.com", job_id: "v2_1763500000000_second" });
  expect(state.statements.filter((statement) => statement.startsWith("create")).length).toBe(before);
  expect(await listGreenLightTrace({})).toHaveLength(2);
});
