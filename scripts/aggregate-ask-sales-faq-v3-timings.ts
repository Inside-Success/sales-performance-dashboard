import { writeFile } from "node:fs/promises";
import path from "node:path";

import { neon } from "@neondatabase/serverless";

function argument(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) || null;
}

function percentile(values: number[], fraction: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * fraction) - 1))];
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
  const days = Math.max(1, Math.min(90, Number.parseInt(argument("days") || "30", 10) || 30));
  const output = path.resolve(argument("output") || "/private/tmp/ask-sales-v3-production-timing-baseline.json");
  const sql = neon(process.env.DATABASE_URL);
  const rows = await sql`
    select
      created_at::text as created_at,
      provider,
      model,
      latency_ms,
      answer_payload #> '{runtimeMetadata,v3,stageTimings}' as stage_timings
    from ask_sales_faq_messages
    where role = 'assistant'
      and answer_payload #>> '{runtimeMetadata,pipelineVersion}' = 'v3'
      and created_at >= now() - (${days}::int * interval '1 day')
    order by created_at desc
  ` as Array<{
    created_at: string;
    provider: string | null;
    model: string | null;
    latency_ms: number | null;
    stage_timings: Record<string, unknown> | null;
  }>;
  const stages = Array.from(new Set(rows.flatMap((row) => Object.keys(row.stage_timings || {})))).sort();
  const stageSummaries = Object.fromEntries(stages.map((stage) => {
    const values = rows
      .map((row) => Number(row.stage_timings?.[stage]))
      .filter((value) => Number.isFinite(value) && value >= 0);
    return [stage, {
      samples: values.length,
      average: values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0,
      p50: percentile(values, 0.5),
      p90: percentile(values, 0.9),
      p95: percentile(values, 0.95),
      max: values.length ? Math.max(...values) : 0,
    }];
  }));
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    readOnly: true,
    windowDays: days,
    sampleCount: rows.length,
    oldestSampleAt: rows.at(-1)?.created_at || null,
    newestSampleAt: rows.at(0)?.created_at || null,
    providers: Object.fromEntries(Array.from(new Set(rows.map((row) => `${row.provider || "none"}/${row.model || "none"}`))).sort().map((key) => [key, rows.filter((row) => `${row.provider || "none"}/${row.model || "none"}` === key).length])),
    stageTimingsMs: stageSummaries,
  };
  await writeFile(output, JSON.stringify(report, null, 2) + "\n", { encoding: "utf8", mode: 0o600 });
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
