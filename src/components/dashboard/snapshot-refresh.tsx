"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Check metadata only; source reads remain owned by the scheduled refresher. */
export function SnapshotRefresh({scope, fetchedAt, day, calendarDate}: {
  scope: "compliance" | "scorecard" | "attendance"; fetchedAt?: string; day?: string; calendarDate?: string;
}) {
  const router = useRouter();
  useEffect(() => {
    let stopped = false, busy = false, refreshedVersion = "";
    const controller = new AbortController();
    async function check() {
      if (stopped || busy || document.visibilityState !== "visible") return;
      busy = true;
      try {
        const query = new URLSearchParams({scope, ...(day ? {day} : {})});
        const response = await fetch(`/api/admin/read-cache/version?${query}`, {cache:"no-store",signal:AbortSignal.any([controller.signal, AbortSignal.timeout(10000)])});
        if (!response.ok) return;
        const data = await response.json();
        const version = `${data.fetchedAt}:${data.day}`;
        if (!stopped && version !== refreshedVersion && data.fetchedAt &&
          ((!fetchedAt || Date.parse(data.fetchedAt) > Date.parse(fetchedAt)) || (day && calendarDate && data.day !== calendarDate))) {
          refreshedVersion = version;
          router.refresh();
        }
      } catch { /* A failed metadata read must not replace successful page content. */ }
      finally { busy = false; }
    }
    const timer = setInterval(check, 30000);
    const initial = setTimeout(check, 3000);
    document.addEventListener("visibilitychange", check);
    return () => { stopped = true; controller.abort(); clearInterval(timer); clearTimeout(initial); document.removeEventListener("visibilitychange",check); };
  },[scope,fetchedAt,day,calendarDate,router]);
  return null;
}
