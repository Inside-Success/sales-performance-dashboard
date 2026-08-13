import { describe, expect, it } from "vitest";

import { calculateV7AdmissionPlan } from "@/lib/rep-scoring/v7-adaptive-backfill";

const healthy = { providerHealthy: true, balanceAvailable: true, currentTargetExecutions: 15, activeV7Executions: 0, activeOrganizationExecutions: 0, recentCalls: 100, recentTimeouts: 0, recentRateLimits: 0, recentProviderFailures: 0, recentAirtableFailures: 0, staleLeaseCount: 0, pendingCalls: 1500 };

describe("V7 adaptive backfill admission", () => {
  it("ramps healthy work without exceeding 20 executions or 10 calls per execution", () => {
    expect(calculateV7AdmissionPlan(healthy)).toMatchObject({ state: "run", targetExecutions: 17, newExecutions: 17, callsPerExecution: 10, callsToAdmit: 170 });
  });

  it("refills only free V7 slots", () => {
    expect(calculateV7AdmissionPlan({ ...healthy, currentTargetExecutions: 20, activeV7Executions: 16 })).toMatchObject({ targetExecutions: 20, newExecutions: 4, callsToAdmit: 40 });
  });

  it("reserves thirty organization execution slots", () => {
    expect(calculateV7AdmissionPlan({ ...healthy, activeOrganizationExecutions: 18 })).toMatchObject({ newExecutions: 2, callsToAdmit: 20 });
  });

  it("backs off quickly on timeout or rate-limit evidence", () => {
    expect(calculateV7AdmissionPlan({ ...healthy, currentTargetExecutions: 20, activeV7Executions: 0, recentTimeouts: 1 })).toMatchObject({ state: "run", targetExecutions: 10, newExecutions: 10 });
  });

  it("opens the circuit when provider health or balance is unsafe", () => {
    expect(calculateV7AdmissionPlan({ ...healthy, balanceAvailable: false })).toMatchObject({ state: "pause", newExecutions: 0, callsToAdmit: 0 });
  });
});
