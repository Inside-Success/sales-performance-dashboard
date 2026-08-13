const calls = $input.all().map((item) => item.json || {}).filter((call) => call.idempotencyKey);
const context = $('Build V7.1 Checkpoint Context').first().json;
const lock = $('Acquire Atomic V7.1 Checkpoint Lock').first().json;
if (lock.acquired !== true || !lock.token) throw new Error('Atomic run lock was not acquired.');
if (calls.length !== context.targetCalls) throw new Error(`Expected exactly ${context.targetCalls} selected calls, received ${calls.length}.`);
const rosterByEmail = new Map();
for (const call of calls) if (call.repEmail && !rosterByEmail.has(call.repEmail)) rosterByEmail.set(call.repEmail, { email: call.repEmail, name: call.repName });
const roster = [...rosterByEmail.values()];
const batches = [];
for (let index = 0; index < calls.length; index += context.workerBatchSize) {
  const batch = calls.slice(index, index + context.workerBatchSize);
  batches.push({
    batch, roster, runId: context.runId,
    workerBatchId: `${context.runId}-worker-${String(batches.length + 1).padStart(2, '0')}`,
    batchSize: batch.length, wave: batches.length < context.firstWaveBatches ? 1 : 2,
  });
}
if (batches.length !== context.expectedWorkerBatches || batches.some((batch) => batch.batchSize > 10)) {
  throw new Error(`Checkpoint batching invariant failed: built ${batches.length} batches.`);
}
return [{ json: { runKey: context.runKey, token: lock.token, selectedCalls: calls.length, workerBatches: batches.length, batches, call1: calls.filter((call) => call.callType === 'Call 1').length, call2: calls.filter((call) => call.callType === 'Call 2+').length } }];
