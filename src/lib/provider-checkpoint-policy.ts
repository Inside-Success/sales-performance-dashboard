import { z } from "zod";

const identity = {
  source_id: z.string().min(1).max(160),
  stage: z.string().min(1).max(100),
  provider: z.enum(["anthropic", "deepseek"]),
  request_hash: z.string().regex(/^[a-f0-9]{64}$/),
};
export const checkpointInput = z.discriminatedUnion("action", [
  z.object({ action: z.literal("claim"), ...identity }),
  z.object({ action: z.literal("complete"), ...identity, token: z.string().uuid(), result: z.record(z.string(), z.unknown()) }),
  z.object({ action: z.literal("fail"), ...identity, token: z.string().uuid(), error: z.string().max(1500) }),
]);
export type CheckpointInput = z.infer<typeof checkpointInput>;

export function validProviderResult(result: Record<string, unknown>) {
  return result.ok === true && !result.parse_error && result.parsed_json !== null &&
    typeof result.parsed_json === "object" && !Array.isArray(result.parsed_json) &&
    !["max_tokens", "refusal", "length"].includes(String(result.stop_reason));
}

export function retryableProviderFailure(message: string) {
  if (/\b401\b|\b403\b|\brefusal\b|invalid source/i.test(message)) return false;
  return /timeout|timed out|aborted|524|429|50[0234]|529|overload|rate.?limit|temporar|ECONNRESET|ETIMEDOUT|EAI_AGAIN|fetch failed|socket|connection.*closed|empty response|invalid.*json|JSON parse|structured.*invalid/i.test(message);
}

export function retryDelaySeconds(attempt: number) {
  return [300, 900, 3600][Math.min(2, Math.max(0, attempt - 1))];
}
