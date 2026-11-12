"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square, X } from "lucide-react";
import { audioExtension, type VoiceContext, VOICE_MAX_BYTES, VOICE_MAX_SECONDS } from "@/lib/feedback-voice";

let microphoneOwner: symbol | null = null;
type Phase = "idle" | "permission" | "recording" | "transcribing" | "error";
type Recording = { blob: Blob; seconds: number; id: string };

type VoiceProps = {
  context: VoiceContext; onTranscript: (text: string) => void;
  onBusyChange?: (busy: boolean) => void; disabled?: boolean;
};
export function VoiceFeedbackRecorder(props: VoiceProps) {
  return <VoiceFeedbackRecorderSession key={JSON.stringify(props.context)} {...props}/>;
}
function VoiceFeedbackRecorderSession({context,onTranscript,onBusyChange,disabled=false}:VoiceProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");
  const [recording, setRecording] = useState<Recording | null>(null);
  const [notice, setNotice] = useState("");
  const token = useRef(Symbol("feedback microphone"));
  const generation = useRef(0);
  const stream = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const abort = useRef<AbortController | null>(null);
  const requestBusy = useRef(false);
  const audioContext = useRef<AudioContext | null>(null);
  const callbacks = useRef({ onTranscript, onBusyChange });
  useEffect(() => { callbacks.current = { onTranscript, onBusyChange }; });
  const contextKey = JSON.stringify(context);

  function releaseMicrophone() {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    if (recorder.current?.state === "recording") recorder.current.stop();
    recorder.current = null;
    stream.current?.getTracks().forEach(track => track.stop());
    stream.current = null;
    void audioContext.current?.close().catch(() => undefined);
    audioContext.current = null;
    if (microphoneOwner === token.current) microphoneOwner = null;
  }

  useEffect(() => {
    // Context changes/unmount invalidate permission, audio and network callbacks.
    return () => {
      // This is a lifecycle counter, not a DOM node ref; invalidate late async work.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      generation.current++;
      abort.current?.abort();
      releaseMicrophone();
      callbacks.current.onBusyChange?.(false);
    };
  }, []);

  const busy = phase === "permission" || phase === "recording" || phase === "transcribing";
  useEffect(() => { callbacks.current.onBusyChange?.(busy); }, [busy]);

  async function transcribe(saved: Recording, run = generation.current) {
    if (requestBusy.current) return;
    requestBusy.current = true;
    setPhase("transcribing"); setError(""); setNotice("");
    const controller = new AbortController();
    abort.current = controller;
    const timeout = setTimeout(() => controller.abort(), 50_000);
    try {
      const form = new FormData();
      form.set("audio", saved.blob, `feedback.${audioExtension(saved.blob.type) ?? "webm"}`);
      form.set("context", contextKey); form.set("requestId", saved.id); form.set("seconds", String(saved.seconds));
      const response = await fetch("/api/feedback/transcribe", { method: "POST", body: form, signal: controller.signal });
      const data = await response.json().catch(() => null);
      if (!response.ok || typeof data?.text !== "string" || !data.text.trim()) throw Error(data?.error || "Transcription could not finish. You can still type your feedback.");
      if (generation.current !== run) return;
      callbacks.current.onTranscript(data.text.trim());
      setRecording(null); setPhase("idle"); setNotice("Added to your feedback. Check the words before submitting.");
    } catch (failure) {
      if (generation.current !== run) return;
      setPhase("error");
      setError(failure instanceof Error && failure.name !== "AbortError" ? failure.message : "Transcription timed out. You can retry this recording or type your feedback.");
    } finally {
      clearTimeout(timeout);
      if (abort.current === controller) { abort.current = null; requestBusy.current = false; }
    }
  }

  async function start() {
    if (busy || disabled) return;
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setPhase("error"); setError("Recording is unavailable in this browser. Please type your feedback."); return;
    }
    if (microphoneOwner) { setPhase("error"); setError("Finish or cancel the other recording first."); return; }
    microphoneOwner = token.current;
    const run = ++generation.current;
    setRecording(null); setError(""); setNotice(""); setSeconds(0); setPhase("permission");
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (generation.current !== run) { media.getTracks().forEach(track => track.stop()); return; }
      stream.current = media;
      const mime = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus", "audio/webm"].find(type => MediaRecorder.isTypeSupported(type));
      const capture = new MediaRecorder(media, mime ? { mimeType: mime, audioBitsPerSecond: 64_000 } : undefined);
      if (!audioExtension(capture.mimeType)) throw Error("This browser's recording format is unsupported. Please type your feedback.");
      recorder.current = capture;
      const chunks: Blob[] = [];
      let size = 0, samplesWithSound = 0, audioWasChecked = false;
      let analyser: AnalyserNode | null = null;
      try {
        const ac = new AudioContext(); audioContext.current = ac;
        const source = ac.createMediaStreamSource(media); analyser = ac.createAnalyser(); analyser.fftSize = 512; source.connect(analyser);
        // A browser can suspend Web Audio even when microphone capture works.
        // Never hold the recorder open waiting for an autoplay permission.
        void ac.resume().catch(() => undefined);
      } catch { /* Recording still works without Web Audio; empty files remain rejected. */ }
      if (generation.current !== run) { releaseMicrophone(); return; }
      const began = Date.now();
      capture.ondataavailable = event => { if (event.data.size) { chunks.push(event.data); size += event.data.size; if (size >= VOICE_MAX_BYTES && capture.state === "recording") capture.stop(); } };
      capture.onerror = () => {
        if (generation.current !== run) return;
        generation.current++; releaseMicrophone(); setPhase("error"); setError("Recording was interrupted. Please record again or type your feedback.");
      };
      capture.onstop = () => {
        if (generation.current !== run) return;
        const duration = Math.min(VOICE_MAX_SECONDS, (Date.now() - began) / 1000);
        releaseMicrophone();
        if (!size || size > VOICE_MAX_BYTES || duration < 0.5 || audioWasChecked && samplesWithSound < 3) {
          setPhase("error"); setError(size > VOICE_MAX_BYTES ? "Recording reached the size limit. Please make a shorter recording." : "No clear speech was detected. Please speak again or type your feedback."); return;
        }
        const saved = { blob: new Blob(chunks, { type: capture.mimeType }), seconds: duration, id: crypto.randomUUID() };
        setRecording(saved); void transcribe(saved, run);
      };
      capture.start(250); setPhase("recording");
      timer.current = setInterval(() => {
        const elapsed = (Date.now() - began) / 1000; setSeconds(Math.floor(elapsed));
        if (analyser && audioContext.current?.state === "running") {
          audioWasChecked = true;
          const values = new Uint8Array(analyser.fftSize); analyser.getByteTimeDomainData(values);
          const rms = Math.sqrt(values.reduce((sum, value) => sum + ((value - 128) / 128) ** 2, 0) / values.length);
          if (rms > 0.004) samplesWithSound++;
        }
        if (elapsed >= VOICE_MAX_SECONDS && capture.state === "recording") capture.stop();
      }, 100);
      media.getAudioTracks().forEach(track => { track.onended = () => {
        if (generation.current !== run || capture.state !== "recording") return;
        generation.current++; releaseMicrophone(); setPhase("error"); setError("Microphone disconnected. Please record again or type your feedback.");
      }; });
    } catch (failure) {
      if (generation.current !== run) return;
      releaseMicrophone(); setPhase("error");
      setError(failure && typeof failure === "object" && "name" in failure && failure.name === "NotAllowedError" ? "Microphone access was not allowed. You can enable it in your browser or type your feedback." : "Could not start recording. Check your microphone or type your feedback.");
    }
  }

  function cancel() { generation.current++; abort.current?.abort(); abort.current = null; requestBusy.current = false; releaseMicrophone(); setPhase("idle"); setRecording(null); setError(""); setNotice(""); }
  const button = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-red-700";
  return <div className="space-y-2">
    <div className="flex flex-wrap items-center gap-2">
      {!busy && <button type="button" className={button} disabled={disabled} onClick={() => void start()}><Mic aria-hidden="true" className="size-4"/>{recording ? "Record again" : "Record feedback"}</button>}
      {phase === "recording" && <button type="button" className={button} onClick={() => recorder.current?.stop()}><Square aria-hidden="true" className="size-4"/>Stop recording <span className="tabular-nums" aria-hidden="true">{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</span></button>}
      {busy && <button type="button" className={button} onClick={cancel}><X aria-hidden="true" className="size-4"/>Cancel</button>}
      {phase === "error" && recording && <button type="button" className={button} onClick={() => void transcribe(recording)}>Retry transcription</button>}
    </div>
    <p role="status" className="text-sm leading-5 text-slate-600">{phase === "permission" ? "Allow microphone access to start recording." : phase === "recording" ? "Recording · up to 2 minutes. Stop to turn your voice into editable text." : phase === "transcribing" ? "Transcribing your feedback…" : notice || "Or type below. Audio is sent for transcription when you stop; feedback is submitted only when you choose Submit."}</p>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
  </div>;
}
