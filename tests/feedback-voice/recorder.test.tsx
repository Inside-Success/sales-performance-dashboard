// @vitest-environment jsdom
import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VoiceFeedbackRecorder } from "@/components/dashboard/voice-feedback-recorder";
const context = { kind: "faq" as const, conversationId: "chat", messageId: "answer" };
const captures: FakeRecorder[] = [];
const currentCapture = () => captures[captures.length - 1];
class FakeRecorder {
  static isTypeSupported = () => true;
  state = "inactive"; mimeType = "audio/webm";
  ondataavailable?: (e: { data: Blob }) => void; onstop?: () => void; onerror?: () => void;
  constructor() { captures.push(this); }
  start() { this.state = "recording"; }
  stop() { this.state = "inactive"; this.ondataavailable?.({ data: new Blob(["recording"], { type: this.mimeType }) }); this.onstop?.(); }
}
let stop: ReturnType<typeof vi.fn>, microphone: ReturnType<typeof vi.fn>;
const speech = { value: true };
class FakeAudio {
  state = "running";
  close = async () => undefined; resume = async () => undefined;
  createMediaStreamSource = () => ({ connect() {} });
  createAnalyser = () => ({ fftSize: 512, getByteTimeDomainData(values: Uint8Array) { values.fill(speech.value ? 140 : 128); } });
}
async function start() {
  fireEvent.click(screen.getByRole("button", { name: "Record feedback" }));
  await waitFor(() => expect(screen.getByRole("button", { name: /Stop recording/ })).toBeTruthy());
}
describe("voice recorder lifecycle", () => {
  beforeEach(() => {
    captures.length = 0; speech.value = true; stop = vi.fn(); microphone = vi.fn().mockResolvedValue({ getTracks: () => [{ stop }], getAudioTracks: () => [{ stop }] });
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: microphone } });
    vi.stubGlobal("MediaRecorder", FakeRecorder); vi.stubGlobal("AudioContext", FakeAudio);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ text: "I did not refuse payment." }) }));
  });
  afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });
  it("only records after a click and adds editable text without submitting feedback", async () => {
    const append = vi.fn(); render(<VoiceFeedbackRecorder context={context} onTranscript={append}/>); expect(microphone).not.toHaveBeenCalled();
    await start(); await act(async () => { await new Promise(resolve => setTimeout(resolve, 550)); });
    fireEvent.click(screen.getByRole("button", { name: /Stop recording/ }));
    await waitFor(() => expect(append).toHaveBeenCalledWith("I did not refuse payment."));
    expect(fetch).toHaveBeenCalledOnce(); expect(vi.mocked(fetch).mock.calls[0][0]).toBe("/api/feedback/transcribe"); expect(stop).toHaveBeenCalled();
  });
  it("keeps typing available when microphone permission is denied", async () => {
    microphone.mockRejectedValue(new DOMException("denied", "NotAllowedError")); render(<VoiceFeedbackRecorder context={context} onTranscript={vi.fn()}/>);
    fireEvent.click(screen.getByRole("button", { name: "Record feedback" })); await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("not allowed")); expect(fetch).not.toHaveBeenCalled();
  });
  it("stops late permission grants after cancel without capturing or paying", async () => {
    let grant: (stream: unknown) => void = () => undefined; microphone.mockImplementation(() => new Promise(resolve => { grant = resolve; }));
    render(<VoiceFeedbackRecorder context={context} onTranscript={vi.fn()}/>); fireEvent.click(screen.getByRole("button", { name: "Record feedback" })); fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await act(async () => grant({ getTracks: () => [{ stop }] })); expect(stop).toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
  });
  it("discards recording and releases the microphone on navigation/context change", async () => {
    const append = vi.fn(); const view = render(<VoiceFeedbackRecorder context={context} onTranscript={append}/>); await start();
    view.rerender(<VoiceFeedbackRecorder context={{ ...context, messageId: "another-answer" }} onTranscript={append}/>);
    expect(stop).toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled(); expect(screen.getByRole("button", { name: "Record feedback" })).toBeTruthy();
  });
  it("rejects silence before any paid request", async () => {
    speech.value = false; render(<VoiceFeedbackRecorder context={context} onTranscript={vi.fn()}/>); await start(); await act(async () => { await new Promise(resolve => setTimeout(resolve, 550)); });
    fireEvent.click(screen.getByRole("button", { name: /Stop recording/ })); expect(screen.getByRole("alert").textContent).toContain("No clear speech"); expect(fetch).not.toHaveBeenCalled();
  });
  it("retains a failed recording and retries with the exact same paid-request identity", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("network")); const append = vi.fn(); render(<VoiceFeedbackRecorder context={context} onTranscript={append}/>); await start();
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 550)); }); fireEvent.click(screen.getByRole("button", { name: /Stop recording/ }));
    await screen.findByRole("button", { name: "Retry transcription" }); const first = (vi.mocked(fetch).mock.calls[0][1]?.body as FormData).get("requestId");
    fireEvent.click(screen.getByRole("button", { name: "Retry transcription" })); await waitFor(() => expect(append).toHaveBeenCalledOnce());
    expect((vi.mocked(fetch).mock.calls[1][1]?.body as FormData).get("requestId")).toBe(first);
  });
  it("does not apply a late transcript to a different answer", async () => {
    let complete: (value: Response) => void = () => undefined; vi.mocked(fetch).mockImplementation(() => new Promise(resolve => { complete = resolve; }));
    const append = vi.fn(); const view = render(<VoiceFeedbackRecorder context={context} onTranscript={append}/>); await start(); await act(async () => { await new Promise(resolve => setTimeout(resolve, 550)); }); fireEvent.click(screen.getByRole("button", { name: /Stop recording/ }));
    view.rerender(<VoiceFeedbackRecorder context={{ ...context, conversationId: "other-chat" }} onTranscript={append}/>);
    await act(async () => complete({ ok: true, json: async () => ({ text: "Old transcript" }) } as Response)); expect(append).not.toHaveBeenCalled();
  });
  it("prevents simultaneous microphone sessions in two forms", async () => {
    const view = render(<VoiceFeedbackRecorder context={context} onTranscript={vi.fn()}/>); await start();
    render(<VoiceFeedbackRecorder context={{ ...context, messageId: "second" }} onTranscript={vi.fn()}/>); fireEvent.click(screen.getByRole("button", { name: "Record feedback" }));
    expect(screen.getByRole("alert").textContent).toContain("other recording"); expect(microphone).toHaveBeenCalledOnce(); view.unmount();
  });
  it("offers a typed fallback when recording is unsupported", () => {
    vi.stubGlobal("MediaRecorder", undefined); render(<VoiceFeedbackRecorder context={context} onTranscript={vi.fn()}/>);
    fireEvent.click(screen.getByRole("button", { name: "Record feedback" })); expect(screen.getByRole("alert").textContent).toContain("unavailable in this browser"); expect(microphone).not.toHaveBeenCalled();
  });
  it("releases the microphone on capture error without submitting partial audio", async () => {
    render(<VoiceFeedbackRecorder context={context} onTranscript={vi.fn()}/>); await start();
    act(() => currentCapture().onerror?.()); expect(stop).toHaveBeenCalled(); expect(screen.getByRole("alert").textContent).toContain("interrupted"); expect(fetch).not.toHaveBeenCalled();
  });
  it("stops automatically at two minutes", async () => {
    vi.useFakeTimers(); const append = vi.fn(); render(<VoiceFeedbackRecorder context={context} onTranscript={append}/>);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Record feedback" })); });
    await act(async () => { vi.advanceTimersByTime(120_100); });
    expect(currentCapture().state).toBe("inactive"); expect(stop).toHaveBeenCalled(); expect(append).toHaveBeenCalledOnce();
    expect((vi.mocked(fetch).mock.calls[0][1]?.body as FormData).get("seconds")).toBe("120");
  });
});
