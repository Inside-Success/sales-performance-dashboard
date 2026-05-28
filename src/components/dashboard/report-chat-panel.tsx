"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
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
        className="w-full gap-0 p-0 sm:max-w-[460px]"
        aria-describedby="report-chat-description"
      >
        <SheetHeader className="border-b p-5 pr-12">
          <div className="mb-2 flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground">
              <MessageCircleQuestion className="size-5" />
            </span>
            <Badge variant="secondary">Beta</Badge>
          </div>
          <SheetTitle>Ask Magic Mike</SheetTitle>
          <SheetDescription id="report-chat-description">
            Coaching Q&A for {clientName || "this report"} with {repName}.
          </SheetDescription>
        </SheetHeader>

        <div ref={messagesRef} className="flex-1 space-y-3 overflow-y-auto p-5">
          {messages.length === 0 ? (
            <div className="space-y-4">
              <div className="rounded-xl border bg-muted/40 p-4 text-sm leading-6 text-muted-foreground">
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
            <div
              key={`${message.role}-${index}`}
              className={cn(
                "max-w-[90%] rounded-xl px-3 py-2 text-sm leading-6",
                message.role === "user"
                  ? "ml-auto bg-primary text-primary-foreground"
                  : "bg-muted text-foreground",
              )}
            >
              {message.content}
            </div>
          ))}

          {isSending ? (
            <div className="flex max-w-[90%] items-center gap-2 rounded-xl bg-muted px-3 py-2 text-sm text-muted-foreground">
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

        <form onSubmit={submitMessage} className="border-t p-4">
          <div className="flex items-end gap-2">
            <Textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask about this report..."
              className="max-h-40 min-h-20 resize-none text-sm"
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
