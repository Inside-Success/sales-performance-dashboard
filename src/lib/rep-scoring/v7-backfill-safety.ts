import { createHash } from "node:crypto";

export type V7WorkState = "pending" | "leased" | "retry_wait" | "completed" | "fair_exclusion" | "dead_letter";

export type V7WorkStatus = {
  state: V7WorkState;
  attempt: number;
  leaseExpiresAt?: string;
  nextAttemptAt?: string;
};

export type V7Progress = {
  eligible: number;
  finalized: number;
  completed: number;
  fairExclusions: number;
  inFlight: number;
  retrying: number;
  deadLetter: number;
  pending: number;
  percent: number;
};

const MAX_CALLS_PER_EXECUTION = 10;
const MAX_ATTEMPTS = 4;

export function v7IdempotencyKey(sourceRecordId: string, scorerVersion: string) {
  const source = sourceRecordId.trim();
  const version = scorerVersion.trim();
  if (!source || !version) throw new Error("A source record and scorer version are required.");
  const digest = createHash("sha256").update(`${version}\u0000${source}`).digest("hex").slice(0, 32);
  return `v7:${version}:${digest}`;
}

export function partitionV7WorkerBatches<T>(items: T[], size = MAX_CALLS_PER_EXECUTION): T[][] {
  const bounded = Math.max(1, Math.min(MAX_CALLS_PER_EXECUTION, Math.floor(size)));
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += bounded) batches.push(items.slice(index, index + bounded));
  return batches;
}

export function canAcquireV7Work(status: V7WorkStatus | undefined, now: Date) {
  if (!status) return true;
  if (status.state === "pending") return true;
  if (status.state === "retry_wait") return dateValue(status.nextAttemptAt) <= now.getTime();
  if (status.state === "leased") return dateValue(status.leaseExpiresAt) <= now.getTime();
  return false;
}

export function planV7Retry(idempotencyKey: string, attempt: number, retryable: boolean, now: Date) {
  const normalizedAttempt = Math.max(1, Math.floor(attempt));
  if (!retryable || normalizedAttempt >= MAX_ATTEMPTS) return { state: "dead_letter" as const, nextAttemptAt: null, delaySeconds: 0 };
  const base = 30 * (2 ** (normalizedAttempt - 1));
  const jitter = deterministicJitter(idempotencyKey, normalizedAttempt, Math.ceil(base * 0.25));
  const delaySeconds = base + jitter;
  return { state: "retry_wait" as const, nextAttemptAt: new Date(now.getTime() + delaySeconds * 1000).toISOString(), delaySeconds };
}

export function calculateV7BackfillProgress(statuses: V7WorkStatus[]): V7Progress {
  const counts = { completed: 0, fairExclusions: 0, inFlight: 0, retrying: 0, deadLetter: 0, pending: 0 };
  for (const status of statuses) {
    if (status.state === "completed") counts.completed += 1;
    else if (status.state === "fair_exclusion") counts.fairExclusions += 1;
    else if (status.state === "leased") counts.inFlight += 1;
    else if (status.state === "retry_wait") counts.retrying += 1;
    else if (status.state === "dead_letter") counts.deadLetter += 1;
    else counts.pending += 1;
  }
  const eligible = statuses.length;
  const finalized = counts.completed + counts.fairExclusions;
  return { eligible, finalized, ...counts, percent: eligible ? Math.round((finalized / eligible) * 1000) / 10 : 100 };
}

function deterministicJitter(key: string, attempt: number, maximum: number) {
  if (maximum <= 0) return 0;
  const digest = createHash("sha256").update(`${key}:${attempt}`).digest();
  return digest.readUInt32BE(0) % (maximum + 1);
}

function dateValue(value?: string) {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}
