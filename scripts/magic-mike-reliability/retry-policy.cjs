// Pure policy: retry only the failed item and never replay an ambiguous write.
function classifyFailure(error, kind, attempt) {
  const e = error?.error ?? error ?? {};
  const text = [e.message, e.description, e.cause?.message, typeof e === 'string' ? e : ''].filter(Boolean).join(' ');
  const code = Number(e.httpCode || e.statusCode || e.status || e.context?.httpCode || e.cause?.status || text.match(/\b(4\d\d|5\d\d)\b/)?.[1] || 0);
  const quota = code === 429 || ((code === 403 || !code) && /quota|rate.?limit|too many requests/i.test(text));
  const read = kind === 'read' || kind === 'download' || kind === 'compute' || kind === 'idempotent';
  const transient = quota || (read && (code >= 500 || /overloaded|timeout|timed out|ECONNRESET|ETIMEDOUT/i.test(text))) || (kind === 'download' && code === 404);
  const retry = transient && attempt < 5;
  return { retry, statusCode: code, quota, delaySeconds: Math.min(65 * 2 ** attempt, 900), reason: retry ? 'retry_scheduled' : transient ? 'retry_exhausted' : read ? 'needs_review' : 'write_outcome_requires_review' };
}
module.exports = { classifyFailure };
