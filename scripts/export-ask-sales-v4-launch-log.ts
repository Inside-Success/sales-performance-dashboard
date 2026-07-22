import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { neon } from "@neondatabase/serverless";

type Row = {
  assistant_id: string;
  conversation_id: string;
  question: string;
  answer: string;
  outcome: string | null;
  needs_route: boolean;
  route_reason: string | null;
  provider: string | null;
  model: string | null;
  latency_ms: number | null;
  error_class: string | null;
  answer_payload: Record<string, unknown> | null;
  rating: "up" | "down" | null;
  created_at: string;
};

function argument(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) || null;
}

function safeTimestamp(value: string, fallback: string) {
  const date = new Date(value || fallback);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid timestamp: ${value}`);
  return date.toISOString();
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required for this SELECT-only export");
  const from = safeTimestamp(argument("from") || "", "2026-07-13T13:00:00.000Z");
  const to = safeTimestamp(argument("to") || "", "2026-07-21T12:51:28.999Z");
  const outputDir = path.resolve(argument("output-dir") || "artifacts/ask-sales-faq-v4-live-export");
  const outputPath = path.join(outputDir, `launch-log-${from.slice(0, 10)}-to-${to.replace(/[:.]/g, "-")}.json`);
  const sql = neon(databaseUrl);

  // Safety invariant: this script issues exactly one SELECT. It does not call
  // any schema helper, INSERT/UPDATE/DELETE function, workflow, or API route.
  const rows = await sql.query(
    `
      select
        a.id as assistant_id,
        a.conversation_id,
        coalesce((
          select u.content_redacted
          from ask_sales_faq_messages u
          where u.conversation_id = a.conversation_id
            and u.role = 'user'
            and u.created_at <= a.created_at
          order by u.created_at desc
          limit 1
        ), '') as question,
        a.content_redacted as answer,
        a.outcome,
        a.needs_route,
        a.route_reason,
        a.provider,
        a.model,
        a.latency_ms,
        a.error_class,
        a.answer_payload,
        f.rating,
        a.created_at::text as created_at
      from ask_sales_faq_messages a
      left join lateral (
        select rating
        from ask_sales_faq_feedback
        where message_id = a.id
        order by created_at desc
        limit 1
      ) f on true
      where a.role = 'assistant'
        and a.created_at >= $1::timestamptz
        and a.created_at <= $2::timestamptz
      order by a.created_at asc, a.id asc
    `,
    [from, to],
  ) as Row[];

  const salt = createHash("sha256").update(`${from}:${to}:ask-sales-v4`).digest("hex");
  const items = rows.map((row, index) => ({
    id: `launch-${String(index + 1).padStart(3, "0")}`,
    conversationKey: createHash("sha256").update(`${salt}:${row.conversation_id}`).digest("hex").slice(0, 16),
    question: row.question,
    productionAnswer: row.answer,
    productionOutcome: row.outcome,
    productionNeedsRoute: row.needs_route,
    productionRouteReason: row.route_reason,
    productionProvider: row.provider,
    productionModel: row.model,
    productionLatencyMs: row.latency_ms || 0,
    productionErrorClass: row.error_class,
    productionRuntimeMetadata: row.answer_payload?.runtimeMetadata || null,
    feedback: row.rating ? { rating: row.rating } : null,
    capturedAt: row.created_at,
  }));
  const report = {
    schemaVersion: 1,
    name: "Ask Sales fixed post-launch log snapshot",
    generatedAt: new Date().toISOString(),
    readOnlyExport: true,
    containsViewerIdentity: false,
    containsFreeTextFeedback: false,
    from,
    to,
    itemCount: items.length,
    conversationCount: new Set(items.map((item) => item.conversationKey)).size,
    items,
  };
  await mkdir(outputDir, { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ outputPath, itemCount: items.length, conversationCount: report.conversationCount }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
