// Offline behavioral checks of the exact released n8n Code-node source.
// No provider calls, credentials, business records, or notifications.
const assert = require('node:assert/strict');
const code = require('./deployed-code.json');
const input = rows => ({ all: () => rows.map(json => ({ json })) });
const decode = rows => new Function('$input', code['MM Decode Document Response'])(input(rows));
const decoded = decode([
  { statusCode: 200, body: { id: 'document-a' } },
  { statusCode: 403, body: { error: { message: 'Quota exceeded', errors: [{ reason: 'userRateLimitExceeded' }] } } },
  { statusCode: 500, body: { error: { message: 'Internal error' } } },
]);
assert.equal(decoded[0].json.documentId, 'document-a');
assert.deepEqual(decoded[1].pairedItem, { item: 1 });
assert.equal(decoded[1].json.error.description, 'userRateLimitExceeded');
assert.equal(decoded[2].json.error.statusCode, 500);
const policy = new Function(code['MM Retry Policy Create Transcript Google Doc'].split('return $input.all()')[0] + '\nreturn classifyFailure;')();
assert.equal(policy({ statusCode: 403, message: 'Forbidden' }, 'write', 0).retry, true);
assert.equal(policy({ statusCode: 403, message: 'Forbidden' }, 'write', 2).retry, false);
assert.equal(policy({ statusCode: 403, message: 'Forbidden' }, 'write', 2).reason, 'write_rejected');
assert.equal(policy({ statusCode: 403, description: 'userRateLimitExceeded' }, 'write', 3).retry, true);
assert.equal(policy({ statusCode: 429 }, 'write', 5).retry, false);
for (const error of [{ statusCode: 500 }, { message: 'ETIMEDOUT' }, { statusCode: 401 }]) {
  assert.equal(policy(error, 'write', 0).retry, false);
}
const select = rows => new Function('$input', code['Select One Rejected Write'])(input(rows));
const event = { id: 1, call_key: 'zoom:example:a', execution_id: '1', stage: 'Create Transcript Google Doc', status: 'write_rejected', occurred_at: '2026-09-22T10:00:00.000Z' };
assert.equal(select([event, { ...event, id: 2, call_key: 'zoom:example:b' }]).length, 1);
assert.equal(select([{ ...event, status: 'write_outcome_requires_review' }]).length, 0);
assert.equal(select([{ ...event, occurred_at: '2026-09-01T10:00:00.000Z' }]).length, 0);
for (const status of ['recovered', 'intake_recovering', 'intake_recovery_failed']) {
  assert.equal(select([event, { call_key: event.call_key, status }]).length, 0);
}
const validate = rows => new Function('$input', code['MM Validate Cached Intake Recovery'])(input(rows));
assert.throws(() => validate([{ source: { automationKey: 'untrusted' } }]), /Invalid cached/);
const source = { automationKey: 'zoom:example:a', meetingUuid: 'example', recordingFileId: 'a', googleDocText: 'Transcript', googleDocTitle: 'Title', callNumber: 'Call 1', zoomAccessToken: 'test-token', __mmAttempts: { stage: 2 } };
const safe = validate([{ source }])[0];
assert.equal(safe.json.zoomAccessToken, undefined);
assert.equal(safe.json.__mmAttempts, undefined);
assert.equal(safe.json.automationKey, source.automationKey);
assert.deepEqual(safe.pairedItem, { item: 0 });
for (const js of Object.values(code)) new (Object.getPrototypeOf(async function () {}).constructor)(js);
console.log('PASS: identity, structured errors, bounded retry, ambiguous-write hold, recovery deduplication, cached-input validation.');
