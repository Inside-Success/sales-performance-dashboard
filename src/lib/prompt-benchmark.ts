import { z } from "zod";
import type { JsonObject } from "@/lib/types";

const optionalString = z
  .union([z.string(), z.number(), z.boolean(), z.null()])
  .optional()
  .transform((value) => {
    if (value === null || value === undefined) return null;
    const text = String(value).trim();
    return text.length ? text : null;
  });

const jsonObject = z.record(z.string(), z.unknown()).default({});

const numeric = z
  .union([z.number(), z.string(), z.null()])
  .optional()
  .transform((value) => {
    if (value === null || value === undefined || value === "") return 0;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  });

const integer = numeric.transform((value) => Math.max(0, Math.round(value)));

const booleanish = z
  .union([z.boolean(), z.string(), z.number(), z.null()])
  .optional()
  .transform((value) => {
    if (value === null || value === undefined || value === "") return null;
    if (typeof value === "boolean") return value;
    const text = String(value).trim().toLowerCase();
    if (["true", "yes", "y", "1"].includes(text)) return true;
    if (["false", "no", "n", "0"].includes(text)) return false;
    return null;
  });

const runSchema = z
  .object({
    run_id: optionalString,
    title: optionalString,
    status: optionalString,
    sheet_url: optionalString,
    dashboard_url: optionalString,
    started_at: optionalString,
    finished_at: optionalString,
    total_cost_usd: numeric,
    total_provider_calls: integer,
    source_payload: jsonObject,
  })
  .passthrough();

const outputSchema = z
  .object({
    result_id: optionalString,
    run_id: optionalString,
    case_id: optionalString,
    case_label: optionalString,
    case_type: optionalString,
    expected_call_status: optionalString,
    call_status: optionalString,
    model: optionalString,
    provider: optionalString,
    call_mode: optionalString,
    coaching_mode: optionalString,
    output: jsonObject,
    ai_eval: jsonObject,
    classification_agreed: booleanish,
    overall_quality: numeric.transform((value) => (value > 0 ? value : null)),
    total_cost_usd: numeric,
    total_input_tokens: integer,
    total_output_tokens: integer,
    total_latency_ms: integer,
  })
  .passthrough();

const costSchema = z
  .object({
    cost_id: optionalString,
    run_id: optionalString,
    result_id: optionalString,
    case_id: optionalString,
    model: optionalString,
    provider: optionalString,
    call_purpose: optionalString,
    input_tokens: integer,
    cache_creation_input_tokens: integer,
    cache_read_input_tokens: integer,
    output_tokens: integer,
    input_cost_usd: numeric,
    cache_write_cost_usd: numeric,
    cache_read_cost_usd: numeric,
    output_cost_usd: numeric,
    total_cost_usd: numeric,
    started_at: optionalString,
    finished_at: optionalString,
    latency_ms: integer,
    provider_response_id: optionalString,
    error: optionalString,
  })
  .passthrough();

export const promptBenchmarkIngestSchema = z
  .object({
    run: runSchema,
    outputs: z.array(outputSchema).default([]),
    costs: z.array(costSchema).default([]),
  })
  .passthrough();

export const promptBenchmarkSubmitSchema = z
  .object({
    input_type: z.enum(["transcript", "zoom_link"]),
    title: optionalString,
    rep_name: optionalString,
    client_name: optionalString,
    transcript_text: optionalString,
    zoom_link: optionalString,
  })
  .superRefine((value, ctx) => {
    if (value.input_type === "transcript" && (!value.transcript_text || value.transcript_text.length < 80)) {
      ctx.addIssue({
        code: "custom",
        path: ["transcript_text"],
        message: "Paste a longer transcript before submitting.",
      });
    }

    if (value.input_type === "zoom_link" && !value.zoom_link) {
      ctx.addIssue({
        code: "custom",
        path: ["zoom_link"],
        message: "Zoom link is required.",
      });
    }
  });

export type PromptBenchmarkIngestPayload = ReturnType<typeof normalizePromptBenchmarkIngest>;
export type PromptBenchmarkSubmitPayload = z.infer<typeof promptBenchmarkSubmitSchema>;

export function normalizePromptBenchmarkIngest(raw: unknown) {
  const parsed = promptBenchmarkIngestSchema.parse(raw);
  const runId = parsed.run.run_id || `run-${Date.now()}`;

  return {
    run: {
      run_id: runId,
      title: parsed.run.title,
      status: parsed.run.status || "completed",
      sheet_url: parsed.run.sheet_url,
      dashboard_url: parsed.run.dashboard_url,
      started_at: parsed.run.started_at,
      finished_at: parsed.run.finished_at,
      total_cost_usd: parsed.run.total_cost_usd,
      total_provider_calls: parsed.run.total_provider_calls,
      source_payload: parsed.run.source_payload as JsonObject,
    },
    outputs: parsed.outputs.map((output, index) => ({
      result_id: output.result_id || `${runId}-result-${index + 1}`,
      run_id: output.run_id || runId,
      case_id: output.case_id || "unknown-case",
      case_label: output.case_label,
      case_type: output.case_type || "scored",
      expected_call_status: output.expected_call_status,
      call_status: output.call_status,
      model: output.model || "unknown-model",
      provider: output.provider || "unknown-provider",
      call_mode: output.call_mode || "one-call",
      coaching_mode: output.coaching_mode || "single-stage",
      output: output.output as JsonObject,
      ai_eval: output.ai_eval as JsonObject,
      classification_agreed: output.classification_agreed,
      overall_quality: output.overall_quality,
      total_cost_usd: output.total_cost_usd,
      total_input_tokens: output.total_input_tokens,
      total_output_tokens: output.total_output_tokens,
      total_latency_ms: output.total_latency_ms,
    })),
    costs: parsed.costs.map((cost, index) => ({
      cost_id: cost.cost_id || `${runId}-cost-${index + 1}`,
      run_id: cost.run_id || runId,
      result_id: cost.result_id,
      case_id: cost.case_id,
      model: cost.model || "unknown-model",
      provider: cost.provider || "unknown-provider",
      call_purpose: cost.call_purpose || "unknown",
      input_tokens: cost.input_tokens,
      cache_creation_input_tokens: cost.cache_creation_input_tokens,
      cache_read_input_tokens: cost.cache_read_input_tokens,
      output_tokens: cost.output_tokens,
      input_cost_usd: cost.input_cost_usd,
      cache_write_cost_usd: cost.cache_write_cost_usd,
      cache_read_cost_usd: cost.cache_read_cost_usd,
      output_cost_usd: cost.output_cost_usd,
      total_cost_usd: cost.total_cost_usd,
      started_at: cost.started_at,
      finished_at: cost.finished_at,
      latency_ms: cost.latency_ms,
      provider_response_id: cost.provider_response_id,
      error: cost.error,
    })),
  };
}
