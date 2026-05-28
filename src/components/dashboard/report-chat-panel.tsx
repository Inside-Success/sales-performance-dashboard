"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Loader2, MessageCircleQuestion, SendHorizontal, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
          <Button variant="default" className="gap-1.5">
            <Sparkles className="size-4" />
            Ask Magic Mike
          </Button>
        }
      />
      <SheetContent
        side="right"
        className="w-full gap-0 overflow-hidden p-0 sm:max-w-[500px]"
        aria-describedby="report-chat-description"
      >
        <SheetHeader className="border-b bg-background/95 p-5 pr-12">
          <div className="mb-2 flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <MessageCircleQuestion className="size-5" />
            </span>
            <div className="min-w-0">
              <Badge variant="secondary">Beta</Badge>
              <SheetTitle className="mt-2 text-xl">Ask Magic Mike</SheetTitle>
            </div>
          </div>
          <SheetDescription id="report-chat-description">
            Coaching Q&A for {clientName || "this report"} with {repName}.
          </SheetDescription>
        </SheetHeader>

        <div ref={messagesRef} className="flex-1 space-y-4 overflow-y-auto bg-muted/20 p-5">
          {messages.length === 0 ? (
            <div className="space-y-4">
              <div className="rounded-2xl border bg-card p-4 text-sm leading-6 text-muted-foreground shadow-xs">
                Ask a question about the coaching feedback or transcript. Answers stay focused on this report.
              </div>
              <div className="flex flex-wrap gap-2">
                {STARTER_QUESTIONS.map((question) => (
                  <Button
                    key={question}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void sendMessage(question)}
                    disabled={isSending}
                  >
                    {question}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}

          {messages.map((message, index) => (
            <ChatBubble key={`${message.role}-${index}`} message={message} />
          ))}

          {isSending ? (
            <div className="flex max-w-[92%] items-center gap-2 rounded-2xl border bg-card px-4 py-3 text-sm text-muted-foreground shadow-xs">
              <Loader2 className="size-4 animate-spin" />
              Thinking...
            </div>
          ) : null}

          {error ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}
        </div>

        <form onSubmit={submitMessage} className="border-t bg-background p-4">
          <div className="flex items-end gap-2">
            <Textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask about this report..."
              className="max-h-40 min-h-20 resize-none rounded-xl bg-card text-sm shadow-xs"
              disabled={isSending}
            />
            <Button type="submit" size="icon-lg" disabled={isSending || !input.trim()}>
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
      <div className={cn("max-w-[92%] space-y-1", isUser ? "items-end" : "items-start")}>
        <div
          className={cn(
            "text-[0.7rem] font-medium uppercase tracking-normal text-muted-foreground",
            isUser && "text-right",
          )}
        >
          {isUser ? "You" : "Magic Mike"}
        </div>
        <div
          className={cn(
            "rounded-2xl px-4 py-3 text-sm leading-6 shadow-xs",
            isUser
              ? "rounded-br-md bg-primary text-primary-foreground"
              : "rounded-bl-md border bg-card text-foreground",
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

function AssistantMessageContent({ content }: { content: string }) {
  const blocks = parseAssistantBlocks(content);

  return (
    <div className="space-y-3">
      {blocks.map((block, index) => {
        if (block.type === "ol") {
          return (
            <ol key={`ol-${index}`} className="list-decimal space-y-2 pl-5">
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
  | { type: "ol" | "ul"; items: string[] };

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
    while (/^\d{1,2}\.\s+/.test(lines[index] || "")) {
      orderedItems.push(lines[index].replace(/^\d{1,2}\.\s+/, "").trim());
      index += 1;
    }
    if (orderedItems.length) {
      blocks.push({ type: "ol", items: orderedItems });
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
  const pattern = /(\*\*[^*]+\*\*|\*[^*\n]+\*)/g;
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
          {innerText}
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
