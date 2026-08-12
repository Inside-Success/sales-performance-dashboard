const inbound = $input.first()?.json || {};
const snapshot = inbound.body && typeof inbound.body === 'object' ? inbound.body : inbound;
const ORGANIZATION_LIMIT = 50;
const ORGANIZATION_RESERVE = 30;
const MIN_TARGET = 6;
const INITIAL_TARGET = 15;
const MAX_TARGET = 20;
const CALLS_PER_EXECUTION = 10;
const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, Math.floor(Number.isFinite(Number(value)) ? Number(value) : minimum)));
const pause = (reason, target, nextCheckSeconds = 120) => [{ json: { state: 'pause', reason, targetExecutions: target, newExecutions: 0, callsPerExecution: CALLS_PER_EXECUTION, callsToAdmit: 0, organizationReserve: ORGANIZATION_RESERVE, nextCheckSeconds } }];

const current = clamp(snapshot.currentTargetExecutions ?? INITIAL_TARGET, MIN_TARGET, MAX_TARGET);
if (snapshot.providerHealthy !== true || snapshot.balanceAvailable !== true) return pause('Provider health or balance is unavailable.', current);
const pendingCalls = Math.max(0, Number(snapshot.pendingCalls || 0));
if (!pendingCalls) return [{ json: { state: 'complete', reason: 'No pending calls remain.', targetExecutions: 0, newExecutions: 0, callsPerExecution: CALLS_PER_EXECUTION, callsToAdmit: 0, organizationReserve: ORGANIZATION_RESERVE, nextCheckSeconds: 120 } }];

const recentCalls = Math.max(1, Number(snapshot.recentCalls || 0));
const timeouts = Math.max(0, Number(snapshot.recentTimeouts || 0));
const rateLimits = Math.max(0, Number(snapshot.recentRateLimits || 0));
const providerFailures = Math.max(0, Number(snapshot.recentProviderFailures || 0));
const airtableFailures = Math.max(0, Number(snapshot.recentAirtableFailures || 0));
const staleLeases = Math.max(0, Number(snapshot.staleLeaseCount || 0));
const failures = timeouts + rateLimits + providerFailures + airtableFailures;
let target = current;
let reason = 'Healthy; refill available worker slots.';
if (rateLimits > 0 || timeouts > 0 || failures / recentCalls >= 0.02 || staleLeases >= 3) {
  target = Math.max(MIN_TARGET, Math.floor(current / 2));
  reason = 'Backpressure detected; concurrency reduced and retries remain bounded.';
} else if (failures === 0 && staleLeases === 0) {
  target = Math.min(MAX_TARGET, current + 2);
  reason = target > current ? 'Healthy; concurrency increased by two executions.' : 'Healthy at the validated ceiling.';
}

const activeV7 = Math.max(0, Number(snapshot.activeV7Executions || 0));
const activeOrganization = Math.max(0, Number(snapshot.activeOrganizationExecutions || 0));
const organizationSlots = Math.max(0, ORGANIZATION_LIMIT - ORGANIZATION_RESERVE - activeOrganization);
const targetSlots = Math.max(0, target - activeV7);
const pendingWorkers = Math.ceil(pendingCalls / CALLS_PER_EXECUTION);
const newExecutions = Math.min(organizationSlots, targetSlots, pendingWorkers);
if (!newExecutions) return pause('No safe execution slots are currently available.', target, 60);
return [{ json: { state: 'run', reason, targetExecutions: target, newExecutions, callsPerExecution: CALLS_PER_EXECUTION, callsToAdmit: Math.min(pendingCalls, newExecutions * CALLS_PER_EXECUTION), organizationReserve: ORGANIZATION_RESERVE, nextCheckSeconds: 60 } }];
