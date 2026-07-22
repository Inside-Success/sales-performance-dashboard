"use client";

import { FormEvent, useEffect, useState } from "react";
import { Bot, CheckCircle2, FlaskConical, KeyRound, Loader2, RefreshCcw, Route, Send, ShieldAlert, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type LabCitation = {
  policyId: string;
  title: string;
  lastReviewed: string;
  sourceKind: string;
};

type LabAssistantMessage = {
  id: string;
  role: "assistant";
  content: string;
  lane: string;
  latencyMs: number;
  citations: LabCitation[];
  routeChannels: string[];
  removedSentences: number;
  provider: "deepseek" | "anthropic" | null;
  model: string | null;
  executionMode: LabExecutionMode;
};

type LabMessage = LabAssistantMessage | { id: string; role: "user"; content: string };

type LabExecutionMode = {
  planning: "model" | "deterministic_governed" | "deterministic_fallback" | "systemic_model" | "systemic_fallback" | "conversation" | "unknown";
  composition: "model" | "exact_evidence" | "not_required" | "unknown";
  validation: "model_and_deterministic" | "deterministic_exact_evidence" | "not_required" | "unknown";
};

type LabResponse = {
  ok?: boolean;
  error?: string;
  conversationId?: string;
  historyToken?: string;
  messageId?: string;
  answer?: string;
  lane?: string;
  latencyMs?: number;
  citations?: LabCitation[];
  routeChannels?: string[];
  provider?: "deepseek" | "anthropic" | null;
  model?: string | null;
  runtimeMetadata?: {
    executionMode?: {
      planning?: LabExecutionMode["planning"];
      composition?: LabExecutionMode["composition"];
      validation?: LabExecutionMode["validation"];
    };
    validation?: { removedSentences?: string[] };
  };
};

type LabReadiness = {
  ok?: boolean;
  error?: string;
  ready?: boolean;
  accessTokenConfigured?: boolean;
  historySigningConfigured?: boolean;
  modelConfigured?: boolean;
  modelAccessConfirmed?: boolean;
  provider?: "deepseek" | "anthropic" | null;
  model?: string | null;
  maxModelCallSeconds?: number;
  maxRequestSeconds?: number;
  deepSeekRetries?: number;
  transport?: "vercel_ai_gateway" | "direct" | null;
};

type ReadinessState =
  | { status: "checking" }
  | { status: "ready"; data: LabReadiness }
  | { status: "not_ready"; data: LabReadiness }
  | { status: "unavailable"; message: string };

const starters = [
  "What are the current ISTV prices and payment plans?",
  "For VIP, do I submit the client to one Tier-1 platform or all three?",
  "A lead wants to put $2.5k down on Lite and upgrade to VIP later. What can I confirm?",
];

export function AskSalesV4Lab({
  apiPath = "/api/ask-sales-faq/v4-isolated",
  title = "Ask Sales V4 isolated lab",
  eyebrow = "Clean-room evaluation",
  description = "Parallel V4 retrieval and claim validation. It does not use V3 history, write to Neon, change the production selector, or save this chat.",
}: {
  apiPath?: string;
  title?: string;
  eyebrow?: string;
  description?: string;
}) {
  const [token, setToken] = useState("");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<LabMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [historyToken, setHistoryToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [readiness, setReadiness] = useState<ReadinessState>({ status: "checking" });
  const ready = readiness.status === "ready" && token.trim().length >= 24;

  useEffect(() => {
    const controller = new AbortController();

    async function checkReadiness() {
      try {
        const response = await fetch(apiPath, {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        });
        const data = await readJsonResponse<LabReadiness>(response, "V4 readiness check");
        if (!response.ok || !data.ok) throw new Error(data.error || `V4 readiness check failed with HTTP ${response.status}.`);
        setReadiness({ status: data.ready ? "ready" : "not_ready", data });
      } catch (readinessError) {
        if (readinessError instanceof DOMException && readinessError.name === "AbortError") return;
        setReadiness({
          status: "unavailable",
          message: readinessError instanceof Error ? readinessError.message : "The V4 readiness check failed.",
        });
      }
    }

    void checkReadiness();
    return () => controller.abort();
  }, [apiPath]);

  async function submit(event?: FormEvent, override?: string) {
    event?.preventDefault();
    const question = (override || input).trim();
    if (!question || !ready || loading) return;
    if (question.length > 6000) {
      setError("Questions are limited to 6,000 characters.");
      return;
    }
    const userMessage: LabMessage = { id: `user_${crypto.randomUUID()}`, role: "user", content: question };
    setMessages((current) => [...current, userMessage]);
    setInput("");
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(apiPath, {
        method: "POST",
        headers: { "content-type": "application/json", "x-ask-sales-v4-token": token.trim() },
        body: JSON.stringify({
          question,
          ...(historyToken ? { historyToken } : {}),
          ...(conversationId ? { conversationId } : {}),
        }),
      });
      const data = await readJsonResponse<LabResponse>(response, "V4 request");
      if (!response.ok || !data.ok || !data.answer || !data.messageId || !data.historyToken) throw new Error(data.error || "V4 did not return a complete encrypted response.");
      setConversationId(data.conversationId || conversationId);
      setHistoryToken(data.historyToken);
      setMessages((current) => [...current, {
        id: data.messageId!,
        role: "assistant",
        content: data.answer!,
        lane: data.lane || "route",
        latencyMs: data.latencyMs || 0,
        citations: data.citations || [],
        routeChannels: data.routeChannels || [],
        removedSentences: data.runtimeMetadata?.validation?.removedSentences?.length || 0,
        provider: data.provider || null,
        model: data.model || null,
        executionMode: {
          planning: data.runtimeMetadata?.executionMode?.planning || "unknown",
          composition: data.runtimeMetadata?.executionMode?.composition || "unknown",
          validation: data.runtimeMetadata?.executionMode?.validation || "unknown",
        },
      }]);
    } catch (requestError) {
      setMessages((current) => current.filter((message) => message.id !== userMessage.id));
      setInput((current) => current || question);
      setError(requestError instanceof Error ? requestError.message : "The isolated V4 request failed safely.");
    } finally {
      setLoading(false);
    }
  }

  function resetCase() {
    setInput("");
    setMessages([]);
    setConversationId(null);
    setHistoryToken(null);
    setError(null);
  }

  return (
    <main className="min-h-[calc(100dvh-72px)] bg-slate-950 px-4 py-8 text-slate-100 sm:px-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
        <header className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="mb-3 flex items-center gap-2 text-rose-300"><FlaskConical className="size-5" /><span className="text-xs font-black uppercase tracking-[0.22em]">{eyebrow}</span></div>
              <h1 className="text-3xl font-black tracking-tight">{title}</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">{description}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge className="border-emerald-400/20 bg-emerald-400/10 text-emerald-200"><ShieldCheck className="mr-1 size-3.5" />No persistence</Badge>
              <Badge className="border-sky-400/20 bg-sky-400/10 text-sky-200"><CheckCircle2 className="mr-1 size-3.5" />V3 untouched</Badge>
              <ReadinessBadge state={readiness} />
              <Button type="button" variant="outline" disabled={loading} onClick={resetCase} className="h-6 rounded-full border-white/20 bg-white/5 px-3 text-xs font-bold text-slate-200 hover:bg-white/10 hover:text-white"><RefreshCcw className="mr-1 size-3.5" />New case</Button>
            </div>
          </div>
          <div className="mt-5 flex max-w-xl items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/60 p-2">
            <KeyRound className="ml-2 size-4 text-slate-400" />
            <Input aria-label="Isolated lab access token" type="password" value={token} onChange={(event) => setToken(event.target.value)} placeholder="Enter the isolated lab access token" className="border-0 bg-transparent text-slate-100 shadow-none placeholder:text-slate-500 focus-visible:ring-0" autoComplete="off" />
          </div>
          <div role="note" className="mt-4 flex max-w-3xl items-start gap-2 rounded-2xl border border-amber-300/25 bg-amber-300/10 px-4 py-3 text-xs font-semibold leading-5 text-amber-100">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" />
            <span>Use fictional or already-redacted examples only. Never enter real client names, contact details, bank or card data, passwords, access tokens, or company credentials.</span>
          </div>
        </header>

        <section className="min-h-[28rem] rounded-3xl border border-white/10 bg-white p-4 text-slate-900 shadow-2xl sm:p-6">
          {!messages.length ? (
            <div className="grid min-h-[25rem] place-items-center">
              <div className="w-full max-w-2xl text-center">
                <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-rose-50 text-rose-600"><Bot className="size-7" /></span>
                <h2 className="mt-4 text-xl font-black">Test the questions that matter</h2>
                <p className="mt-2 text-sm text-slate-500">Routes are evaluated by their content; a useful grounded partial is not treated as a failure.</p>
                <div className="mt-5 grid gap-2 text-left">
                  {starters.map((starter) => <button key={starter} type="button" disabled={!ready} onClick={() => void submit(undefined, starter)} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 transition hover:border-rose-200 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-45">{starter}</button>)}
                </div>
              </div>
            </div>
          ) : (
            <div role="log" aria-live="polite" aria-relevant="additions text" aria-label="V4 lab conversation" className="space-y-5">
              {messages.map((message) => message.role === "user" ? (
                <div key={message.id} className="ml-auto max-w-2xl rounded-2xl rounded-br-md bg-slate-900 px-4 py-3 text-sm font-semibold leading-6 text-white">{message.content}</div>
              ) : (
                <article key={message.id} className="max-w-3xl rounded-2xl rounded-bl-md border border-slate-200 bg-slate-50 p-4">
                  <div className="mb-3 flex flex-wrap items-center gap-2"><LaneBadge lane={message.lane} /><ExecutionBadges message={message} /><span className="text-xs font-semibold text-slate-400">{(message.latencyMs / 1000).toFixed(1)}s</span>{message.removedSentences ? <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">{message.removedSentences} unsupported sentence{message.removedSentences === 1 ? "" : "s"} removed</Badge> : null}</div>
                  <p className="text-sm font-medium leading-7 text-slate-800">{message.content}</p>
                  {message.citations.length ? <details className="mt-4 rounded-xl border border-slate-200 bg-white p-3"><summary className="cursor-pointer text-xs font-black uppercase tracking-wide text-slate-500">Grounding records ({message.citations.length})</summary><ul className="mt-3 space-y-2 text-xs text-slate-600">{message.citations.map((citation) => <li key={citation.policyId}><strong>{citation.title}</strong> · reviewed {citation.lastReviewed} · {citation.sourceKind}</li>)}</ul></details> : null}
                </article>
              ))}
              {loading ? <div role="status" aria-live="polite" className="flex items-center gap-2 text-sm font-bold text-slate-500"><Loader2 className="size-4 animate-spin" />Planning and validating each claim…</div> : null}
            </div>
          )}
          {error ? <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p> : null}
        </section>

        <form onSubmit={submit} className="flex items-end gap-2 rounded-3xl border border-white/10 bg-white/[0.07] p-3">
          <Textarea aria-label="Ask Sales V4 test question" value={input} onChange={(event) => setInput(event.target.value)} rows={2} maxLength={6000} placeholder={ready ? "Ask an isolated V4 test question…" : readiness.status === "checking" ? "Checking isolated runtime readiness…" : readiness.status === "ready" ? "Enter the access token above first" : "The isolated runtime is not ready"} disabled={!ready || loading} className="min-h-14 flex-1 resize-none border-white/10 bg-slate-950/70 text-white placeholder:text-slate-500" />
          <Button type="submit" disabled={!ready || !input.trim() || loading} className="h-14 rounded-2xl bg-rose-600 px-5 hover:bg-rose-500"><Send className="mr-2 size-4" />Send</Button>
        </form>
      </div>
    </main>
  );
}

function LaneBadge({ lane }: { lane: string }) {
  const routed = ["partial", "route", "live_lookup", "artifact"].includes(lane);
  const answered = lane === "answer";
  const className = routed
    ? "border-amber-200 bg-amber-50 text-amber-700"
    : answered
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : "border-slate-200 bg-white text-slate-600";
  return <Badge className={className}>{routed ? <Route className="mr-1 size-3.5" /> : answered ? <CheckCircle2 className="mr-1 size-3.5" /> : null}{lane.replaceAll("_", " ")}</Badge>;
}

function ExecutionBadges({ message }: { message: LabAssistantMessage }) {
  const providerLabel = message.provider === "deepseek" ? "DeepSeek" : message.provider === "anthropic" ? "Anthropic" : "No model call";
  const modelLabel = message.model ? `${providerLabel} · ${message.model}` : providerLabel;
  return (
    <>
      <Badge variant="outline" className={message.provider ? "border-sky-200 bg-sky-50 text-sky-700" : "border-slate-200 bg-white text-slate-600"}>{modelLabel}</Badge>
      <ModeBadge label="Plan" value={formatExecutionMode(message.executionMode.planning)} model={["model", "systemic_model"].includes(message.executionMode.planning)} />
      <ModeBadge label="Compose" value={formatExecutionMode(message.executionMode.composition)} model={message.executionMode.composition === "model"} />
      <ModeBadge label="Validate" value={formatExecutionMode(message.executionMode.validation)} model={message.executionMode.validation === "model_and_deterministic"} />
    </>
  );
}

function ModeBadge({ label, value, model }: { label: string; value: string; model: boolean }) {
  return <Badge variant="outline" className={model ? "border-sky-200 bg-sky-50 text-sky-700" : "border-slate-200 bg-white text-slate-600"}>{label}: {value}</Badge>;
}

function formatExecutionMode(mode: string) {
  const labels: Record<string, string> = {
    model: "model",
    systemic_model: "systemic model",
    systemic_fallback: "frozen V4 fallback",
    deterministic_fallback: "safe fallback",
    conversation: "conversation",
    exact_evidence: "exact evidence",
    not_required: "not required",
    model_and_deterministic: "model + deterministic",
    deterministic_exact_evidence: "exact evidence",
    unknown: "unknown",
  };
  return labels[mode] || mode.replaceAll("_", " ");
}

function ReadinessBadge({ state }: { state: ReadinessState }) {
  if (state.status === "checking") {
    return <Badge className="border-white/15 bg-white/5 text-slate-300"><Loader2 className="mr-1 size-3.5 animate-spin" />Checking runtime</Badge>;
  }
  if (state.status === "unavailable") {
    return <Badge title={state.message} className="border-red-400/20 bg-red-400/10 text-red-200">Runtime unavailable</Badge>;
  }
  if (state.status === "not_ready") {
    const reason = !state.data.accessTokenConfigured
      ? "token not configured"
      : !state.data.historySigningConfigured
        ? "history signing not configured"
        : !state.data.modelConfigured
          ? "model not configured"
          : !state.data.modelAccessConfirmed
            ? "model access not confirmed"
            : "configuration incomplete";
    return <Badge className="border-amber-400/20 bg-amber-400/10 text-amber-200">Not ready · {reason}</Badge>;
  }
  const provider = state.data.provider === "deepseek" ? "DeepSeek" : state.data.provider === "anthropic" ? "Anthropic" : "No model";
  const transport = state.data.transport === "vercel_ai_gateway" ? "Vercel Gateway" : state.data.transport === "direct" ? "direct API" : "unknown transport";
  return <Badge className="border-emerald-400/20 bg-emerald-400/10 text-emerald-200">Ready · {provider} · {state.data.model || "unknown model"} · {transport} · {state.data.maxRequestSeconds || state.data.maxModelCallSeconds || 35}s request cap</Badge>;
}

async function readJsonResponse<T>(response: Response, context: string): Promise<T> {
  const contentType = (response.headers.get("content-type") || "").toLowerCase();
  if (!contentType.includes("json")) {
    const detail = (await response.text())
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 180);
    throw new Error(`${context} returned HTTP ${response.status} with ${contentType || "no content type"}${detail ? `: ${detail}` : "."}`);
  }
  try {
    return await response.json() as T;
  } catch {
    throw new Error(`${context} returned malformed JSON (HTTP ${response.status}).`);
  }
}
