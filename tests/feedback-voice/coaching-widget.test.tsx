// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
vi.mock("@/lib/report-version", () => ({ isEnhancedReport: () => true }));
vi.mock("@/components/dashboard/voice-feedback-recorder", () => ({ VoiceFeedbackRecorder: ({ onTranscript, onBusyChange }: { onTranscript: (text: string) => void; onBusyChange: (busy: boolean) => void }) => <div>
  <button type="button" onClick={() => onBusyChange(true)}>Start microphone</button>
  <button type="button" onClick={() => { onTranscript("I did not refuse payment."); onBusyChange(false); }}>Complete voice</button>
</div> }));
import { ReportFeedbackWidget } from "@/components/dashboard/report-feedback-widget";
const props = { reportType: "official" as const, reportId: 123, repName: "Rep", reportCoachingVersion: "enhanced" };
beforeEach(() => { vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe("coaching feedback integration", () => {
  it("leaves likes as one click without a recorder or comment", async () => {
    render(<ReportFeedbackWidget {...props}/>); expect(screen.queryByText("Start microphone")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Mark report helpful" })); await screen.findByText("Glad it helped");
    expect(fetch).toHaveBeenCalledOnce(); expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body))).toEqual(expect.objectContaining({ rating: "positive", comment: null }));
  });
  it("keeps typed words, blocks sending while busy, and submits the final approved comment", async () => {
    render(<ReportFeedbackWidget {...props}/>); fireEvent.click(screen.getByRole("button", { name: "Report needs changes" }));
    fireEvent.change(screen.getByRole("textbox", { name: "What was off in this report?" }), { target: { value: "Typed first." } });
    fireEvent.click(screen.getByRole("button", { name: "Start microphone" }));
    expect((screen.getByRole("button", { name: "Send feedback" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Complete voice" }));
    expect((screen.getByRole("textbox", { name: "What was off in this report?" }) as HTMLTextAreaElement).value).toBe("Typed first.\n\nI did not refuse payment.");
    expect(fetch).not.toHaveBeenCalled(); fireEvent.click(screen.getByRole("button", { name: "Send feedback" }));
    await waitFor(() => expect(fetch).toHaveBeenCalledOnce()); expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body))).toEqual(expect.objectContaining({ report_id: "123", rating: "negative", comment: "Typed first.\n\nI did not refuse payment." }));
  });
  it("clears unsent state when navigating to a different report", () => {
    const view = render(<ReportFeedbackWidget {...props}/>); fireEvent.click(screen.getByRole("button", { name: "Report needs changes" }));
    fireEvent.change(screen.getByRole("textbox", { name: "What was off in this report?" }), { target: { value: "Only for report 123." } });
    view.rerender(<ReportFeedbackWidget {...props} reportId={456}/>); expect(screen.queryByRole("textbox", { name: "What was off in this report?" })).toBeNull(); expect(fetch).not.toHaveBeenCalled();
  });
});
