import { BRANDED_MAGIC_MIKE_ORIGIN } from "@/lib/magic-mike-origin";

/** Production integrations use this stable origin for callbacks and delivered links. */
export const MANUAL_PRODUCTION_ORIGIN = "https://sales-performance-dashboard-rose.vercel.app";

export function manualDeliveryUrls(requestOrigin: string, publicId: string, environment: string | undefined, isolatedPreviewOrigin?: string) {
  const origin = new URL(requestOrigin);
  const allowedOrigin = environment === "preview" && isolatedPreviewOrigin === "https://sales-performance-dashboard-git-code-84470c-admin-insidesuccess.vercel.app" ? isolatedPreviewOrigin : MANUAL_PRODUCTION_ORIGIN;
  const trustedOrigin = origin.origin === allowedOrigin ||
    (environment === "production" && origin.origin === BRANDED_MAGIC_MIKE_ORIGIN);
  if ((environment !== "production" && !(environment === "preview" && isolatedPreviewOrigin === allowedOrigin)) || !trustedOrigin ||
      origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash) {
    throw new Error("Self-submitted reports are available on the live Magic Mike dashboard. Open the production dashboard to submit your call.");
  }
  if (!/^[a-f0-9]{32}$/.test(publicId)) throw new Error("Invalid manual report ID");
  return {
    callbackUrl: `${allowedOrigin}/api/manual-reports/callback`,
    reportUrl: `${allowedOrigin}/self-report/${publicId}`,
  };
}
