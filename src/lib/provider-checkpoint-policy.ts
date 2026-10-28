import {objectionProviderErrors} from "./objection-coaching.cjs";
import { z } from "zod";
import { coachingStage, normalizeCoaching, coachingContractErrors, failureDecision } from "./coaching-reliability-policy.mjs";

const identity = {
  source_id: z.string().min(1).max(160),
  stage: z.string().min(1).max(100),
  provider: z.enum(["anthropic", "deepseek"]),
  request_hash: z.string().regex(/^[a-f0-9]{64}$/),
};
export const checkpointInput = z.discriminatedUnion("action", [
  z.object({ action: z.literal("source_status"), source_id: z.string().regex(/^rec[A-Za-z0-9]+$/) }),
  z.object({ action: z.literal("claim"), ...identity }),
  z.object({ action: z.literal("complete"), ...identity, token: z.string().uuid(), result: z.record(z.string(), z.unknown()) }),
  z.object({ action: z.literal("fail"), ...identity, token: z.string().uuid(), error: z.string().max(1500) }),
]);
export type CheckpointInput = z.infer<typeof checkpointInput>;

export function validProviderResult(result: Record<string, unknown>) {
  const valid = result.ok === true && !result.parse_error && result.parsed_json !== null &&
    typeof result.parsed_json === "object" && !Array.isArray(result.parsed_json) &&
    !["max_tokens", "refusal", "length"].includes(String(result.stop_reason));
  return valid && objectionProviderErrors(String(result.call_purpose),result.parsed_json).length === 0 && (!coachingStage(String(result.call_purpose)) || coachingContractErrors(normalizeCoaching(result.parsed_json)).length === 0);
}

export function retryableProviderFailure(message: string) {
  return failureDecision(message).retryable;
}

export function retryDelaySeconds(attempt: number) {
  return [300, 900, 3600][Math.min(2, Math.max(0, attempt - 1))];
}
