const manifest = $('Build Exact V7.1 Checkpoint Manifest').first().json;
const dispatchLock = $input.first()?.json?.run;
if (!dispatchLock || dispatchLock.state !== 'dispatched' || dispatchLock.selectedCalls !== manifest.selectedCalls) {
  throw new Error('Dispatch lock confirmation was not returned; no workers will start.');
}
return manifest.batches.map((batch, index) => ({ json: { ...batch, checkpointSelectedTotal: manifest.selectedCalls, checkpointWorkerBatches: manifest.workerBatches, dispatchIndex: index + 1 }, pairedItem: { item: 0 } }));
