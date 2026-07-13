"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BookText,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Copyright,
  CreditCard,
  Info,
  LibraryBig,
  LifeBuoy,
  Loader2,
  Menu,
  MessageCircleQuestion,
  MessageSquare,
  MessageSquarePlus,
  MoreHorizontal,
  Package,
  PanelLeft,
  PanelLeftClose,
  Pencil,
  Search,
  Send,
  ShieldCheck,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { APPROVED_FAQ_ARTICLES, type ApprovedFaqArticle } from "@/lib/ask-sales-faq/generated/approved-faq-bundle";
import { parseAnswerDisplayList, parseAnswerDisplaySegments } from "@/lib/ask-sales-faq/presentation";
import type {
  AskSalesFaqConversationSummary,
  AskSalesFaqResponse,
  AskSalesFaqStructuredAnswer,
} from "@/lib/ask-sales-faq/types";
import { cn } from "@/lib/utils";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  structuredAnswer?: AskSalesFaqStructuredAnswer | null;
  outcome?: string | null;
  sourceLabel?: string | null;
  sourceLastReviewed?: string | null;
  sourceDetails?: string | null;
  needsRoute?: boolean;
  routeReason?: string | null;
  provider?: string | null;
  model?: string | null;
};

type QueuedQuestion = {
  id: string;
  content: string;
};

type FeedbackState = {
  rating: "up" | "down";
  comment: string;
  status: "commenting" | "saving" | "saved" | "error";
  sheetSync?: "sent" | "skipped" | "failed";
};

type SheetSyncResponse = {
  status?: "sent" | "skipped" | "failed";
};

type FeedbackResponse = {
  ok?: boolean;
  error?: string;
  sheetSync?: SheetSyncResponse;
};

type ConversationActionResponse = {
  ok?: boolean;
  error?: string;
  title?: string;
};

const starterPrompts = [
  "What are the current ISTV prices and payment plans?",
  "Can I say Apple TV or Tier-1 placement is guaranteed?",
  "Where do I check the current active show list?",
];

const MAX_CONTEXT_MESSAGES_TO_SEND = 10;
const MAX_CONTEXT_MESSAGE_CHARS = 1800;

const topicPromptByArticleId: Record<string, string> = {
  "call-recording-storage-and-access": "Where are call recordings stored and how should reps access them?",
  "current-show-source": "Where should I check the current active show list?",
  "internal-material-sharing-boundaries": "What internal materials should reps not share externally?",
  "istv-nlceo-pricing-and-same-day-discount": "What are the current ISTV and Next Level CEO prices and same-day discount rules?",
  "payment-plan-and-link-boundaries": "What should reps do for payment links, payment methods, and custom payment plans?",
  "platform-hosting-and-client-license-duration": "How long can clients use their content and where is it hosted?",
  "platform-proof-and-claims-boundaries": "What can reps say about platform proof, public proof, and placement claims?",
  "refund-rules-by-product": "What are the refund rules by product?",
};

const categoryIcons: Record<string, LucideIcon> = {
  "Offers, Pricing & Packages": Package,
  "Payments, Refunds & Contracts": CreditCard,
  "Compliance, Proof & Claims": ShieldCheck,
  "Content Rights & Usage": Copyright,
  "Sales Tech & Support Routing": LifeBuoy,
};

function buildTopicGroups() {
  const groups = new Map<string, ApprovedFaqArticle[]>();
  for (const article of APPROVED_FAQ_ARTICLES) {
    const current = groups.get(article.category) || [];
    current.push(article);
    groups.set(article.category, current);
  }
  return Array.from(groups.entries()).map(([category, articles]) => ({
    category,
    articles: articles.sort((a, b) => a.title.localeCompare(b.title)),
  }));
}

function formatTimestamp(value: string | number | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function titleForConversation(conversation: AskSalesFaqConversationSummary) {
  return conversation.title || "Ask Sales FAQ chat";
}

function isRouteOrBlocked(message: ChatMessage) {
  return (
    message.needsRoute ||
    message.outcome === "abstain_unapproved" ||
    message.outcome === "admin_only" ||
    message.outcome === "safe_fallback"
  );
}

function buildRequestMessages(messages: ChatMessage[]) {
  return messages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .slice(-MAX_CONTEXT_MESSAGES_TO_SEND)
    .map((message) => ({
      role: message.role,
      content: message.content.trim().slice(0, MAX_CONTEXT_MESSAGE_CHARS),
    }))
    .filter((message) => message.content.length > 0);
}

export function AskSalesFaqChat() {
  const [conversations, setConversations] = useState<AskSalesFaqConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [queuedQuestions, setQueuedQuestions] = useState<QueuedQuestion[]>([]);
  const [queuePaused, setQueuePaused] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [browseOpen, setBrowseOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [conversationNextCursor, setConversationNextCursor] = useState<string | null>(null);
  const [conversationHistoryLoading, setConversationHistoryLoading] = useState(false);
  const [conversationHistoryError, setConversationHistoryError] = useState<string | null>(null);
  const [feedbackByMessageId, setFeedbackByMessageId] = useState<Record<string, FeedbackState>>({});
  const [error, setError] = useState<string | null>(null);
  const [conversationMenuId, setConversationMenuId] = useState<string | null>(null);
  const [renamingConversation, setRenamingConversation] = useState<AskSalesFaqConversationSummary | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [deletingConversation, setDeletingConversation] = useState<AskSalesFaqConversationSummary | null>(null);
  const [conversationActionError, setConversationActionError] = useState<string | null>(null);
  const [conversationActionSaving, setConversationActionSaving] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  const activeConversationIdRef = useRef<string | null>(null);
  const isLoadingRef = useRef(false);
  const queuedQuestionsRef = useRef<QueuedQuestion[]>([]);
  const queuePausedRef = useRef(false);
  const conversationLoadSequenceRef = useRef(0);

  const topicGroups = useMemo(() => buildTopicGroups(), []);
  const isComposerEmpty = !input.trim();

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === activeConversationId) || null,
    [activeConversationId, conversations],
  );

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ block: "end" });
  }, [messages, isLoading, error, queuedQuestions.length, queuePaused]);

  useEffect(() => {
    if (!conversationMenuId) return;

    function closeConversationMenu(event: PointerEvent) {
      if (event.target instanceof Element && event.target.closest("[data-conversation-menu-root]")) return;
      setConversationMenuId(null);
    }

    function closeConversationMenuWithKeyboard(event: KeyboardEvent) {
      if (event.key === "Escape") setConversationMenuId(null);
    }

    document.addEventListener("pointerdown", closeConversationMenu);
    document.addEventListener("keydown", closeConversationMenuWithKeyboard);

    return () => {
      document.removeEventListener("pointerdown", closeConversationMenu);
      document.removeEventListener("keydown", closeConversationMenuWithKeyboard);
    };
  }, [conversationMenuId]);

  function syncMessages(nextMessages: ChatMessage[]) {
    messagesRef.current = nextMessages;
    setMessages(nextMessages);
  }

  function syncActiveConversationId(nextConversationId: string | null) {
    activeConversationIdRef.current = nextConversationId;
    setActiveConversationId(nextConversationId);
  }

  function syncIsLoading(nextIsLoading: boolean) {
    isLoadingRef.current = nextIsLoading;
    setIsLoading(nextIsLoading);
  }

  function syncQueuedQuestions(nextQueuedQuestions: QueuedQuestion[]) {
    queuedQuestionsRef.current = nextQueuedQuestions;
    setQueuedQuestions(nextQueuedQuestions);
  }

  function syncQueuePaused(nextQueuePaused: boolean) {
    queuePausedRef.current = nextQueuePaused;
    setQueuePaused(nextQueuePaused);
  }

  function focusComposer() {
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }

  function clearComposerIfCurrentQuestion(question: string) {
    const normalizedQuestion = question.trim();
    setInput((currentInput) => (currentInput.trim() === normalizedQuestion ? "" : currentInput));
  }

  function hasPendingQuestionWork() {
    return isLoadingRef.current || queuedQuestionsRef.current.length > 0;
  }

  function blockConversationChangeWhileBusy() {
    if (!hasPendingQuestionWork()) return false;
    setError("Finish the current answer or clear queued follow-ups before switching chats.");
    focusComposer();
    return true;
  }

  const loadConversations = useCallback(async function loadConversations(
    options: { query?: string; cursor?: string | null; append?: boolean } = {},
  ) {
    const sequence = conversationLoadSequenceRef.current + 1;
    conversationLoadSequenceRef.current = sequence;
    const query = (options.query ?? searchQuery).replace(/\s+/g, " ").trim();
    const parameters = new URLSearchParams();
    if (query) parameters.set("q", query);
    if (options.cursor) parameters.set("cursor", options.cursor);
    setConversationHistoryLoading(true);
    setConversationHistoryError(null);
    try {
      const response = await fetch(
        `/api/ask-sales-faq/conversations${parameters.size ? `?${parameters.toString()}` : ""}`,
        { cache: "no-store" },
      );
      const data = (await response.json()) as {
        ok?: boolean;
        conversations?: AskSalesFaqConversationSummary[];
        nextCursor?: string | null;
        error?: string;
      };
      if (!response.ok || !data.ok) throw new Error(data.error || "Chat history could not be loaded.");
      if (sequence !== conversationLoadSequenceRef.current) return;
      const nextConversations = data.conversations || [];
      setConversations((current) =>
        options.append
          ? Array.from(
              new Map([...current, ...nextConversations].map((conversation) => [conversation.id, conversation])).values(),
            )
          : nextConversations,
      );
      setConversationNextCursor(data.nextCursor || null);
    } catch {
      if (sequence !== conversationLoadSequenceRef.current) return;
      if (!options.append) setConversations([]);
      setConversationHistoryError("Chat history could not be loaded. Try again.");
    } finally {
      if (sequence === conversationLoadSequenceRef.current) setConversationHistoryLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    const timer = window.setTimeout(
      () => void loadConversations({ query: searchQuery, append: false }),
      searchQuery.trim() ? 250 : 0,
    );
    return () => window.clearTimeout(timer);
  }, [loadConversations, searchQuery]);

  function startNewConversation() {
    if (blockConversationChangeWhileBusy()) return;
    syncActiveConversationId(null);
    syncMessages([]);
    setFeedbackByMessageId({});
    setError(null);
    setInput("");
    syncQueuedQuestions([]);
    syncQueuePaused(false);
    setDrawerOpen(false);
  }

  function openConversation(conversation: AskSalesFaqConversationSummary) {
    if (conversation.id !== activeConversationIdRef.current && blockConversationChangeWhileBusy()) return;
    syncActiveConversationId(conversation.id);
    syncMessages(
      conversation.messages
        .filter((message) => message.role === "user" || message.role === "assistant")
        .map((message) => ({
          id: message.id,
          role: message.role as "user" | "assistant",
          content: message.content,
          structuredAnswer: message.structuredAnswer,
          outcome: message.outcome,
          sourceLabel: message.sourceLabel,
          sourceLastReviewed: message.sourceLastReviewed,
          needsRoute: message.needsRoute,
          routeReason: message.routeReason,
          provider: message.provider,
          model: message.model,
        })),
    );
    setFeedbackByMessageId(
      Object.fromEntries(
        conversation.messages.flatMap((message) =>
          message.feedback
            ? [[message.id, { rating: message.feedback.rating, comment: message.feedback.comment || "", status: "saved" as const }]]
            : [],
        ),
      ),
    );
    setError(null);
    syncQueuedQuestions([]);
    syncQueuePaused(false);
    setDrawerOpen(false);
  }

  function beginRenameConversation(conversation: AskSalesFaqConversationSummary) {
    setConversationMenuId(null);
    setConversationActionError(null);
    setRenamingConversation(conversation);
    setRenameDraft(titleForConversation(conversation));
  }

  async function saveConversationRename() {
    if (!renamingConversation || conversationActionSaving) return;
    const title = renameDraft.replace(/\s+/g, " ").trim();
    if (!title) {
      setConversationActionError("Enter a chat name.");
      return;
    }

    setConversationActionSaving(true);
    setConversationActionError(null);

    try {
      const response = await fetch(`/api/ask-sales-faq/conversations/${encodeURIComponent(renamingConversation.id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title }),
      });
      const data = (await response.json()) as ConversationActionResponse;
      if (!response.ok || !data.ok) throw new Error(data.error || "Chat could not be renamed.");

      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === renamingConversation.id
            ? { ...conversation, title: data.title || title, updatedAt: new Date().toISOString() }
            : conversation,
        ),
      );
      setRenamingConversation(null);
      setRenameDraft("");
    } catch (renameError) {
      setConversationActionError(renameError instanceof Error ? renameError.message : "Chat could not be renamed.");
    } finally {
      setConversationActionSaving(false);
    }
  }

  function beginDeleteConversation(conversation: AskSalesFaqConversationSummary) {
    setConversationMenuId(null);
    setConversationActionError(null);
    setDeletingConversation(conversation);
  }

  async function confirmDeleteConversation() {
    if (!deletingConversation || conversationActionSaving) return;
    const conversationId = deletingConversation.id;

    setConversationActionSaving(true);
    setConversationActionError(null);

    try {
      const response = await fetch(`/api/ask-sales-faq/conversations/${encodeURIComponent(conversationId)}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as ConversationActionResponse;
      if (!response.ok || !data.ok) throw new Error(data.error || "Chat could not be deleted.");

      setConversations((current) => current.filter((conversation) => conversation.id !== conversationId));
      if (activeConversationId === conversationId) {
        syncActiveConversationId(null);
        syncMessages([]);
        setFeedbackByMessageId({});
        setInput("");
        syncQueuedQuestions([]);
        syncQueuePaused(false);
      }
      setDeletingConversation(null);
    } catch (deleteError) {
      setConversationActionError(deleteError instanceof Error ? deleteError.message : "Chat could not be deleted.");
    } finally {
      setConversationActionSaving(false);
    }
  }

  async function submitQuestion(event?: FormEvent<HTMLFormElement>, override?: string) {
    event?.preventDefault();
    const question = (override || input).trim();
    if (!question) return;

    if (isLoadingRef.current) {
      queueQuestion(question);
      return;
    }

    await sendQuestion(question);
  }

  function queueQuestion(question: string) {
    const nextQueuedQuestions = [
      ...queuedQuestionsRef.current,
      {
        id: `queued-${Date.now()}-${queuedQuestionsRef.current.length}`,
        content: question,
      },
    ];

    syncQueuedQuestions(nextQueuedQuestions);
    clearComposerIfCurrentQuestion(question);
    setError(null);
    focusComposer();
  }

  function removeQueuedQuestion(questionId: string) {
    const nextQueuedQuestions = queuedQuestionsRef.current.filter((question) => question.id !== questionId);
    syncQueuedQuestions(nextQueuedQuestions);
    if (!nextQueuedQuestions.length) syncQueuePaused(false);
  }

  function clearQueuedQuestions() {
    syncQueuedQuestions([]);
    syncQueuePaused(false);
    setError(null);
    focusComposer();
  }

  function resumeQueuedQuestions() {
    syncQueuePaused(false);
    setError(null);
    focusComposer();
    void runNextQueuedQuestion();
  }

  function runNextQueuedQuestion() {
    if (isLoadingRef.current || queuePausedRef.current) return;
    const [nextQuestion, ...remainingQuestions] = queuedQuestionsRef.current;
    if (!nextQuestion) return;

    syncQueuedQuestions(remainingQuestions);
    void sendQuestion(nextQuestion.content);
  }

  async function sendQuestion(question: string) {
    const userMessage: ChatMessage = {
      id: `local-user-${createClientRequestId()}`,
      role: "user",
      content: question,
    };

    const nextMessages = [...messagesRef.current, userMessage];
    syncMessages(nextMessages);
    clearComposerIfCurrentQuestion(question);
    syncIsLoading(true);
    syncQueuePaused(false);
    setError(null);
    focusComposer();

    let shouldContinueQueue = true;

    try {
      const response = await fetch("/api/ask-sales-faq", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          conversationId: activeConversationIdRef.current,
          clientRequestId: createClientRequestId(),
          messages: buildRequestMessages(nextMessages),
        }),
      });
      const data = (await response.json()) as Partial<AskSalesFaqResponse> & { error?: string };

      if (!response.ok || !data.ok || !data.answer || !data.messageId || !data.conversationId) {
        throw new Error(data.error || "Ask Sales FAQ could not answer right now.");
      }

      syncActiveConversationId(data.conversationId);
      syncMessages([
        ...messagesRef.current,
        {
          id: data.messageId,
          role: "assistant",
          content: data.answer || "",
          structuredAnswer: data.structuredAnswer || null,
          outcome: data.outcome,
          sourceLabel: data.source?.label || null,
          sourceLastReviewed: data.source?.lastReviewed || null,
          sourceDetails: data.source?.expandableDetails || null,
          needsRoute: data.needsRoute,
          routeReason: data.routeReason,
          provider: data.provider,
          model: data.model,
        },
      ]);
      void loadConversations();
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Ask Sales FAQ is having trouble right now. Try again in a few moments, and route urgent live-call questions instead of guessing.";
      setError(message);
      syncMessages([
        ...messagesRef.current,
        {
          id: `local-safe-${createClientRequestId()}`,
          role: "assistant",
          content:
            "Ask Sales FAQ is having trouble right now. Try again in a few moments, and route urgent live-call questions instead of guessing.",
          structuredAnswer: {
            summary:
              "Ask Sales FAQ is having trouble right now. Try again in a few moments, and route urgent live-call questions instead of guessing.",
            sections: [
              { title: "What to do", items: ["Try again in a few moments.", "Route urgent live-call questions instead of guessing."], tone: "route" },
            ],
            confidenceLabel: "Low",
            confidenceScore: 0,
            sourceMode: "fallback",
          },
          outcome: "safe_fallback",
          needsRoute: true,
          routeReason: message,
        },
      ]);
      if (queuedQuestionsRef.current.length) syncQueuePaused(true);
      shouldContinueQueue = false;
    } finally {
      syncIsLoading(false);
      if (shouldContinueQueue) runNextQueuedQuestion();
    }
  }

  function createClientRequestId() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
    return `client-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  async function saveFeedback(message: ChatMessage, rating: "up" | "down", comment = "") {
    if (!activeConversationId || message.role !== "assistant") return;

    const nextFeedback: FeedbackState = {
      rating,
      comment,
      status: "saving",
    };
    setFeedbackByMessageId((current) => ({ ...current, [message.id]: nextFeedback }));

    try {
      const response = await fetch("/api/ask-sales-faq/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messageId: message.id,
          conversationId: activeConversationId,
          rating,
          comment,
        }),
      });
      const data = (await response.json()) as FeedbackResponse;
      if (!response.ok || !data.ok) throw new Error(data.error || "Feedback could not be saved.");

      setFeedbackByMessageId((current) => ({
        ...current,
        [message.id]: {
          rating,
          comment,
          status: "saved",
          sheetSync: data.sheetSync?.status,
        },
      }));
    } catch {
      setFeedbackByMessageId((current) => ({
        ...current,
        [message.id]: {
          rating,
          comment,
          status: "error",
        },
      }));
    }
  }

  function startNegativeFeedback(messageId: string) {
    setFeedbackByMessageId((current) => ({
      ...current,
      [messageId]: {
        rating: "down",
        comment: current[messageId]?.comment || "",
        status: "commenting",
      },
    }));
  }

  function updateFeedbackComment(messageId: string, comment: string) {
    setFeedbackByMessageId((current) => {
      const existing = current[messageId] || { rating: "down" as const, status: "commenting" as const, comment: "" };
      return {
        ...current,
        [messageId]: {
          ...existing,
          rating: "down",
          comment,
          status: existing.status === "saving" ? "saving" : "commenting",
        },
      };
    });
  }

  function askTopic(article: ApprovedFaqArticle) {
    setBrowseOpen(false);
    void submitQuestion(undefined, topicPromptByArticleId[article.id] || `What is the approved guidance for ${article.title}?`);
  }

  return (
    <section
      className="flex h-full min-h-0 w-full overflow-hidden bg-[linear-gradient(180deg,#FBFAFB_0%,#F5F4F6_100%)] text-slate-900"
      data-screen-label="Ask Sales FAQ"
    >
      <FaqSidebar
        conversations={conversations}
        activeConversationId={activeConversationId}
        searchQuery={searchQuery}
        drawerOpen={drawerOpen}
        collapsed={!sidebarOpen}
        onSearchQueryChange={setSearchQuery}
        onOpenConversation={openConversation}
        onNewConversation={startNewConversation}
        openMenuConversationId={conversationMenuId}
        onToggleConversationMenu={(conversationId) =>
          setConversationMenuId((current) => (current === conversationId ? null : conversationId))
        }
        onRenameConversation={beginRenameConversation}
        onDeleteConversation={beginDeleteConversation}
        hasMoreConversations={Boolean(conversationNextCursor)}
        conversationHistoryLoading={conversationHistoryLoading}
        conversationHistoryError={conversationHistoryError}
        onLoadMoreConversations={() =>
          void loadConversations({ cursor: conversationNextCursor, append: true })
        }
        onBrowse={() => {
          setBrowseOpen(true);
          setDrawerOpen(false);
        }}
        onCloseDrawer={() => setDrawerOpen(false)}
        onCollapse={() => setSidebarOpen(false)}
      />

      {drawerOpen ? (
        <button
          type="button"
          aria-label="Close conversation drawer"
          className="fixed inset-0 z-40 bg-slate-950/35 lg:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-slate-200/70 bg-white/86 px-3 backdrop-blur-md sm:px-5">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-slate-500 lg:hidden"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open conversation menu"
            >
              <Menu className="size-5" />
            </Button>
            {!sidebarOpen ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="hidden text-slate-500 lg:inline-flex"
                onClick={() => setSidebarOpen(true)}
                aria-label="Show conversation sidebar"
              >
                <PanelLeft className="size-5" />
              </Button>
            ) : null}
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-[#DC2626] text-white lg:hidden">
                <MessageCircleQuestion className="size-4.5" />
              </span>
              <div className="min-w-0 leading-tight">
                <h1 className="truncate text-sm font-extrabold tracking-normal text-slate-950">
                  {messages.length ? activeConversation?.title || "Ask Sales FAQ" : "Ask Sales FAQ"}
                </h1>
                <p className="hidden text-[11px] font-semibold text-slate-400 sm:block">
                  Approved sales answers
                </p>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Badge
              variant="outline"
              className="border-red-100 bg-[#FEF2F2] px-2 py-0.5 text-[11px] font-bold text-[#B91C1C]"
            >
              Hidden beta
            </Badge>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col gap-5">
            {!messages.length ? (
              <WelcomeState
                onStarter={(prompt) => void submitQuestion(undefined, prompt)}
                onBrowse={() => setBrowseOpen(true)}
              />
            ) : null}

            {messages.map((message) => (
              <MessageRow
                key={message.id}
                message={message}
                feedback={feedbackByMessageId[message.id]}
                onPositive={() => void saveFeedback(message, "up")}
                onNegative={() => startNegativeFeedback(message.id)}
                onFeedbackComment={(comment) => updateFeedbackComment(message.id, comment)}
                onSubmitNegative={(comment) => void saveFeedback(message, "down", comment)}
              />
            ))}

            {isLoading ? <LoadingAnswer /> : null}

            {error ? (
              <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-600 shadow-sm">
                <Info className="mt-0.5 size-4 shrink-0 text-slate-400" />
                {error}
              </div>
            ) : null}

            <div ref={scrollRef} />
          </div>
        </div>

        <form
          onSubmit={submitQuestion}
          className="shrink-0 border-t border-slate-200/75 bg-white/88 px-4 pb-4 pt-3 backdrop-blur sm:px-6"
        >
          <div className="mx-auto w-full max-w-3xl">
            {queuedQuestions.length ? (
              <QueuedFollowups
                questions={queuedQuestions}
                paused={queuePaused}
                onRemove={removeQueuedQuestion}
                onClear={clearQueuedQuestions}
                onResume={resumeQueuedQuestions}
              />
            ) : null}
            <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-white p-2 pl-4 shadow-[0_1px_2px_rgba(17,17,26,.04),0_8px_22px_-14px_rgba(17,17,26,.18)] focus-within:border-slate-300">
              <Textarea
                ref={inputRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void submitQuestion();
                  }
                }}
                rows={1}
                className="max-h-[132px] min-h-10 flex-1 resize-none border-0 bg-transparent px-0 py-2 text-[15px] font-medium leading-relaxed shadow-none placeholder:text-slate-400 focus-visible:ring-0"
                placeholder={isLoading ? "Type the next follow-up..." : "Ask anything about offers, payments, rights..."}
              />
              <Button
                type="submit"
                size="icon-lg"
                disabled={isComposerEmpty}
                aria-label={isLoading ? "Queue follow-up question" : "Send question"}
                className="size-10 rounded-xl bg-[#DC2626] text-white shadow-[0_8px_18px_-10px_rgba(220,38,38,.95)] hover:bg-[#B91C1C]"
              >
                {isLoading && isComposerEmpty ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : isLoading ? (
                  <MessageSquarePlus className="size-4" />
                ) : (
                  <Send className="size-4" />
                )}
              </Button>
            </div>
          </div>
        </form>
      </div>

      {browseOpen ? <BrowseTopics topicGroups={topicGroups} onClose={() => setBrowseOpen(false)} onPick={askTopic} /> : null}
      {renamingConversation ? (
        <RenameConversationDialog
          conversation={renamingConversation}
          title={renameDraft}
          error={conversationActionError}
          saving={conversationActionSaving}
          onTitleChange={setRenameDraft}
          onCancel={() => {
            setRenamingConversation(null);
            setRenameDraft("");
            setConversationActionError(null);
          }}
          onSave={() => void saveConversationRename()}
        />
      ) : null}
      {deletingConversation ? (
        <DeleteConversationDialog
          conversation={deletingConversation}
          error={conversationActionError}
          saving={conversationActionSaving}
          onCancel={() => {
            setDeletingConversation(null);
            setConversationActionError(null);
          }}
          onDelete={() => void confirmDeleteConversation()}
        />
      ) : null}
    </section>
  );
}

function QueuedFollowups({
  questions,
  paused,
  onRemove,
  onClear,
  onResume,
}: {
  questions: QueuedQuestion[];
  paused: boolean;
  onRemove: (questionId: string) => void;
  onClear: () => void;
  onResume: () => void;
}) {
  return (
    <div
      className={cn(
        "mb-2 rounded-2xl border px-3 py-2.5 shadow-[0_1px_2px_rgba(17,17,26,.04)]",
        paused ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={cn(
              "grid size-7 shrink-0 place-items-center rounded-lg",
              paused ? "bg-amber-100 text-amber-700" : "bg-[#FEF2F2] text-[#DC2626]",
            )}
          >
            <MessageSquarePlus className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[12.5px] font-extrabold tracking-normal text-slate-800">
              {questions.length === 1 ? "1 queued follow-up" : `${questions.length} queued follow-ups`}
            </p>
            {paused ? (
              <p className="truncate text-[11.5px] font-semibold text-amber-700">
                Paused after the last answer failed.
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {paused ? (
            <Button
              type="button"
              size="xs"
              variant="outline"
              className="h-7 rounded-lg border-amber-200 bg-white text-amber-800 hover:bg-amber-50"
              onClick={onResume}
            >
              <ChevronRight className="size-3.5" />
              Resume
            </Button>
          ) : null}
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            className="text-slate-400 hover:text-slate-700"
            onClick={onClear}
            aria-label="Clear queued follow-ups"
          >
            <X className="size-3.5" />
          </Button>
        </div>
      </div>
      <div className="mt-2 max-h-28 space-y-1 overflow-y-auto pr-1">
        {questions.map((question, index) => (
          <div key={question.id} className="flex min-w-0 items-center gap-2 rounded-xl bg-slate-50 px-2 py-1.5">
            <span className="grid size-5 shrink-0 place-items-center rounded-md bg-white text-[11px] font-extrabold text-slate-400">
              {index + 1}
            </span>
            <p className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-slate-600">{question.content}</p>
            <button
              type="button"
              className="grid size-6 shrink-0 place-items-center rounded-md text-slate-400 transition hover:bg-white hover:text-slate-700"
              onClick={() => onRemove(question.id)}
              aria-label={`Remove queued follow-up ${index + 1}`}
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function RenameConversationDialog({
  conversation,
  title,
  error,
  saving,
  onTitleChange,
  onCancel,
  onSave,
}: {
  conversation: AskSalesFaqConversationSummary;
  title: string;
  error: string | null;
  saving: boolean;
  onTitleChange: (value: string) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/35 px-4 backdrop-blur-sm">
      <form
        className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_18px_50px_-22px_rgba(15,23,42,.5)]"
        onSubmit={(event) => {
          event.preventDefault();
          onSave();
        }}
      >
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#FEF2F2] text-[#DC2626]">
            <Pencil className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-extrabold tracking-normal text-slate-950">Rename chat</h2>
            <p className="mt-1 truncate text-[12.5px] font-medium text-slate-400">{titleForConversation(conversation)}</p>
          </div>
        </div>
        <label className="mt-4 block text-[12.5px] font-bold text-slate-600" htmlFor="ask-sales-faq-rename-title">
          Chat name
        </label>
        <input
          id="ask-sales-faq-rename-title"
          value={title}
          onChange={(event) => onTitleChange(event.target.value)}
          autoFocus
          maxLength={90}
          className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-slate-400"
        />
        {error ? <p className="mt-2 text-[12.5px] font-semibold text-[#B91C1C]">{error}</p> : null}
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" className="rounded-xl" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" className="rounded-xl bg-[#DC2626] text-white hover:bg-[#B91C1C]" disabled={saving || !title.trim()}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            Save
          </Button>
        </div>
      </form>
    </div>
  );
}

function DeleteConversationDialog({
  conversation,
  error,
  saving,
  onCancel,
  onDelete,
}: {
  conversation: AskSalesFaqConversationSummary;
  error: string | null;
  saving: boolean;
  onCancel: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/35 px-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_18px_50px_-22px_rgba(15,23,42,.5)]">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#FEF2F2] text-[#DC2626]">
            <Trash2 className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-extrabold tracking-normal text-slate-950">Delete chat?</h2>
            <p className="mt-1 text-[13px] font-medium leading-5 text-slate-500">
              This removes it from your chat list.
            </p>
          </div>
        </div>
        <p className="mt-3 truncate rounded-xl bg-slate-50 px-3 py-2 text-[13px] font-semibold text-slate-600">
          {titleForConversation(conversation)}
        </p>
        {error ? <p className="mt-2 text-[12.5px] font-semibold text-[#B91C1C]">{error}</p> : null}
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" className="rounded-xl" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" className="rounded-xl bg-[#DC2626] text-white hover:bg-[#B91C1C]" onClick={onDelete} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}

function FaqSidebar({
  conversations,
  activeConversationId,
  searchQuery,
  drawerOpen,
  collapsed,
  onSearchQueryChange,
  onOpenConversation,
  onNewConversation,
  openMenuConversationId,
  onToggleConversationMenu,
  onRenameConversation,
  onDeleteConversation,
  hasMoreConversations,
  conversationHistoryLoading,
  conversationHistoryError,
  onLoadMoreConversations,
  onBrowse,
  onCloseDrawer,
  onCollapse,
}: {
  conversations: AskSalesFaqConversationSummary[];
  activeConversationId: string | null;
  searchQuery: string;
  drawerOpen: boolean;
  collapsed: boolean;
  onSearchQueryChange: (value: string) => void;
  onOpenConversation: (conversation: AskSalesFaqConversationSummary) => void;
  onNewConversation: () => void;
  openMenuConversationId: string | null;
  onToggleConversationMenu: (conversationId: string) => void;
  onRenameConversation: (conversation: AskSalesFaqConversationSummary) => void;
  onDeleteConversation: (conversation: AskSalesFaqConversationSummary) => void;
  hasMoreConversations: boolean;
  conversationHistoryLoading: boolean;
  conversationHistoryError: string | null;
  onLoadMoreConversations: () => void;
  onBrowse: () => void;
  onCloseDrawer: () => void;
  onCollapse: () => void;
}) {
  if (collapsed) return null;

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-50 flex w-[288px] flex-col border-r border-slate-200/80 bg-[#FBFAFB] transition-transform duration-300 lg:static lg:z-auto lg:h-full lg:translate-x-0",
        drawerOpen ? "translate-x-0" : "-translate-x-full",
      )}
    >
      <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-slate-200/70 px-3.5">
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-xl bg-[#DC2626] text-white shadow-[0_6px_16px_-8px_rgba(220,38,38,.95)]">
            <MessageCircleQuestion className="size-4.5" />
          </span>
          <span className="leading-tight">
            <span className="block text-sm font-extrabold tracking-normal text-slate-950">Ask Sales FAQ</span>
            <span className="block text-[10px] font-bold uppercase tracking-[0.13em] text-slate-400">
              Sales help center
            </span>
          </span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-slate-400 hover:text-slate-700"
          onClick={() => {
            onCloseDrawer();
            onCollapse();
          }}
          aria-label="Collapse sidebar"
        >
          <span className="lg:hidden">
            <X className="size-4.5" />
          </span>
          <span className="hidden lg:block">
            <PanelLeftClose className="size-4.5" />
          </span>
        </Button>
      </div>

      <div className="px-3 pb-2 pt-3">
        <div className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 shadow-sm focus-within:border-slate-300">
          <Search className="size-4 text-slate-400" />
          <input
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            placeholder="Search chats"
            className="w-full bg-transparent text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400"
          />
          {searchQuery ? (
            <button type="button" onClick={() => onSearchQueryChange("")} className="grid size-5 place-items-center rounded text-slate-400 hover:text-slate-600" aria-label="Clear search">
              <X className="size-3.5" />
            </button>
          ) : null}
        </div>
      </div>

      <div className="px-3 pb-2">
        <button
          type="button"
          onClick={onBrowse}
          className="flex h-10 w-full items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 text-left text-sm font-bold text-slate-700 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50"
        >
          <LibraryBig className="size-4.5 text-[#DC2626]" />
          Browse topics
        </button>
      </div>

      <div className="mx-4 my-1 border-t border-slate-200/80" />
      <div className="px-5 pb-1 pt-2 text-[10.5px] font-bold uppercase tracking-[0.13em] text-slate-400">
        {searchQuery.trim() ? "Results" : "Recent"}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pb-3">
        {conversations.length ? (
          <div className="space-y-0.5">
            {conversations.map((conversation) => (
              <div
                key={conversation.id}
                className={cn(
                  "group relative mx-2 flex w-[calc(100%-1rem)] items-center gap-1.5 rounded-xl transition-colors",
                  activeConversationId === conversation.id ? "bg-[#FEF2F2]" : "hover:bg-slate-100",
                )}
              >
                <button
                  type="button"
                  onClick={() => onOpenConversation(conversation)}
                  className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl px-3 py-2 text-left"
                >
                  <MessageSquare
                    className={cn(
                      "size-4 shrink-0",
                      activeConversationId === conversation.id ? "text-[#DC2626]" : "text-slate-400",
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "block truncate text-[13px]",
                        activeConversationId === conversation.id ? "font-bold text-[#B91C1C]" : "font-semibold text-slate-700",
                      )}
                    >
                      {titleForConversation(conversation)}
                    </span>
                  </span>
                  <span className="shrink-0 text-[10.5px] font-semibold text-slate-300">
                    {formatTimestamp(conversation.updatedAt)}
                  </span>
                </button>
                <button
                  type="button"
                  data-conversation-menu-root
                  onClick={(event) => {
                    event.stopPropagation();
                    onToggleConversationMenu(conversation.id);
                  }}
                  className={cn(
                    "mr-1 grid size-7 shrink-0 place-items-center rounded-lg text-slate-400 opacity-100 transition hover:bg-white hover:text-slate-700 sm:opacity-0 sm:group-hover:opacity-100",
                    openMenuConversationId === conversation.id ? "bg-white text-slate-700 opacity-100 shadow-sm" : "",
                  )}
                  aria-label={`Open actions for ${titleForConversation(conversation)}`}
                  aria-expanded={openMenuConversationId === conversation.id}
                >
                  <MoreHorizontal className="size-4" />
                </button>
                {openMenuConversationId === conversation.id ? (
                  <div
                    data-conversation-menu-root
                    className="absolute right-2 top-9 z-20 w-36 overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-[0_12px_30px_-18px_rgba(15,23,42,.45)]"
                  >
                    <button
                      type="button"
                      onClick={() => onRenameConversation(conversation)}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <Pencil className="size-3.5 text-slate-400" />
                      Rename
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteConversation(conversation)}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] font-semibold text-[#B91C1C] hover:bg-[#FEF2F2]"
                    >
                      <Trash2 className="size-3.5" />
                      Delete
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
            {hasMoreConversations ? (
              <div className="px-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 w-full rounded-xl border-slate-200 bg-white text-[12.5px] font-bold text-slate-600 hover:bg-slate-50"
                  onClick={onLoadMoreConversations}
                  disabled={conversationHistoryLoading}
                >
                  {conversationHistoryLoading ? <Loader2 className="size-3.5 animate-spin" /> : <ChevronDown className="size-3.5" />}
                  {searchQuery.trim() ? "Load more results" : "Load older chats"}
                </Button>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="px-5 py-6 text-[13px] font-medium leading-relaxed text-slate-400">
            {conversationHistoryLoading
              ? "Loading chats…"
              : searchQuery.trim()
                ? "No chats match your search."
                : "No saved chats yet."}
          </p>
        )}
        {conversationHistoryError ? (
          <p className="mx-4 mt-2 rounded-xl bg-amber-50 px-3 py-2 text-[11.5px] font-semibold leading-4 text-amber-800">
            {conversationHistoryError}
          </p>
        ) : null}
      </div>

      <div className="shrink-0 border-t border-slate-200/80 bg-[#FBFAFB] px-3 pb-4 pt-3">
        <Button
          type="button"
          onClick={onNewConversation}
          className="h-10 w-full rounded-xl bg-[#DC2626] text-[14px] font-bold text-white shadow-[0_10px_22px_-12px_rgba(220,38,38,.95)] hover:bg-[#B91C1C]"
        >
          <MessageSquarePlus className="size-4.5" />
          New chat
        </Button>
      </div>
    </aside>
  );
}

function WelcomeState({ onStarter, onBrowse }: { onStarter: (prompt: string) => void; onBrowse: () => void }) {
  return (
    <div className="relative mx-auto grid min-h-full w-full max-w-2xl place-items-center px-5 py-6 text-center">
      <div className="relative z-10 flex flex-col items-center">
        <span className="grid size-14 place-items-center rounded-[18px] bg-[#DC2626] text-white shadow-[0_14px_30px_-12px_rgba(220,38,38,.95)]">
          <MessageCircleQuestion className="size-7" />
        </span>
        <h2 className="mt-4 text-[27px] font-extrabold tracking-normal text-slate-950 sm:text-[30px]">
          Ask Sales FAQ
        </h2>
        <p className="mt-2 max-w-md text-[15px] font-medium leading-relaxed text-slate-500">
          Fast, approved answers for live sales calls. Ask a question, or browse the help topics.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2.5">
          {starterPrompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => onStarter(prompt)}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-[13.5px] font-semibold text-slate-700 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50 hover:shadow active:scale-[.98]"
            >
              {prompt}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onBrowse}
          className="mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-[#B91C1C] transition-colors hover:bg-[#FEF2F2]"
        >
          <LibraryBig className="size-4" />
          Browse all topics
          <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  );
}

function MessageRow({
  message,
  feedback,
  onPositive,
  onNegative,
  onFeedbackComment,
  onSubmitNegative,
}: {
  message: ChatMessage;
  feedback?: FeedbackState;
  onPositive: () => void;
  onNegative: () => void;
  onFeedbackComment: (comment: string) => void;
  onSubmitNegative: (comment: string) => void;
}) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[min(42rem,85%)] rounded-2xl rounded-br-md bg-slate-100 px-4 py-2.5 text-[15.5px] font-semibold leading-relaxed text-slate-800">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#DC2626] text-white shadow-[0_6px_16px_-9px_rgba(220,38,38,.95)]">
        <MessageCircleQuestion className="size-5" />
      </span>
      <div className="min-w-0 flex-1 pt-1">
        <p className="mb-1.5 text-xs font-bold uppercase tracking-[0.1em] text-slate-400">Sales FAQ</p>
        {message.outcome === "conversation_reply" ? (
          <>
            {hasStructuredConversationPresentation(message) && message.structuredAnswer ? (
              <StructuredAnswerCard answer={message.structuredAnswer} />
            ) : (
              <AnswerText text={message.content} />
            )}
            {shouldShowRouteNote(message) ? <RouteNote reason={message.routeReason!} /> : null}
          </>
        ) : message.structuredAnswer ? (
          <>
            {shouldShowPlainAnswerWithStructured(message.content, message.structuredAnswer) ? (
              <div className="mb-3">
                <AnswerText text={message.content} />
              </div>
            ) : null}
            <StructuredAnswerCard answer={message.structuredAnswer} />
            {shouldShowRouteNote(message) ? <RouteNote reason={message.routeReason!} /> : null}
          </>
        ) : isRouteOrBlocked(message) && message.outcome !== "route_from_approved_article" ? (
          <SafeCallout message={message} />
        ) : (
          <>
            <AnswerText text={message.content} />
            {shouldShowRouteNote(message) ? <RouteNote reason={message.routeReason!} /> : null}
          </>
        )}
        <SourceDisclosure message={message} />
        <FeedbackControls
          message={message}
          feedback={feedback}
          onPositive={onPositive}
          onNegative={onNegative}
          onFeedbackComment={onFeedbackComment}
          onSubmitNegative={onSubmitNegative}
        />
      </div>
    </div>
  );
}

function hasStructuredConversationPresentation(message: ChatMessage) {
  return Boolean(
    message.structuredAnswer?.sections.some(
      (section) => (section.items?.length || 0) >= 2 || Boolean(section.body && section.title),
    ),
  );
}

function shouldShowRouteNote(message: ChatMessage) {
  if (!message.needsRoute || !message.routeReason) return false;
  const normalizedAnswer = normalizeAnswerDisplayText(message.content);
  const normalizedReason = normalizeAnswerDisplayText(message.routeReason);
  if (normalizedAnswer.includes(normalizedReason)) return false;
  const routeChannel = message.routeReason.match(/#[a-z0-9_-]+/i)?.[0]?.toLowerCase();
  return !routeChannel || !normalizedAnswer.includes(routeChannel);
}

function StructuredAnswerCard({ answer }: { answer: AskSalesFaqStructuredAnswer }) {
  const showSummary = !isDuplicatedSummary(answer);
  const summaryList = showSummary && answer.sections.length === 0 ? parseAnswerDisplayList(answer.summary) : null;

  return (
    <div className="space-y-3">
      {summaryList ? (
        <div className="space-y-2.5 text-[15.5px] font-medium leading-[1.65] text-slate-700">
          {summaryList.intro ? <p className="font-semibold text-slate-800"><InlineAnswerText text={summaryList.intro} /></p> : null}
          <AnswerBulletList items={summaryList.items} />
        </div>
      ) : showSummary ? (
        <p className="text-[15.5px] font-semibold leading-[1.65] text-slate-800"><InlineAnswerText text={answer.summary} /></p>
      ) : null}
      <div className="space-y-2.5">
        {answer.sections.map((section, index) => (
          <AnswerSection key={`${section.title}-${index}`} section={section} />
        ))}
      </div>
    </div>
  );
}

function shouldShowPlainAnswerWithStructured(content: string, answer: AskSalesFaqStructuredAnswer) {
  const normalizedContent = normalizeAnswerDisplayText(content);
  if (!normalizedContent || normalizedContent.length < 80) return false;

  const visibleStructuredText = normalizeAnswerDisplayText(
    [
      answer.summary,
      ...answer.sections.flatMap((section) => [section.title, section.body, ...(section.items || [])]),
    ]
      .filter(Boolean)
      .join(" "),
  );
  if (!visibleStructuredText) return true;
  if (visibleStructuredText.includes(normalizedContent)) return false;

  const contentTokens = uniqueDisplayTokens(normalizedContent);
  if (contentTokens.length < 8) return false;
  const coveredTokens = contentTokens.filter((token) => visibleStructuredText.includes(token)).length;
  return coveredTokens / contentTokens.length < 0.68;
}

function isDuplicatedSummary(answer: AskSalesFaqStructuredAnswer) {
  const firstSection = answer.sections[0];
  if (firstSection?.title === "Answer" && firstSection.body && answer.sections.length > 1) {
    return true;
  }

  if (
    firstSection?.title === "Answer" &&
    firstSection.body &&
    normalizeAnswerDisplayText(answer.summary) === normalizeAnswerDisplayText(firstSection.body)
  ) {
    return true;
  }

  const firstListSection = answer.sections.find((section) => (section.items?.length || 0) >= 5);
  if (!firstListSection?.items?.length || answer.summary.length < 180) return false;

  const normalizedSummary = answer.summary.toLowerCase();
  const duplicatedItems = firstListSection.items
    .slice(0, 6)
    .filter((item) => normalizedSummary.includes(item.toLowerCase())).length;

  return duplicatedItems >= 4;
}

function normalizeAnswerDisplayText(value: string) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function uniqueDisplayTokens(value: string) {
  return Array.from(new Set(value.match(/[a-z0-9$]+/g)?.filter((token) => token.length > 2) || []));
}

function AnswerSection({ section }: { section: AskSalesFaqStructuredAnswer["sections"][number] }) {
  const toneClass =
    section.tone === "warning"
      ? "border-amber-200 bg-amber-50/80"
      : section.tone === "route"
        ? "border-orange-200 bg-orange-50/75"
        : section.tone === "good"
          ? "border-emerald-200 bg-emerald-50/70"
          : "border-slate-200 bg-white/82";

  return (
    <div className={cn("rounded-2xl border px-4 py-3", toneClass)}>
      <h3 className="text-[13px] font-extrabold tracking-normal text-slate-900">{section.title}</h3>
      {section.body ? <p className="mt-1.5 text-[14.5px] font-medium leading-6 text-slate-700"><InlineAnswerText text={section.body} /></p> : null}
      {section.items?.length ? (
        <ul className="mt-2 space-y-1.5">
          {section.items.map((item, index) => (
            <li key={`${item}-${index}`} className="flex items-start gap-2.5 text-[14.5px] font-medium leading-6 text-slate-700">
              <span className="mt-[9px] size-1.5 shrink-0 rounded-full bg-[#DC2626]" />
              <span><InlineAnswerText text={item} /></span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function AnswerText({ text }: { text: string }) {
  const inlineList = parseAnswerDisplayList(text);
  if (inlineList) {
    return (
      <div className="space-y-2.5 text-[15.5px] font-medium leading-[1.65] text-slate-700">
        {inlineList.intro ? <p><InlineAnswerText text={inlineList.intro} /></p> : null}
        <AnswerBulletList items={inlineList.items} />
      </div>
    );
  }

  const blocks = text.split("\n").filter((line) => line.trim());
  return (
    <div className="space-y-2.5 text-[15.5px] font-medium leading-[1.65] text-slate-700">
      {blocks.map((line, index) => {
        const trimmed = line.trim();
        if (trimmed.startsWith("-") || trimmed.startsWith("•")) {
          return (
            <p key={`${trimmed}-${index}`} className="flex items-start gap-2.5">
              <span className="mt-[9px] size-1.5 shrink-0 rounded-full bg-[#DC2626]" />
              <span><InlineAnswerText text={trimmed.replace(/^[-•]\s?/, "")} /></span>
            </p>
          );
        }
        return <p key={`${trimmed}-${index}`}><InlineAnswerText text={trimmed} /></p>;
      })}
    </div>
  );
}

function AnswerBulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5">
      {items.map((item, index) => (
        <li key={`${item}-${index}`} className="flex items-start gap-2.5">
          <span className="mt-[9px] size-1.5 shrink-0 rounded-full bg-[#DC2626]" />
          <span><InlineAnswerText text={item} /></span>
        </li>
      ))}
    </ul>
  );
}

function InlineAnswerText({ text }: { text: string }) {
  return parseAnswerDisplaySegments(text).map((segment, index) =>
    segment.strong ? <strong key={`${segment.text}-${index}`} className="font-extrabold text-slate-900">{segment.text}</strong> : segment.text,
  );
}

function SafeCallout({ message }: { message: ChatMessage }) {
  const firm = message.outcome === "admin_only" || message.outcome === "safe_fallback";
  const isFallback = message.outcome === "safe_fallback";
  const palette = isFallback
    ? { bg: "#F8FAFC", border: "#E2E8F0", chip: "#64748B", icon: Info, label: "Try again" }
    : firm
      ? { bg: "#FFF7ED", border: "#FED7AA", chip: "#C2410C", icon: AlertTriangle, label: "Needs a manager" }
      : { bg: "#FFFBEB", border: "#FDE68A", chip: "#B45309", icon: Info, label: "Not confirmed yet" };
  const Icon = palette.icon;

  return (
    <div className="rounded-2xl border p-4" style={{ background: palette.bg, borderColor: palette.border }}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg text-white" style={{ background: palette.chip }}>
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-[0.1em]" style={{ color: palette.chip }}>
            {palette.label}
          </p>
          <p className="mt-1 text-[15px] font-medium leading-[1.6] text-slate-700">{message.content}</p>
          {message.routeReason ? <p className="mt-2 text-sm font-semibold text-slate-500">{message.routeReason}</p> : null}
        </div>
      </div>
    </div>
  );
}

function RouteNote({ reason }: { reason: string }) {
  return (
    <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm font-medium leading-6 text-amber-900">
      <span className="font-bold">Route note:</span> {reason}
    </div>
  );
}

function SourceDisclosure({ message }: { message: ChatMessage }) {
  const [open, setOpen] = useState(false);
  if (!message.sourceLabel && !message.sourceLastReviewed && !message.sourceDetails) return null;

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12.5px] font-bold text-slate-500 shadow-sm transition-colors hover:border-slate-300 hover:text-slate-700"
      >
        <BookText className="size-3.5" />
        Source
        <ChevronDown className={cn("size-3.5 transition-transform", open ? "rotate-180" : "")} />
      </button>
      {open ? (
        <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50/80 p-3.5">
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-[#DC2626] text-white">
              <ShieldCheck className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400">Approved FAQ topic</p>
              {message.sourceLabel ? <p className="text-sm font-bold text-slate-800">{message.sourceLabel}</p> : null}
              {message.sourceLastReviewed ? (
                <p className="mt-0.5 text-[12.5px] font-semibold text-slate-400">Last reviewed: {message.sourceLastReviewed}</p>
              ) : null}
              {message.structuredAnswer ? (
                <p className="mt-0.5 text-[12.5px] font-semibold text-slate-400">
                  Confidence: {message.structuredAnswer.confidenceLabel} ({message.structuredAnswer.confidenceScore}/100)
                </p>
              ) : null}
              {message.sourceDetails ? <p className="mt-2 text-[12.5px] font-medium leading-5 text-slate-500">{message.sourceDetails}</p> : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FeedbackControls({
  message,
  feedback,
  onPositive,
  onNegative,
  onFeedbackComment,
  onSubmitNegative,
}: {
  message: ChatMessage;
  feedback?: FeedbackState;
  onPositive: () => void;
  onNegative: () => void;
  onFeedbackComment: (comment: string) => void;
  onSubmitNegative: (comment: string) => void;
}) {
  if (message.id.startsWith("local-safe-")) return null;

  if (feedback?.status === "saved") {
    return (
      <p className="mt-2.5 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-slate-500">
        {feedback.rating === "up" ? (
          <>
            <ThumbsUp className="size-3.5 text-[#B91C1C]" />
            Thanks - glad it helped.
          </>
        ) : (
          <>
            <CheckCircle2 className="size-3.5 text-emerald-600" />
            Thanks - this is queued for review.
          </>
        )}
      </p>
    );
  }

  return (
    <div className="mt-3">
      <div className="flex items-center gap-2">
        <span className="text-[12.5px] font-semibold text-slate-400">Helpful?</span>
        <button
          type="button"
          onClick={onPositive}
          disabled={feedback?.status === "saving"}
          aria-label="Helpful"
          className="grid size-8 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-all hover:border-slate-300 hover:text-slate-800 active:scale-95 disabled:opacity-50"
        >
          <ThumbsUp className="size-4" />
        </button>
        <button
          type="button"
          onClick={onNegative}
          disabled={feedback?.status === "saving"}
          aria-label="Not helpful"
          className={cn(
            "grid size-8 place-items-center rounded-lg border bg-white transition-all active:scale-95 disabled:opacity-50",
            feedback?.rating === "down" && feedback.status !== "error"
              ? "border-[#DC2626] bg-[#DC2626] text-white"
              : "border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-800",
          )}
        >
          <ThumbsDown className="size-4" />
        </button>
        {feedback?.status === "saving" ? <span className="text-xs font-semibold text-slate-400">Saving...</span> : null}
        {feedback?.status === "error" ? <span className="text-xs font-semibold text-red-600">Could not save</span> : null}
      </div>

      {feedback?.rating === "down" && feedback.status !== "saving" ? (
        <form
          className="mt-2.5 max-w-md rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
          onSubmit={(event) => {
            event.preventDefault();
            if (feedback.comment.trim()) onSubmitNegative(feedback.comment.trim());
          }}
        >
          <label className="mb-1.5 block text-[13px] font-bold text-slate-700" htmlFor={`feedback-${message.id}`}>
            What was wrong?
          </label>
          <Textarea
            id={`feedback-${message.id}`}
            value={feedback.comment}
            onChange={(event) => onFeedbackComment(event.target.value)}
            rows={2}
            className="min-h-20 resize-none text-sm"
            placeholder="Tell us what was inaccurate or missing."
          />
          <div className="mt-2 flex justify-end">
            <Button
              type="submit"
              size="sm"
              disabled={!feedback.comment.trim()}
              className="rounded-lg bg-[#DC2626] text-white hover:bg-[#B91C1C]"
            >
              Submit
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

function LoadingAnswer() {
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#DC2626] text-white">
        <MessageCircleQuestion className="size-5" />
      </span>
      <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-500 shadow-sm">
        <Loader2 className="size-4 animate-spin text-[#DC2626]" />
        Checking approved FAQ context
      </div>
    </div>
  );
}

function BrowseTopics({
  topicGroups,
  onClose,
  onPick,
}: {
  topicGroups: Array<{ category: string; articles: ApprovedFaqArticle[] }>;
  onClose: () => void;
  onPick: (article: ApprovedFaqArticle) => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex items-stretch justify-center bg-slate-950/40 p-0 backdrop-blur-sm sm:items-center sm:p-6">
      <div className="flex w-full max-w-2xl flex-col overflow-hidden bg-white shadow-[0_2px_6px_rgba(17,17,26,.05),0_18px_48px_-16px_rgba(17,17,26,.24)] sm:max-h-[82vh] sm:rounded-[22px]">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-[#DC2626] text-white">
              <LibraryBig className="size-4.5" />
            </span>
            <div>
              <h2 className="text-[17px] font-extrabold tracking-normal text-slate-950">Browse help topics</h2>
              <p className="text-[12.5px] font-medium text-slate-400">Approved articles only.</p>
            </div>
          </div>
          <Button type="button" variant="ghost" size="icon-lg" className="text-slate-400" onClick={onClose} aria-label="Close topics">
            <X className="size-5" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <div className="space-y-5">
            {topicGroups.map((group) => {
              const Icon = categoryIcons[group.category] || CircleHelp;
              return (
                <section key={group.category}>
                  <div className="flex items-center gap-2.5">
                    <span className="grid size-8 place-items-center rounded-lg bg-[#FEF2F2] text-[#DC2626]">
                      <Icon className="size-4" />
                    </span>
                    <div>
                      <h3 className="text-[15px] font-extrabold tracking-normal text-slate-950">{group.category}</h3>
                      <p className="text-[12.5px] font-medium text-slate-400">{group.articles.length} approved topics</p>
                    </div>
                  </div>
                  <div className="mt-2.5 grid gap-1.5 pl-1 sm:grid-cols-2">
                    {group.articles.map((article) => (
                      <button
                        key={article.id}
                        type="button"
                        onClick={() => onPick(article)}
                        className="group flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-left transition-all hover:border-slate-300 hover:bg-slate-50 hover:shadow-sm"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-bold text-slate-800">{article.title}</span>
                          <span className="block text-[11.5px] font-semibold text-slate-400">
                            Reviewed {article.lastReviewed}
                          </span>
                        </span>
                        <ChevronRight className="size-4.5 shrink-0 text-slate-300 transition-all group-hover:translate-x-0.5 group-hover:text-[#DC2626]" />
                      </button>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
