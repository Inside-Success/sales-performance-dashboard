"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Bot, Loader2, MessageCircleQuestion, SendHorizontal, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type ReportChatPanelProps = {
  reportType?: "official" | "manual";
  reportId: string | number;
  repName: string;
  clientName: string | null;
};

const STARTER_QUESTIONS = [
  "What should I fix first?",
  "Give me a better talk track.",
  "Did I miss a close?",
];

export function ReportChatPanel({
  reportType = "official",
  reportId,
  repName,
  clientName,
}: ReportChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesRef.current?.scrollTo({
      top: messagesRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, isSending]);

  async function sendMessage(rawMessage: string) {
    const text = rawMessage.trim();
    if (!text || isSending) return;

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setInput("");
    setError(null);
    setIsSending(true);

    try {
      const response = await fetch("/api/report-chat", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          reportType,
          reportId,
          messages: nextMessages,
        }),
      });
      const data = (await response.json()) as { answer?: string; error?: string };

      if (!response.ok || !data.answer) {
        throw new Error(data.error || "Magic Mike could not answer right now.");
      }

      setMessages([...nextMessages, { role: "assistant", content: data.answer }]);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Magic Mike could not answer right now.");
      setMessages(nextMessages);
    } finally {
      setIsSending(false);
    }
  }

  function submitMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage(input);
  }

  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button
            variant="outline"
            className="h-10 gap-1 rounded-full border-red-200 bg-[#FEF2F2] px-4 text-[#B91C1C] shadow-sm hover:border-red-300 hover:bg-[#FEE2E2] hover:text-[#991B1B]"
          >
            <Sparkles className="size-4" />
            Ask Magic Mike
          </Button>
        }
      />
      <SheetContent
        side="right"
        className="w-full gap-0 overflow-hidden border-l border-red-100 bg-[#FBFAFB] p-0 font-[var(--font-plus-jakarta)] sm:max-w-[540px]"
        aria-describedby="report-chat-description"
      >
        <SheetHeader className="relative overflow-hidden border-b border-red-100 bg-white p-5 pr-12 sm:p-6 sm:pr-14">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#DC2626] via-[#EF4444] to-[#FCA5A5]" />
          <div className="flex items-start gap-3">
            <span className="grid size-12 shrink-0 place-items-center rounded-[18px] bg-[#DC2626] text-white shadow-[0_14px_28px_rgba(220,38,38,0.24)]">
              <Bot className="size-6" />
            </span>
            <div className="min-w-0 space-y-1">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-red-100 bg-[#FEF2F2] px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[#B91C1C]">
                <Sparkles className="size-3.5" />
                Report Q&A
              </span>
              <SheetTitle className="text-[24px] font-extrabold tracking-normal text-slate-950">
                Ask Magic Mike
              </SheetTitle>
              <SheetDescription id="report-chat-description" className="text-sm leading-6 text-slate-500">
                {clientName || "This report"} with {repName}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div
          ref={messagesRef}
          className="flex-1 space-y-4 overflow-y-auto bg-[linear-gradient(180deg,#FEF2F2_0%,#FBFAFB_28%,#F8FAFC_100%)] p-5"
        >
          {messages.length === 0 ? (
            <div className="space-y-4 pt-1">
              <div className="rounded-[22px] border border-red-100 bg-white p-4 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
                <div className="flex gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-2xl bg-[#FEF2F2] text-[#DC2626]">
                    <MessageCircleQuestion className="size-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-950">Focused on this report</p>
                    <p className="mt-1 text-sm leading-6 text-slate-500">
                      Magic Mike uses the opened coaching report and transcript only.
                    </p>
                  </div>
                </div>
              </div>
              <div className="grid gap-2">
                {STARTER_QUESTIONS.map((question) => (
                  <button
                    key={question}
                    type="button"
                    onClick={() => void sendMessage(question)}
                    disabled={isSending}
                    className="group flex min-h-12 items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-700 shadow-[0_8px_24px_rgba(15,23,42,0.04)] transition-all hover:-translate-y-px hover:border-red-200 hover:bg-[#FEF2F2] hover:text-[#B91C1C] disabled:pointer-events-none disabled:opacity-50"
                  >
                    <span>{question}</span>
                    <Sparkles className="size-4 text-slate-300 transition-colors group-hover:text-[#DC2626]" />
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {messages.map((message, index) => (
            <ChatBubble key={`${message.role}-${index}`} message={message} />
          ))}

          {isSending ? (
            <div className="flex max-w-[92%] items-center gap-2 rounded-2xl border border-red-100 bg-white px-4 py-3 text-sm font-medium text-slate-500 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
              <Loader2 className="size-4 animate-spin text-[#DC2626]" />
              Thinking
            </div>
          ) : null}

          {error ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}
        </div>

        <form onSubmit={submitMessage} className="border-t border-red-100 bg-white p-4">
          <div className="flex items-end gap-2 rounded-[22px] border border-slate-200 bg-slate-50/70 p-2 focus-within:border-red-200 focus-within:bg-white focus-within:shadow-[0_0_0_4px_#FEF2F2]">
            <Textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask about this report..."
              className="min-h-16 max-h-36 resize-none border-0 bg-transparent px-2 py-2 text-sm leading-6 shadow-none focus-visible:ring-0"
              disabled={isSending}
            />
            <Button
              type="submit"
              size="icon-lg"
              disabled={isSending || !input.trim()}
              className="size-11 rounded-2xl bg-[#DC2626] text-white shadow-[0_10px_22px_rgba(220,38,38,0.22)] hover:bg-[#B91C1C]"
            >
              {isSending ? <Loader2 className="size-4 animate-spin" /> : <SendHorizontal className="size-4" />}
              <span className="sr-only">Send</span>
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function ChatBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div className={cn("max-w-[92%] space-y-1.5", isUser ? "items-end" : "items-start")}>
        <div
          className={cn(
            "text-[0.68rem] font-bold uppercase tracking-[0.08em] text-slate-400",
            isUser && "text-right",
          )}
        >
          {isUser ? "You" : "Magic Mike"}
        </div>
        <div
          className={cn(
            "rounded-[20px] px-4 py-3 text-sm leading-6 shadow-[0_10px_24px_rgba(15,23,42,0.05)]",
            isUser
              ? "rounded-br-md bg-[#DC2626] text-white"
              : "rounded-bl-md border border-slate-200 bg-white text-slate-700",
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <AssistantMessageContent content={message.content} />
          )}
        </div>
      </div>
    </div>
  );
}

export function AssistantMessageContent({ content }: { content: string }) {
  const blocks = parseAssistantBlocks(content);

  return (
    <div className="space-y-3">
      {blocks.map((block, index) => {
        if (block.type === "ol") {
          return (
            <ol key={`ol-${index}`} className="list-decimal space-y-2 pl-5" start={block.start}>
              {block.items.map((item, itemIndex) => (
                <li key={`${item}-${itemIndex}`} className="pl-1">
                  <InlineMarkdown text={item} />
                </li>
              ))}
            </ol>
          );
        }

        if (block.type === "ul") {
          return (
            <ul key={`ul-${index}`} className="list-disc space-y-2 pl-5">
              {block.items.map((item, itemIndex) => (
                <li key={`${item}-${itemIndex}`} className="pl-1">
                  <InlineMarkdown text={item} />
                </li>
              ))}
            </ul>
          );
        }

        if (block.type === "p") {
          return (
            <p key={`p-${index}`} className="whitespace-pre-wrap">
              <InlineMarkdown text={block.text} />
            </p>
          );
        }

        return null;
      })}
    </div>
  );
}

type AssistantBlock =
  | { type: "p"; text: string }
  | { type: "ol"; items: string[]; start: number }
  | { type: "ul"; items: string[] };

function parseAssistantBlocks(content: string): AssistantBlock[] {
  const normalized = content
    .trim()
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+(\d{1,2})\.\s+(?=\S)/g, "\n$1. ")
    .replace(/[ \t]+[-*]\s+(?=\S)/g, "\n- ");

  const blocks: AssistantBlock[] = [];
  const lines = normalized
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  let index = 0;
  while (index < lines.length) {
    const orderedItems: string[] = [];
    const firstOrderedMatch = lines[index]?.match(/^(\d{1,2})\.\s+/);
    const orderedStart = Number(firstOrderedMatch?.[1] || 1);

    while (/^\d{1,2}\.\s+/.test(lines[index] || "")) {
      orderedItems.push(lines[index].replace(/^\d{1,2}\.\s+/, "").trim());
      index += 1;
    }
    if (orderedItems.length) {
      blocks.push({ type: "ol", items: orderedItems, start: orderedStart });
      continue;
    }

    const unorderedItems: string[] = [];
    while (/^[-*]\s+/.test(lines[index] || "")) {
      unorderedItems.push(lines[index].replace(/^[-*]\s+/, "").trim());
      index += 1;
    }
    if (unorderedItems.length) {
      blocks.push({ type: "ul", items: unorderedItems });
      continue;
    }

    blocks.push({ type: "p", text: lines[index] });
    index += 1;
  }

  return blocks.length ? blocks : [{ type: "p", text: content }];
}

function InlineMarkdown({ text }: { text: string }) {
  return <>{renderInlineMarkdown(text)}</>;
}

function renderInlineMarkdown(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const pattern = /(\*\*[\s\S]+?\*\*|\*[^*\n]+\*)/g;
  let lastIndex = 0;

  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > lastIndex) parts.push(text.slice(lastIndex, index));

    const token = match[0];
    const isBold = token.startsWith("**");
    const innerText = token.slice(isBold ? 2 : 1, isBold ? -2 : -1);
    parts.push(
      isBold ? (
        <strong key={`${token}-${index}`} className="font-semibold">
          {renderInlineMarkdown(innerText)}
        </strong>
      ) : (
        <em key={`${token}-${index}`}>{innerText}</em>
      ),
    );
    lastIndex = index + token.length;
  }

  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}
