// Connected previews must never fall back to a provider-injected preview clone
// or an inherited production connection. Production keeps its existing setting.
export function databaseUrl(env: Record<string, string | undefined> = process.env) {
  if (env.VERCEL_ENV === 'preview' && env.COACHING_LAB_CONNECTED === 'true') {
    if (!env.COACHING_LAB_DATABASE_URL) throw new Error('Explicit coaching lab database is required');
    return env.COACHING_LAB_DATABASE_URL;
  }
  return env.DATABASE_URL;
}
