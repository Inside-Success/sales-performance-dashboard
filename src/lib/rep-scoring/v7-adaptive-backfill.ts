export type V7BackfillSnapshot = {
  providerHealthy: boolean;
  balanceAvailable: boolean;
  currentTargetExecutions?: number;
  activeV7Executions: number;
  activeOrganizationExecutions: number;
  recentCalls: number;
  recentTimeouts: number;
  recentRateLimits: number;
  recentProviderFailures: number;
  recentAirtableFailures: number;
  staleLeaseCount: number;
  pendingCalls: number;
};

export type V7AdmissionPlan = {
  state: "run" | "pause" | "complete";
  reason: string;
  targetExecutions: number;
  newExecutions: number;
  callsPerExecution: number;
  callsToAdmit: number;
  organizationReserve: number;
  nextCheckSeconds: number;
};

const ORGANIZATION_LIMIT = 50;
const ORGANIZATION_RESERVE = 30;
const MIN_TARGET = 6;
const INITIAL_TARGET = 15;
const MAX_TARGET = 20;
const CALLS_PER_EXECUTION = 10;

export function calculateV7AdmissionPlan(snapshot: V7BackfillSnapshot): V7AdmissionPlan {
  if (!snapshot.providerHealthy || !snapshot.balanceAvailable) {
    return paused("Provider health or balance is unavailable.", snapshot);
  }
  if (snapshot.pendingCalls <= 0) {
    return { state: "complete", reason: "No pending calls remain.", targetExecutions: 0, newExecutions: 0, callsPerExecution: CALLS_PER_EXECUTION, callsToAdmit: 0, organizationReserve: ORGANIZATION_RESERVE, nextCheckSeconds: 120 };
  }

  const recentCalls = Math.max(1, snapshot.recentCalls);
  const seriousFailures = snapshot.recentTimeouts + snapshot.recentRateLimits + snapshot.recentProviderFailures + snapshot.recentAirtableFailures;
  const seriousFailureRate = seriousFailures / recentCalls;
  const current = clamp(snapshot.currentTargetExecutions ?? INITIAL_TARGET, MIN_TARGET, MAX_TARGET);
  let target = current;
  let reason = "Healthy; refill available worker slots.";

  if (snapshot.recentRateLimits > 0 || snapshot.recentTimeouts > 0 || seriousFailureRate >= 0.02 || snapshot.staleLeaseCount >= 3) {
    target = Math.max(MIN_TARGET, Math.floor(current / 2));
    reason = "Backpressure detected; concurrency reduced and retries remain bounded.";
  } else if (seriousFailures === 0 && snapshot.staleLeaseCount === 0) {
    target = Math.min(MAX_TARGET, current + 2);
    reason = target > current ? "Healthy; concurrency increased by two executions." : "Healthy at the validated ceiling.";
  }

  const organizationSlots = Math.max(0, ORGANIZATION_LIMIT - ORGANIZATION_RESERVE - snapshot.activeOrganizationExecutions);
  const targetSlots = Math.max(0, target - snapshot.activeV7Executions);
  const pendingWorkers = Math.ceil(snapshot.pendingCalls / CALLS_PER_EXECUTION);
  const newExecutions = Math.min(organizationSlots, targetSlots, pendingWorkers);
  const callsToAdmit = Math.min(snapshot.pendingCalls, newExecutions * CALLS_PER_EXECUTION);

  if (newExecutions <= 0) {
    return { state: "pause", reason: "No safe execution slots are currently available.", targetExecutions: target, newExecutions: 0, callsPerExecution: CALLS_PER_EXECUTION, callsToAdmit: 0, organizationReserve: ORGANIZATION_RESERVE, nextCheckSeconds: 60 };
  }
  return { state: "run", reason, targetExecutions: target, newExecutions, callsPerExecution: CALLS_PER_EXECUTION, callsToAdmit, organizationReserve: ORGANIZATION_RESERVE, nextCheckSeconds: 60 };
}

function paused(reason: string, snapshot: V7BackfillSnapshot): V7AdmissionPlan {
  return { state: "pause", reason, targetExecutions: clamp(snapshot.currentTargetExecutions ?? INITIAL_TARGET, MIN_TARGET, MAX_TARGET), newExecutions: 0, callsPerExecution: CALLS_PER_EXECUTION, callsToAdmit: 0, organizationReserve: ORGANIZATION_RESERVE, nextCheckSeconds: 120 };
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, Math.floor(Number.isFinite(value) ? value : minimum)));
}
