// @vitest-environment jsdom
import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const { guard, sql } = vi.hoisted(() => ({ guard: vi.fn(), sql: vi.fn() }));
vi.mock("@/lib/rep-scoring/access", () => ({ requireRepScoringAdmin: guard }));
vi.mock("@neondatabase/serverless", () => ({ neon: () => sql }));
import TrainingClips from "@/app/manager/training-clips/page";
afterEach(() => { cleanup(); vi.resetAllMocks(); });
const picks = ["Rae", "Jay"].map((rep, i) => ({ id: "clip-" + i, rep, topic: "Topic " + rep,
  date: "2026-11-20", show: "Reality TV", range: "1:01–2:01", duration: "1:00",
  moment: ["Cast asks for time.", "Rep agrees to reconnect."] }));
it("opens the exact video selected by the companion Sheet", async () => {
  sql.mockResolvedValue([{ picks, report_date: "2026-11-25", sheet_url: "https://example.org" }]);
  const { container } = render(await TrainingClips({ searchParams: Promise.resolve({ clip: "clip-1" }) }));
  expect(guard).toHaveBeenCalledOnce();
  expect(container.querySelectorAll("details")).toHaveLength(2);
  const selected = container.querySelector("details[open]");
  expect(selected?.id).toBe("clip-1");
  expect(selected?.querySelector("video")?.getAttribute("src")).toBe("/api/training-clips/clip-1");
});
it("filters the same report to one rep", async () => {
  sql.mockResolvedValue([{ picks, report_date: "2026-11-25", sheet_url: "https://example.org" }]);
  render(await TrainingClips({ searchParams: Promise.resolve({ rep: "Rae" }) }));
  expect(screen.getByText("Topic Rae")).toBeTruthy();
  expect(screen.queryByText("Topic Jay")).toBeNull();
});
