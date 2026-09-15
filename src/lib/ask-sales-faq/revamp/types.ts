import { z } from "zod";

export type Scope = "main_istv" | "dj_nlceo" | "reality" | "shared";
export type Evidence = {
  id: string; decisionKey: string; title: string; questions: string[]; text: string;
  scopes: string[]; sourceIds: string[]; reviewedAt: string; authority: number;
  kind: "policy" | "coaching" | "resource"; risk: string; routeKey: string | null;
  conditions: string[]; supersedes: string[];
  domains?: string[]; actions?: string[]; entities?: string[];
  sourceKind?: string; approvedBy?: string[];
};
export const planSchema = z.object({
  historyMode: z.enum(["continue", "new_subject"]),
  intent: z.enum(["conversation", "sales_advice", "company_question", "rewrite", "correction", "action"]),
  question: z.string().min(1).max(12000),
  scopes: z.array(z.enum(["main_istv", "dj_nlceo", "reality"])).max(3),
  queries: z.array(z.string().max(500)).max(4),
});
export const answerSchema = z.object({
  status: z.enum(["answer", "partial", "clarification", "knowledge_gap", "conflict", "action_route", "conversation", "sales_advice"]),
  paragraphs: z.array(z.object({
    text: z.string().min(1).max(4000),
    kind: z.enum(["company_fact", "general_advice", "conversation", "uncertainty"]),
    evidenceIds: z.array(z.string()).max(20),
  })).min(1).max(12),
  routeKey: z.string().nullable(),
});
export type Plan = Omit<z.infer<typeof planSchema>, "historyMode"> & { historyMode?: "continue" | "new_subject" };
export type Answer = z.infer<typeof answerSchema>;
export type Usage = { inputTokens: number; cachedTokens: number; outputTokens: number };
export type Attempt = Usage & { provider: "openai" | "deepseek"; model: string; purpose: string; latencyMs: number; status: "success" | "failed"; error?: string };
export type JsonProvider = (system: string, input: unknown, purpose: string) => Promise<{ value: unknown; attempt: Attempt }>;
