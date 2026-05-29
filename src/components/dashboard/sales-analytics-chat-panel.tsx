"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { BotMessageSquare, Loader2, SendHorizontal, Sparkles } from "lucide-react";
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
import { AssistantMessageContent } from "@/components/dashboard/report-chat-panel";
import { cn } from "@/lib/utils";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const STARTER_QUESTIONS = [
  "Summarize this page.",
  "Are high-usage reps selling more?",
  "Who needs manager follow-up?",
  "Is this enough data to trust?",
];

export function SalesAnalyticsChatPanel({ periodDays }: { periodDays: number }) {
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
      const response = await fetch("/api/sales-analytics-chat", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          periodDays,
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
            size="icon-lg"
            className="fixed bottom-5 right-5 z-40 size-14 rounded-full border border-primary/20 shadow-xl shadow-primary/20 transition-transform hover:scale-105 sm:bottom-6 sm:right-6"
            aria-label="Ask Magic Mike about sales impact"
          >
            <Sparkles className="size-6" />
          </Button>
        }
      />
      <SheetContent
        side="right"
        className="w-full gap-0 overflow-hidden p-0 sm:max-w-[520px]"
        aria-describedby="sales-analytics-chat-description"
      >
        <SheetHeader className="border-b bg-background/95 p-5 pr-12">
          <div className="mb-2 flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <BotMessageSquare className="size-5" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">AI analyst</Badge>
                <Badge variant="outline">{periodDays}d view</Badge>
              </div>
              <SheetTitle className="mt-2 text-xl">Ask Magic Mike</SheetTitle>
            </div>
          </div>
          <SheetDescription id="sales-analytics-chat-description">
            Manager Q&amp;A for Magic Mike usage, new paid sales, and adoption signals.
          </SheetDescription>
        </SheetHeader>

        <div ref={messagesRef} className="flex-1 space-y-4 overflow-y-auto bg-muted/20 p-5">
          {messages.length === 0 ? (
            <div className="space-y-4">
              <div className="rounded-2xl border bg-card p-4 text-sm leading-6 text-muted-foreground shadow-xs">
                Ask about the sales-impact stats on this page. Magic Mike will stay focused on the current analytics snapshot and avoid overclaiming causation.
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {STARTER_QUESTIONS.map((question) => (
                  <Button
                    key={question}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-auto justify-start whitespace-normal px-3 py-2 text-left"
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
              Reading the latest stats...
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
              placeholder="Ask about sales impact..."
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
