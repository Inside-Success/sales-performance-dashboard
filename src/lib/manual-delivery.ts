/** Production manual jobs must always return to this dashboard, never to a caller-supplied host. */
export const MANUAL_PRODUCTION_ORIGIN = "https://sales-performance-dashboard-rose.vercel.app";

export function manualDeliveryUrls(requestOrigin: string, publicId: string, environment: string | undefined) {
  const origin = new URL(requestOrigin);
  if (environment !== "production" || origin.origin !== MANUAL_PRODUCTION_ORIGIN ||
      origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash) {
    throw new Error("Self-submitted reports are available on the live Magic Mike dashboard. Open the production dashboard to submit your call.");
  }
  if (!/^[a-f0-9]{32}$/.test(publicId)) throw new Error("Invalid manual report ID");
  return {
    callbackUrl: `${MANUAL_PRODUCTION_ORIGIN}/api/manual-reports/callback`,
    reportUrl: `${MANUAL_PRODUCTION_ORIGIN}/self-report/${publicId}`,
  };
}
